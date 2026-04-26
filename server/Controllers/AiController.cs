using System.Data;
using System.Security.Claims;
using System.Text;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using server.DTOs;
using server.Services;

namespace server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AiController : ControllerBase
{
    private readonly IDbConnection _db;
    private readonly GeminiService _gemini;
    public AiController(IDbConnection db, GeminiService gemini) => (_db, _gemini) = (db, gemini);
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpPost("generate-plan")]
    public async Task<ActionResult<CreatePlanRequest>> GeneratePlan(GeneratePlanRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Description))
            return BadRequest("Description is required");

        var exercises = (await _db.QueryAsync<ExerciseInfo>(
            @"SELECT Id, Name, Category FROM Exercises
              WHERE IsDefault = 1 OR CreatedByUserId = @UserId
              ORDER BY Category, Name",
            new { UserId })).ToList();

        try
        {
            var plan = await _gemini.GeneratePlan(request.Description, exercises);
            if (plan == null)
                return StatusCode(500, "AI returned an empty response");

            var validIds = exercises.Select(e => e.Id).ToHashSet();
            foreach (var day in plan.Days)
                day.Exercises = day.Exercises.Where(e => validIds.Contains(e.ExerciseId)).ToList();

            for (var i = 0; i < plan.Days.Count; i++)
            {
                plan.Days[i].Order = i;
                for (var j = 0; j < plan.Days[i].Exercises.Count; j++)
                    plan.Days[i].Exercises[j].Order = j;
            }

            return Ok(plan);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"AI request failed: {ex.Message}");
        }
    }

    [HttpPost("advice")]
    public async Task<ActionResult<AdviceResponse>> GetAdvice(AdviceRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest("Message is required");

        try
        {
            var planContext = await BuildPlanContext();
            var reply = await _gemini.GetAdvice(request.Message, request.History, planContext);
            return Ok(new AdviceResponse { Message = reply });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"AI request failed: {ex.Message}");
        }
    }

    private async Task<string?> BuildPlanContext()
    {
        var rows = await _db.QueryAsync<PlanContextRow>(
            @"SELECT d.Name AS DayName, e.Name AS ExerciseName, pe.Sets, pe.Reps, pe.Weight
              FROM WorkoutPlans p
              INNER JOIN PlanDays d ON d.WorkoutPlanId = p.Id
              INNER JOIN PlanExercises pe ON pe.PlanDayId = d.Id
              INNER JOIN Exercises e ON e.Id = pe.ExerciseId
              WHERE p.UserId = @UserId AND p.IsActive = 1
              ORDER BY d.[Order], pe.[Order]",
            new { UserId });

        var list = rows.ToList();
        if (list.Count == 0) return null;

        var sb = new StringBuilder();
        string? currentDay = null;
        foreach (var row in list)
        {
            if (row.DayName != currentDay)
            {
                currentDay = row.DayName;
                sb.AppendLine($"\n{currentDay}:");
            }
            sb.AppendLine($"  - {row.ExerciseName}: {row.Sets}x{row.Reps} @ {row.Weight}kg");
        }
        return sb.ToString().Trim();
    }
}

file record PlanContextRow(string DayName, string ExerciseName, int Sets, string Reps, decimal Weight);
