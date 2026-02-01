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

    [HttpGet("next")]
    public async Task<ActionResult<NextWorkoutResponse>> GetNextWorkout()
    {
        var plan = await _db.WorkoutPlans
            .Where(p => p.UserId == UserId)
            .OrderByDescending(p => p.CreatedAt)
            .Include(p => p.Days)
                .ThenInclude(d => d.Exercises)
                    .ThenInclude(e => e.Exercise)
            .FirstOrDefaultAsync();

        if (plan == null || plan.Days.Count == 0)
            return NotFound("No workout plan found");

        var orderedDays = plan.Days.OrderBy(d => d.Order).ToList();

        var lastSession = await _db.WorkoutSessions
            .Where(w => w.UserId == UserId && w.PlanDayId != null)
            .OrderByDescending(w => w.Date)
            .ThenByDescending(w => w.CreatedAt)
            .Select(w => new { w.PlanDay!.Order })
            .FirstOrDefaultAsync();

        int nextOrder;
        if (lastSession == null)
        {
            nextOrder = 0;
        }
        else
        {
            nextOrder = (lastSession.Order + 1) % orderedDays.Count;
        }

        var nextDay = orderedDays.First(d => d.Order == nextOrder);

        return Ok(new NextWorkoutResponse
        {
            PlanDayId = nextDay.Id,
            DayName = nextDay.Name,
            DayOrder = nextDay.Order,
            Exercises = nextDay.Exercises.OrderBy(e => e.Order).Select(e => new PlanExerciseResponse
            {
                Id = e.Id,
                ExerciseId = e.ExerciseId,
                ExerciseName = e.Exercise.Name,
                ExerciseCategory = e.Exercise.Category,
                Order = e.Order,
                Sets = e.Sets,
                Reps = e.Reps,
                Weight = e.Weight,
                Notes = e.Notes
            }).ToList()
        });
    }

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
                CreatedAt = w.CreatedAt,
                PlanDayName = w.PlanDay != null ? w.PlanDay.Name : null,
                IsRestDay = w.IsRestDay
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
                PlanDayName = w.PlanDay != null ? w.PlanDay.Name : null,
                IsRestDay = w.IsRestDay,
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
            PlanDayId = request.PlanDayId,
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

    [HttpPost("rest")]
    public async Task<ActionResult<WorkoutDetailResponse>> LogRestDay(LogRestDayRequest request)
    {
        var session = new WorkoutSession
        {
            UserId = UserId,
            Date = request.Date,
            Notes = request.Notes,
            PlanDayId = request.PlanDayId,
            IsRestDay = true,
            CreatedAt = DateTime.UtcNow
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
                PlanDayName = w.PlanDay != null ? w.PlanDay.Name : null,
                IsRestDay = w.IsRestDay,
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
