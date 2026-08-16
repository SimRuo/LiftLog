using System.Data;
using System.Security.Claims;
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
    private readonly IPlanGenerator _generator;
    private readonly ILogger<AiController> _log;

    public AiController(IDbConnection db, IPlanGenerator generator, ILogger<AiController> log)
        => (_db, _generator, _log) = (db, generator, log);

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpPost("generate-plan")]
    public async Task<ActionResult<CreatePlanRequest>> GeneratePlan(GeneratePlanRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Description))
            return BadRequest("Describe the plan you want.");

        var exercises = (await _db.QueryAsync<ExerciseInfo>(
            @"SELECT Id, Name, Category FROM Exercises
              WHERE IsDefault = 1 OR CreatedByUserId = @UserId
              ORDER BY Category, Name",
            new { UserId })).ToList();

        if (exercises.Count == 0)
            return BadRequest("There are no exercises to build a plan from.");

        try
        {
            var plan = await _generator.GeneratePlan(request.Description, exercises);
            if (plan is null)
                return StatusCode(502, "The model returned nothing usable. Try rephrasing the request.");

            return Ok(Normalise(plan, exercises));
        }
        catch (TaskCanceledException)
        {
            // Almost always the HttpClient timeout rather than a caller
            // disconnect: CPU generation that overruns ten minutes is wedged.
            _log.LogError("Plan generation timed out");
            return StatusCode(504, "The model took too long to respond. It may still be loading — try again shortly.");
        }
        catch (HttpRequestException ex)
        {
            _log.LogError(ex, "Plan generation transport failure");
            return StatusCode(502, ex.Message);
        }
    }

    /// <summary>
    /// The model is asked for as little as possible, so the deterministic parts
    /// are filled in here: ordering comes from array position, and weight is
    /// always 0 because the lifter supplies their own.
    ///
    /// The ID filter and the set clamp are redundant under the Ollama path,
    /// where the grammar already guarantees valid IDs — they're kept because
    /// the Groq path has no such guarantee, and because a validation error from
    /// PlansController later is a far worse way to find out.
    /// </summary>
    private static CreatePlanRequest Normalise(CreatePlanRequest plan, List<ExerciseInfo> exercises)
    {
        var validIds = exercises.Select(e => e.Id).ToHashSet();

        plan.Name = Truncate(plan.Name, 100, "Generated plan");
        plan.Days = plan.Days.Where(d => d.Exercises.Count > 0).ToList();

        for (var i = 0; i < plan.Days.Count; i++)
        {
            var day = plan.Days[i];
            day.Order = i;
            day.Name = Truncate(day.Name, 100, $"Day {i + 1}");
            day.Exercises = day.Exercises.Where(e => validIds.Contains(e.ExerciseId)).ToList();

            for (var j = 0; j < day.Exercises.Count; j++)
            {
                var ex = day.Exercises[j];
                ex.Order = j;
                ex.Sets = Math.Clamp(ex.Sets, 1, 20);
                ex.Reps = Truncate(ex.Reps, 20, "8");
                ex.Weight = 0;
                if (string.IsNullOrWhiteSpace(ex.Notes)) ex.Notes = null;
            }
        }

        // Days can empty out if every exercise in them was filtered.
        plan.Days = plan.Days.Where(d => d.Exercises.Count > 0).ToList();
        return plan;
    }

    private static string Truncate(string? value, int max, string fallback)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return fallback;
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }
}
