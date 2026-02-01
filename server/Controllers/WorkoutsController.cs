using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.DTOs;
using server.Models;

namespace server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WorkoutsController : ControllerBase
{
    private readonly LiftLogDbContext _db;

    public WorkoutsController(LiftLogDbContext db)
    {
        _db = db;
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<ActionResult<PaginatedResponse<WorkoutSummaryResponse>>> GetWorkouts(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _db.WorkoutSessions
            .Where(w => w.UserId == UserId)
            .OrderByDescending(w => w.Date);

        var total = await query.CountAsync();

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(w => new WorkoutSummaryResponse
            {
                Id = w.Id,
                Date = w.Date,
                Notes = w.Notes,
                ExerciseCount = w.Sets.Select(s => s.ExerciseId).Distinct().Count(),
                SetCount = w.Sets.Count,
                CreatedAt = w.CreatedAt
            })
            .ToListAsync();

        return Ok(new PaginatedResponse<WorkoutSummaryResponse>
        {
            Items = items,
            TotalCount = total,
            Page = page,
            PageSize = pageSize
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<WorkoutDetailResponse>> GetWorkout(int id)
    {
        var workout = await _db.WorkoutSessions
            .Where(w => w.Id == id && w.UserId == UserId)
            .Select(w => new WorkoutDetailResponse
            {
                Id = w.Id,
                Date = w.Date,
                Notes = w.Notes,
                CreatedAt = w.CreatedAt,
                Sets = w.Sets
                    .OrderBy(s => s.Exercise.Name)
                    .ThenBy(s => s.SetNumber)
                    .Select(s => new WorkoutSetResponse
                    {
                        Id = s.Id,
                        ExerciseId = s.ExerciseId,
                        ExerciseName = s.Exercise.Name,
                        ExerciseCategory = s.Exercise.Category,
                        SetNumber = s.SetNumber,
                        Reps = s.Reps,
                        Weight = s.Weight,
                        Notes = s.Notes
                    }).ToList()
            })
            .FirstOrDefaultAsync();

        if (workout == null) return NotFound();
        return Ok(workout);
    }

    [HttpPost]
    public async Task<ActionResult<WorkoutDetailResponse>> CreateWorkout(CreateWorkoutRequest request)
    {
        var session = new WorkoutSession
        {
            UserId = UserId,
            Date = request.Date,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow,
            Sets = request.Sets.Select(s => new WorkoutSet
            {
                ExerciseId = s.ExerciseId,
                SetNumber = s.SetNumber,
                Reps = s.Reps,
                Weight = s.Weight,
                Notes = s.Notes
            }).ToList()
        };

        _db.WorkoutSessions.Add(session);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetWorkout), new { id = session.Id },
            await GetWorkoutDetail(session.Id));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteWorkout(int id)
    {
        var workout = await _db.WorkoutSessions
            .FirstOrDefaultAsync(w => w.Id == id && w.UserId == UserId);

        if (workout == null) return NotFound();

        _db.WorkoutSessions.Remove(workout);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<WorkoutDetailResponse> GetWorkoutDetail(int id)
    {
        return await _db.WorkoutSessions
            .Where(w => w.Id == id)
            .Select(w => new WorkoutDetailResponse
            {
                Id = w.Id,
                Date = w.Date,
                Notes = w.Notes,
                CreatedAt = w.CreatedAt,
                Sets = w.Sets
                    .OrderBy(s => s.Exercise.Name)
                    .ThenBy(s => s.SetNumber)
                    .Select(s => new WorkoutSetResponse
                    {
                        Id = s.Id,
                        ExerciseId = s.ExerciseId,
                        ExerciseName = s.Exercise.Name,
                        ExerciseCategory = s.Exercise.Category,
                        SetNumber = s.SetNumber,
                        Reps = s.Reps,
                        Weight = s.Weight,
                        Notes = s.Notes
                    }).ToList()
            })
            .FirstAsync();
    }
}
