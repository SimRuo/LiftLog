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
public class PlansController : ControllerBase
{
    private readonly LiftLogDbContext _db;

    public PlansController(LiftLogDbContext db)
    {
        _db = db;
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<ActionResult<PlanResponse>> GetPlan()
    {
        var plan = await _db.WorkoutPlans
            .Where(p => p.UserId == UserId)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new PlanResponse
            {
                Id = p.Id,
                Name = p.Name,
                CreatedAt = p.CreatedAt,
                Days = p.Days.OrderBy(d => d.Order).Select(d => new PlanDayResponse
                {
                    Id = d.Id,
                    Name = d.Name,
                    Order = d.Order,
                    Exercises = d.Exercises.OrderBy(e => e.Order).Select(e => new PlanExerciseResponse
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
                }).ToList()
            })
            .FirstOrDefaultAsync();

        if (plan == null) return NotFound();
        return Ok(plan);
    }

    [HttpPost]
    public async Task<ActionResult<PlanResponse>> CreatePlan(CreatePlanRequest request)
    {
        // Delete existing plan(s) for this user
        var existing = await _db.WorkoutPlans
            .Where(p => p.UserId == UserId)
            .ToListAsync();
        _db.WorkoutPlans.RemoveRange(existing);

        var plan = new WorkoutPlan
        {
            UserId = UserId,
            Name = request.Name,
            CreatedAt = DateTime.UtcNow,
            Days = request.Days.Select(d => new PlanDay
            {
                Name = d.Name,
                Order = d.Order,
                Exercises = d.Exercises.Select(e => new PlanExercise
                {
                    ExerciseId = e.ExerciseId,
                    Order = e.Order,
                    Sets = e.Sets,
                    Reps = e.Reps,
                    Weight = e.Weight,
                    Notes = e.Notes
                }).ToList()
            }).ToList()
        };

        _db.WorkoutPlans.Add(plan);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetPlan), await GetPlanResponse(plan.Id));
    }

    [HttpPut]
    public async Task<ActionResult<PlanResponse>> UpdatePlan(CreatePlanRequest request)
    {
        var existing = await _db.WorkoutPlans
            .Where(p => p.UserId == UserId)
            .ToListAsync();
        _db.WorkoutPlans.RemoveRange(existing);

        var plan = new WorkoutPlan
        {
            UserId = UserId,
            Name = request.Name,
            CreatedAt = DateTime.UtcNow,
            Days = request.Days.Select(d => new PlanDay
            {
                Name = d.Name,
                Order = d.Order,
                Exercises = d.Exercises.Select(e => new PlanExercise
                {
                    ExerciseId = e.ExerciseId,
                    Order = e.Order,
                    Sets = e.Sets,
                    Reps = e.Reps,
                    Weight = e.Weight,
                    Notes = e.Notes
                }).ToList()
            }).ToList()
        };

        _db.WorkoutPlans.Add(plan);
        await _db.SaveChangesAsync();

        return Ok(await GetPlanResponse(plan.Id));
    }

    [HttpDelete]
    public async Task<IActionResult> DeletePlan()
    {
        var plans = await _db.WorkoutPlans
            .Where(p => p.UserId == UserId)
            .ToListAsync();

        if (plans.Count == 0) return NotFound();

        _db.WorkoutPlans.RemoveRange(plans);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<PlanResponse> GetPlanResponse(int planId)
    {
        return await _db.WorkoutPlans
            .Where(p => p.Id == planId)
            .Select(p => new PlanResponse
            {
                Id = p.Id,
                Name = p.Name,
                CreatedAt = p.CreatedAt,
                Days = p.Days.OrderBy(d => d.Order).Select(d => new PlanDayResponse
                {
                    Id = d.Id,
                    Name = d.Name,
                    Order = d.Order,
                    Exercises = d.Exercises.OrderBy(e => e.Order).Select(e => new PlanExerciseResponse
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
                }).ToList()
            })
            .FirstAsync();
    }
}
