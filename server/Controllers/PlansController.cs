using System.Data;
using System.Security.Claims;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using server.Data;
using server.DTOs;

namespace server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PlansController : ControllerBase
{
    private readonly IDbConnection _db;
    public PlansController(IDbConnection db) => _db = db;
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<ActionResult<PlanResponse>> GetPlan()
    {
        var plan = await _db.QueryFirstOrDefaultAsync<PlanResponse>(
            @"SELECT TOP 1 Id, Name, CreatedAt
              FROM WorkoutPlans WHERE UserId = @UserId
              ORDER BY CreatedAt DESC",
            new { UserId });

        if (plan == null) return NotFound();

        await PopulatePlanDays(plan);
        return Ok(plan);
    }

    [HttpPost]
    public async Task<ActionResult<PlanResponse>> CreatePlan(CreatePlanRequest request)
    {
        await DeleteUserPlans();
        var planId = await InsertPlan(request);
        return CreatedAtAction(nameof(GetPlan), await GetPlanById(planId));
    }

    [HttpPut]
    public async Task<ActionResult<PlanResponse>> UpdatePlan(CreatePlanRequest request)
    {
        await DeleteUserPlans();
        var planId = await InsertPlan(request);
        return Ok(await GetPlanById(planId));
    }

    [HttpDelete]
    public async Task<IActionResult> DeletePlan()
    {
        var rows = await DeleteUserPlans();
        return rows == 0 ? NotFound() : NoContent();
    }

    private async Task<int> DeleteUserPlans()
    {
        return await _db.ExecuteAsync(
            "DELETE FROM WorkoutPlans WHERE UserId = @UserId",
            new { UserId });
    }

    private async Task<int> InsertPlan(CreatePlanRequest request)
    {
        var planId = await _db.QuerySingleAsync<int>(
            @"INSERT INTO WorkoutPlans (UserId, Name, CreatedAt)
              OUTPUT INSERTED.Id
              VALUES (@UserId, @Name, SYSUTCDATETIME())",
            new { UserId, request.Name });

        foreach (var day in request.Days)
        {
            var dayId = await _db.QuerySingleAsync<int>(
                @"INSERT INTO PlanDays (WorkoutPlanId, Name, [Order])
                  OUTPUT INSERTED.Id
                  VALUES (@PlanId, @Name, @Order)",
                new { PlanId = planId, day.Name, day.Order });

            if (day.Exercises.Count > 0)
            {
                await _db.ExecuteAsync(
                    @"INSERT INTO PlanExercises (PlanDayId, ExerciseId, [Order], Sets, Reps, Weight, Notes)
                      VALUES (@DayId, @ExerciseId, @Order, @Sets, @Reps, @Weight, @Notes)",
                    day.Exercises.Select(ex => new
                    {
                        DayId = dayId, ex.ExerciseId, ex.Order,
                        ex.Sets, ex.Reps, ex.Weight, ex.Notes
                    }));
            }
        }

        return planId;
    }

    private async Task<PlanResponse> GetPlanById(int planId)
    {
        var plan = await _db.QueryFirstAsync<PlanResponse>(
            "SELECT Id, Name, CreatedAt FROM WorkoutPlans WHERE Id = @PlanId",
            new { PlanId = planId });

        await PopulatePlanDays(plan);
        return plan;
    }

    private async Task PopulatePlanDays(PlanResponse plan)
    {
        var rows = (await _db.QueryAsync<PlanDayRow, PlanExerciseRow, PlanDayRow>(
            @"SELECT d.Id, d.Name, d.[Order],
                     pe.Id, pe.ExerciseId, e.Name AS ExerciseName,
                     e.Category AS ExerciseCategory,
                     pe.[Order], pe.Sets, pe.Reps, pe.Weight, pe.Notes
              FROM PlanDays d
              INNER JOIN PlanExercises pe ON pe.PlanDayId = d.Id
              INNER JOIN Exercises e ON e.Id = pe.ExerciseId
              WHERE d.WorkoutPlanId = @PlanId
              ORDER BY d.[Order], pe.[Order]",
            (day, exercise) => { day.Exercises.Add(exercise); return day; },
            new { PlanId = plan.Id },
            splitOn: "Id")).ToList();

        plan.Days = rows
            .GroupBy(r => r.Id)
            .Select(g =>
            {
                var d = g.First();
                return new PlanDayResponse
                {
                    Id = d.Id, Name = d.Name, Order = d.Order,
                    Exercises = g.SelectMany(r => r.Exercises)
                        .Select(e => new PlanExerciseResponse
                        {
                            Id = e.Id, ExerciseId = e.ExerciseId,
                            ExerciseName = e.ExerciseName, ExerciseCategory = e.ExerciseCategory,
                            Order = e.Order, Sets = e.Sets, Reps = e.Reps,
                            Weight = e.Weight, Notes = e.Notes
                        }).ToList()
                };
            })
            .OrderBy(d => d.Order)
            .ToList();
    }
}
