using System.Data;
using System.Security.Claims;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using server.DTOs;

namespace server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProgressController : ControllerBase
{
    private readonly IDbConnection _db;
    public ProgressController(IDbConnection db) => _db = db;
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet("{exerciseId}")]
    public async Task<ActionResult<List<ProgressDataPoint>>> GetProgress(
        int exerciseId, [FromQuery] string metric = "maxWeight")
    {
        // Whitelisted rather than interpolated freely — this string goes
        // straight into the SQL text.
        //
        // estimated1RM is Epley (w * (1 + reps/30)), capped at 12 reps because
        // the formula degrades badly past that. It exists because max weight
        // alone is a poor progress signal on a cut: the top weight often holds
        // while reps quietly fall, so the chart draws a flat line through a
        // period you were measurably getting weaker.
        var aggregate = metric switch
        {
            "totalVolume" => "SUM(wset.Weight * wset.Reps)",
            "estimated1RM" =>
                "MAX(wset.Weight * (1.0 + (CASE WHEN wset.Reps > 12 THEN 12 ELSE wset.Reps END) / 30.0))",
            _ => "MAX(wset.Weight)"
        };

        var result = await _db.QueryAsync<ProgressDataPoint>(
            $@"SELECT CAST(ws.Date AS DATE) AS Date, {aggregate} AS Value
               FROM WorkoutSets wset
               INNER JOIN WorkoutSessions ws ON ws.Id = wset.WorkoutSessionId
               WHERE wset.ExerciseId = @ExerciseId AND ws.UserId = @UserId
               GROUP BY CAST(ws.Date AS DATE)
               ORDER BY CAST(ws.Date AS DATE)",
            new { ExerciseId = exerciseId, UserId });

        return Ok(result.ToList());
    }
}
