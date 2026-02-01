using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.DTOs;

namespace server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProgressController : ControllerBase
{
    private readonly LiftLogDbContext _db;

    public ProgressController(LiftLogDbContext db)
    {
        _db = db;
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet("{exerciseId}")]
    public async Task<ActionResult<List<ProgressDataPoint>>> GetProgress(
        int exerciseId, [FromQuery] string metric = "maxWeight")
    {
        var sets = await _db.WorkoutSets
            .Where(s => s.ExerciseId == exerciseId && s.WorkoutSession.UserId == UserId)
            .Select(s => new
            {
                s.WorkoutSession.Date,
                s.Weight,
                s.Reps
            })
            .ToListAsync();

        var grouped = sets.GroupBy(s => s.Date.Date);

        List<ProgressDataPoint> result = metric switch
        {
            "totalVolume" => grouped
                .Select(g => new ProgressDataPoint
                {
                    Date = g.Key,
                    Value = g.Sum(s => s.Weight * s.Reps)
                })
                .OrderBy(p => p.Date)
                .ToList(),
            _ => grouped
                .Select(g => new ProgressDataPoint
                {
                    Date = g.Key,
                    Value = g.Max(s => s.Weight)
                })
                .OrderBy(p => p.Date)
                .ToList()
        };

        return Ok(result);
    }
}
