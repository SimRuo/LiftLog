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
public class ExercisesController : ControllerBase
{
    private readonly LiftLogDbContext _db;

    public ExercisesController(LiftLogDbContext db)
    {
        _db = db;
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<ActionResult<List<ExerciseByCategoryResponse>>> GetExercises()
    {
        var exercises = await _db.Exercises
            .OrderBy(e => e.Category)
            .ThenBy(e => e.Name)
            .Select(e => new ExerciseResponse
            {
                Id = e.Id,
                Name = e.Name,
                Category = e.Category,
                IsDefault = e.IsDefault
            })
            .ToListAsync();

        var grouped = exercises
            .GroupBy(e => e.Category)
            .Select(g => new ExerciseByCategoryResponse
            {
                Category = g.Key,
                Exercises = g.ToList()
            })
            .ToList();

        return Ok(grouped);
    }

    [HttpPost]
    public async Task<ActionResult<ExerciseResponse>> CreateExercise(CreateExerciseRequest request)
    {
        var existing = await _db.Exercises
            .FirstOrDefaultAsync(e => e.Name.ToLower() == request.Name.ToLower());

        if (existing != null)
        {
            return Ok(new ExerciseResponse
            {
                Id = existing.Id,
                Name = existing.Name,
                Category = existing.Category,
                IsDefault = existing.IsDefault
            });
        }

        var exercise = new Exercise
        {
            Name = request.Name.Trim(),
            Category = request.Category.Trim(),
            IsDefault = false,
            CreatedByUserId = UserId
        };

        _db.Exercises.Add(exercise);
        await _db.SaveChangesAsync();

        return Created("", new ExerciseResponse
        {
            Id = exercise.Id,
            Name = exercise.Name,
            Category = exercise.Category,
            IsDefault = false
        });
    }
}
