using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.DTOs;

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
}
