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
public class ExercisesController : ControllerBase
{
    private readonly IDbConnection _db;
    public ExercisesController(IDbConnection db) => _db = db;
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<ActionResult<List<ExerciseByCategoryResponse>>> GetExercises()
    {
        var exercises = await _db.QueryAsync<ExerciseResponse>(
            @"SELECT Id, Name, Category, IsDefault
              FROM Exercises
              ORDER BY Category, Name");

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
        var trimmedName = request.Name.Trim();
        var trimmedCategory = request.Category.Trim();

        var existing = await _db.QueryFirstOrDefaultAsync<ExerciseResponse>(
            @"SELECT Id, Name, Category, IsDefault
              FROM Exercises WHERE Name = @Name",
            new { Name = trimmedName });

        if (existing != null) return Ok(existing);

        try
        {
            var id = await _db.QuerySingleAsync<int>(
                @"INSERT INTO Exercises (Name, Category, IsDefault, CreatedByUserId)
                  OUTPUT INSERTED.Id
                  VALUES (@Name, @Category, 0, @UserId)",
                new { Name = trimmedName, Category = trimmedCategory, UserId });

            return Ok(new ExerciseResponse
            {
                Id = id, Name = trimmedName,
                Category = trimmedCategory, IsDefault = false
            });
        }
        catch (Microsoft.Data.SqlClient.SqlException ex) when (ex.Number is 2601 or 2627)
        {
            var raced = await _db.QueryFirstAsync<ExerciseResponse>(
                @"SELECT Id, Name, Category, IsDefault
                  FROM Exercises WHERE Name = @Name",
                new { Name = trimmedName });
            return Ok(raced);
        }
    }
}
