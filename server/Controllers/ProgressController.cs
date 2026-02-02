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
        var aggregate = metric == "totalVolume"
            ? "SUM(wset.Weight * wset.Reps)"
            : "MAX(wset.Weight)";

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
