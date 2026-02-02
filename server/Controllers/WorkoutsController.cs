using System.Data;
using System.Security.Claims;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using server.Data;
using server.DTOs;

namespace server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WorkoutsController : ControllerBase
{
    private readonly IDbConnection _db;
    public WorkoutsController(IDbConnection db) => _db = db;
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet("next")]
    public async Task<ActionResult<NextWorkoutResponse>> GetNextWorkout()
    {
        // Get days + exercises for the latest plan
        var rows = (await _db.QueryAsync<PlanDayRow, PlanExerciseRow, PlanDayRow>(
            @"SELECT d.Id, d.Name, d.[Order],
                     pe.Id, pe.ExerciseId, e.Name AS ExerciseName,
                     e.Category AS ExerciseCategory,
                     pe.[Order], pe.Sets, pe.Reps, pe.Weight, pe.Notes
              FROM WorkoutPlans p
              INNER JOIN PlanDays d ON d.WorkoutPlanId = p.Id
              INNER JOIN PlanExercises pe ON pe.PlanDayId = d.Id
              INNER JOIN Exercises e ON e.Id = pe.ExerciseId
              WHERE p.UserId = @UserId
                AND p.Id = (SELECT TOP 1 Id FROM WorkoutPlans WHERE UserId = @UserId ORDER BY CreatedAt DESC)
              ORDER BY d.[Order], pe.[Order]",
            (day, exercise) => { day.Exercises.Add(exercise); return day; },
            new { UserId },
            splitOn: "Id")).ToList();

        if (rows.Count == 0)
            return NotFound("No workout plan found");

        var days = rows
            .GroupBy(r => r.Id)
            .Select(g =>
            {
                var day = g.First();
                day.Exercises = g.SelectMany(r => r.Exercises).ToList();
                return day;
            })
            .OrderBy(d => d.Order)
            .ToList();

        // Find last session's plan day order
        var lastOrder = await _db.QueryFirstOrDefaultAsync<int?>(
            @"SELECT TOP 1 d.[Order]
              FROM WorkoutSessions ws
              INNER JOIN PlanDays d ON d.Id = ws.PlanDayId
              WHERE ws.UserId = @UserId AND ws.PlanDayId IS NOT NULL
              ORDER BY ws.Date DESC, ws.CreatedAt DESC",
            new { UserId });

        int nextOrder = lastOrder.HasValue
            ? (lastOrder.Value + 1) % days.Count
            : 0;

        var nextDay = days.First(d => d.Order == nextOrder);

        // Get last session's sets for this plan day
        var lastSets = (await _db.QueryAsync<LastSessionSetData>(
            @"SELECT wset.ExerciseId, wset.SetNumber, wset.Reps, wset.Weight
              FROM WorkoutSets wset
              INNER JOIN WorkoutSessions ws ON ws.Id = wset.WorkoutSessionId
              WHERE ws.PlanDayId = @PlanDayId AND ws.UserId = @UserId
                AND ws.Id = (
                    SELECT TOP 1 Id FROM WorkoutSessions
                    WHERE PlanDayId = @PlanDayId AND UserId = @UserId AND IsRestDay = 0
                    ORDER BY Date DESC, CreatedAt DESC
                )
              ORDER BY wset.ExerciseId, wset.SetNumber",
            new { PlanDayId = nextDay.Id, UserId }))
            .GroupBy(s => s.ExerciseId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var exercises = nextDay.Exercises.Select(e =>
        {
            var resp = new PlanExerciseResponse
            {
                Id = e.Id, ExerciseId = e.ExerciseId,
                ExerciseName = e.ExerciseName, ExerciseCategory = e.ExerciseCategory,
                Order = e.Order, Sets = e.Sets, Reps = e.Reps,
                Weight = e.Weight, Notes = e.Notes
            };
            if (lastSets.TryGetValue(e.ExerciseId, out var sets))
                resp.LastSessionSets = sets;
            return resp;
        }).ToList();

        return Ok(new NextWorkoutResponse
        {
            PlanDayId = nextDay.Id,
            DayName = nextDay.Name,
            DayOrder = nextDay.Order,
            Exercises = exercises
        });
    }

    [HttpGet]
    public async Task<ActionResult<PaginatedResponse<WorkoutSummaryResponse>>> GetWorkouts(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var offset = (page - 1) * pageSize;

        var total = await _db.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM WorkoutSessions WHERE UserId = @UserId",
            new { UserId });

        var items = await _db.QueryAsync<WorkoutSummaryResponse>(
            @"SELECT ws.Id, ws.Date, ws.Notes, ws.CreatedAt, ws.IsRestDay,
                     pd.Name AS PlanDayName,
                     COUNT(DISTINCT wset.ExerciseId) AS ExerciseCount,
                     COUNT(wset.Id) AS SetCount
              FROM WorkoutSessions ws
              LEFT JOIN PlanDays pd ON pd.Id = ws.PlanDayId
              LEFT JOIN WorkoutSets wset ON wset.WorkoutSessionId = ws.Id
              WHERE ws.UserId = @UserId
              GROUP BY ws.Id, ws.Date, ws.Notes, ws.CreatedAt, ws.IsRestDay, pd.Name
              ORDER BY ws.Date DESC
              OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY",
            new { UserId, Offset = offset, PageSize = pageSize });

        return Ok(new PaginatedResponse<WorkoutSummaryResponse>
        {
            Items = items.ToList(), TotalCount = total,
            Page = page, PageSize = pageSize
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<WorkoutDetailResponse>> GetWorkout(int id)
    {
        var detail = await GetWorkoutDetail(id);
        if (detail == null) return NotFound();
        return Ok(detail);
    }

    [HttpPost]
    public async Task<ActionResult<WorkoutDetailResponse>> CreateWorkout(CreateWorkoutRequest request)
    {
        var sessionId = await _db.QuerySingleAsync<int>(
            @"INSERT INTO WorkoutSessions (UserId, Date, Notes, PlanDayId, CreatedAt, IsRestDay)
              OUTPUT INSERTED.Id
              VALUES (@UserId, @Date, @Notes, @PlanDayId, SYSUTCDATETIME(), 0)",
            new { UserId, request.Date, request.Notes, request.PlanDayId });

        if (request.Sets.Count > 0)
        {
            await _db.ExecuteAsync(
                @"INSERT INTO WorkoutSets (WorkoutSessionId, ExerciseId, SetNumber, Reps, Weight, Notes)
                  VALUES (@SessionId, @ExerciseId, @SetNumber, @Reps, @Weight, @Notes)",
                request.Sets.Select(s => new
                {
                    SessionId = sessionId,
                    s.ExerciseId, s.SetNumber, s.Reps, s.Weight, s.Notes
                }));

            // Update plan exercise weights to match what was actually lifted
            if (request.PlanDayId.HasValue)
            {
                await _db.ExecuteAsync(
                    @"UPDATE pe
                      SET pe.Weight = sub.MaxWeight
                      FROM PlanExercises pe
                      INNER JOIN (
                          SELECT wset.ExerciseId, MAX(wset.Weight) AS MaxWeight
                          FROM WorkoutSets wset
                          WHERE wset.WorkoutSessionId = @SessionId
                          GROUP BY wset.ExerciseId
                      ) sub ON sub.ExerciseId = pe.ExerciseId
                      WHERE pe.PlanDayId = @PlanDayId",
                    new { SessionId = sessionId, PlanDayId = request.PlanDayId.Value });
            }
        }

        return CreatedAtAction(nameof(GetWorkout), new { id = sessionId },
            await GetWorkoutDetail(sessionId));
    }

    [HttpPost("rest")]
    public async Task<ActionResult<WorkoutDetailResponse>> LogRestDay(LogRestDayRequest request)
    {
        var sessionId = await _db.QuerySingleAsync<int>(
            @"INSERT INTO WorkoutSessions (UserId, Date, Notes, PlanDayId, CreatedAt, IsRestDay)
              OUTPUT INSERTED.Id
              VALUES (@UserId, @Date, @Notes, @PlanDayId, SYSUTCDATETIME(), 1)",
            new { UserId, request.Date, request.Notes, request.PlanDayId });

        return CreatedAtAction(nameof(GetWorkout), new { id = sessionId },
            await GetWorkoutDetail(sessionId));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteWorkout(int id)
    {
        var rows = await _db.ExecuteAsync(
            "DELETE FROM WorkoutSessions WHERE Id = @Id AND UserId = @UserId",
            new { Id = id, UserId });

        return rows == 0 ? NotFound() : NoContent();
    }

    private async Task<WorkoutDetailResponse?> GetWorkoutDetail(int id)
    {
        using var multi = await _db.QueryMultipleAsync(
            @"SELECT ws.Id, ws.Date, ws.Notes, ws.CreatedAt, ws.IsRestDay,
                     pd.Name AS PlanDayName
              FROM WorkoutSessions ws
              LEFT JOIN PlanDays pd ON pd.Id = ws.PlanDayId
              WHERE ws.Id = @Id AND ws.UserId = @UserId;

              SELECT wset.Id, wset.ExerciseId, e.Name AS ExerciseName,
                     e.Category AS ExerciseCategory,
                     wset.SetNumber, wset.Reps, wset.Weight, wset.Notes
              FROM WorkoutSets wset
              INNER JOIN Exercises e ON e.Id = wset.ExerciseId
              WHERE wset.WorkoutSessionId = @Id
              ORDER BY e.Name, wset.SetNumber",
            new { Id = id, UserId });

        var session = await multi.ReadFirstOrDefaultAsync<WorkoutDetailResponse>();
        if (session == null) return null;

        session.Sets = (await multi.ReadAsync<WorkoutSetResponse>()).ToList();
        return session;
    }
}
