using System.Data;
using System.Security.Claims;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using server.DTOs;
using server.Models;

namespace server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CardioController : ControllerBase
{
    private readonly IDbConnection _db;
    public CardioController(IDbConnection db) => _db = db;
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    /// <summary>
    /// The activity list, most recently used first. Defaults are shared;
    /// anything custom is only ever visible to whoever made it.
    /// </summary>
    [HttpGet("activities")]
    public async Task<ActionResult<List<CardioActivityResponse>>> GetActivities()
    {
        var activities = await _db.QueryAsync<CardioActivityResponse>(
            @"SELECT a.Id, a.Name, a.Mode, a.IsDefault,
                     (SELECT MAX(cs.Date) FROM CardioSessions cs
                       WHERE cs.CardioActivityId = a.Id AND cs.UserId = @UserId) AS LastUsed
              FROM CardioActivities a
              WHERE a.IsDefault = 1 OR a.CreatedByUserId = @UserId
              ORDER BY a.Name",
            new { UserId });

        // Ordered here rather than in SQL so the null case reads plainly:
        // never-used activities keep their alphabetical order behind the rest.
        var ordered = activities
            .OrderByDescending(a => a.LastUsed.HasValue)
            .ThenByDescending(a => a.LastUsed)
            .ThenBy(a => a.Name)
            .ToList();

        // One query for every circuit's steps rather than one per circuit.
        // There are only ever a handful of circuits, but a query inside the
        // loop would still be a query inside a loop.
        var circuitIds = ordered
            .Where(a => a.Mode == CardioMode.Circuit)
            .Select(a => a.Id)
            .ToList();

        if (circuitIds.Count > 0)
        {
            var steps = await _db.QueryAsync<CardioStepResponse, int, (CardioStepResponse Step, int Owner)>(
                @"SELECT st.Name AS ActivityName, s.[Order], s.StepActivityId AS ActivityId,
                         s.TargetDistanceMeters, s.TargetReps, s.CardioActivityId
                  FROM CardioActivitySteps s
                  INNER JOIN CardioActivities st ON st.Id = s.StepActivityId
                  WHERE s.CardioActivityId IN @circuitIds
                  ORDER BY s.CardioActivityId, s.[Order]",
                (step, owner) => (step, owner),
                new { circuitIds },
                splitOn: "CardioActivityId");

            var byCircuit = steps
                .GroupBy(x => x.Owner)
                .ToDictionary(g => g.Key, g => g.Select(x => x.Step).ToList());

            foreach (var circuit in ordered.Where(a => byCircuit.ContainsKey(a.Id)))
                circuit.Steps = byCircuit[circuit.Id];
        }

        return Ok(ordered);
    }

    /// <summary>
    /// Adds a custom activity, or hands back the existing one where the name is
    /// already taken — same forgiving behaviour as CreateExercise, so a double
    /// tap can't produce a duplicate or an error.
    /// </summary>
    [HttpPost("activities")]
    public async Task<ActionResult<CardioActivityResponse>> CreateActivity(CreateCardioActivityRequest request)
    {
        var name = request.Name.Trim();
        if (name.Length == 0) return BadRequest("An activity needs a name.");
        if (!CardioMode.IsValid(request.Mode)) return BadRequest("Unknown activity mode.");

        var existing = await _db.QueryFirstOrDefaultAsync<CardioActivityResponse>(
            "SELECT Id, Name, Mode, IsDefault FROM CardioActivities WHERE Name = @name",
            new { name });
        if (existing != null) return Ok(existing);

        var id = await _db.QuerySingleAsync<int>(
            @"INSERT INTO CardioActivities (Name, Mode, IsDefault, CreatedByUserId)
              OUTPUT INSERTED.Id
              VALUES (@name, @Mode, 0, @UserId)",
            new { name, request.Mode, UserId });

        return Ok(new CardioActivityResponse
        {
            Id = id, Name = name, Mode = request.Mode, IsDefault = false,
        });
    }

    /// <summary>
    /// Creates a circuit and its ordered stations in one go.
    ///
    /// Separate from CreateActivity because a circuit is only meaningful with
    /// its steps — half a circuit isn't a thing worth persisting, so the two
    /// writes share a transaction.
    /// </summary>
    [HttpPost("circuits")]
    public async Task<ActionResult<CardioActivityResponse>> CreateCircuit(CreateCircuitRequest request)
    {
        var name = request.Name.Trim();
        if (name.Length == 0) return BadRequest("A circuit needs a name.");

        var taken = await _db.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM CardioActivities WHERE Name = @name", new { name });
        if (taken > 0) return BadRequest($"\"{name}\" already exists — pick another name.");

        // Every station has to be one this user can actually see, or a circuit
        // could be built out of another account's custom activities.
        var stepIds = request.Steps.Select(x => x.ActivityId).Distinct().ToList();
        var valid = await _db.QueryAsync<int>(
            @"SELECT Id FROM CardioActivities
              WHERE Id IN @stepIds AND Mode <> 'circuit'
                AND (IsDefault = 1 OR CreatedByUserId = @UserId)",
            new { stepIds, UserId });

        if (valid.Count() != stepIds.Count)
            return BadRequest("One of those stations doesn't exist.");

        if (_db.State != ConnectionState.Open) _db.Open();
        using var tx = _db.BeginTransaction();

        var id = await _db.QuerySingleAsync<int>(
            @"INSERT INTO CardioActivities (Name, Mode, IsDefault, CreatedByUserId)
              OUTPUT INSERTED.Id
              VALUES (@name, 'circuit', 0, @UserId)",
            new { name, UserId }, tx);

        await _db.ExecuteAsync(
            @"INSERT INTO CardioActivitySteps
                  (CardioActivityId, [Order], StepActivityId, TargetDistanceMeters, TargetReps)
              VALUES (@id, @Order, @ActivityId, @TargetDistanceMeters, @TargetReps)",
            request.Steps.Select((step, index) => new
            {
                id,
                Order = index,
                step.ActivityId,
                step.TargetDistanceMeters,
                step.TargetReps,
            }),
            tx);

        tx.Commit();

        return Ok(new CardioActivityResponse
        {
            Id = id, Name = name, Mode = CardioMode.Circuit, IsDefault = false,
            Steps = await QuerySteps(id),
        });
    }

    /// <summary>
    /// Recent attempts at one circuit, newest first, each with its splits.
    ///
    /// This is what makes a circuit worth logging: total time says whether you
    /// got faster, the splits say which station it came from.
    /// </summary>
    [HttpGet("circuits/{activityId:int}/attempts")]
    public async Task<ActionResult<List<CircuitAttemptResponse>>> GetAttempts(
        int activityId, [FromQuery] int take = 5)
    {
        take = Math.Clamp(take, 1, 20);

        var attempts = (await _db.QueryAsync<CircuitAttemptResponse>(
            @"SELECT TOP (@take) Id AS SessionId, Date, DurationSeconds, Rpe
              FROM CardioSessions
              WHERE CardioActivityId = @activityId AND UserId = @UserId
              ORDER BY Date DESC, CreatedAt DESC",
            new { take, activityId, UserId })).ToList();

        if (attempts.Count == 0) return Ok(attempts);

        var sessionIds = attempts.Select(a => a.SessionId).ToList();
        var segments = await _db.QueryAsync<CardioSegmentResponse, int, (CardioSegmentResponse Seg, int Session)>(
            @"SELECT a.Name AS ActivityName, seg.[Order], seg.CardioActivityId,
                     seg.DurationSeconds, seg.DistanceMeters, seg.Reps, seg.CardioSessionId
              FROM CardioSegments seg
              INNER JOIN CardioActivities a ON a.Id = seg.CardioActivityId
              WHERE seg.CardioSessionId IN @sessionIds
              ORDER BY seg.CardioSessionId, seg.[Order]",
            (seg, session) => (seg, session),
            new { sessionIds },
            splitOn: "CardioSessionId");

        var bySession = segments
            .GroupBy(x => x.Session)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Seg).ToList());

        foreach (var attempt in attempts)
            if (bySession.TryGetValue(attempt.SessionId, out var found))
                attempt.Segments = found;

        return Ok(attempts);
    }

    [HttpGet]
    public async Task<ActionResult<PaginatedResponse<CardioSessionResponse>>> GetSessions(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var offset = (page - 1) * pageSize;

        var total = await _db.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM CardioSessions WHERE UserId = @UserId",
            new { UserId });

        var items = await _db.QueryAsync<CardioSessionResponse>(
            @"SELECT cs.Id, cs.CardioActivityId, a.Name AS ActivityName, a.Mode AS ActivityMode,
                     cs.Date, cs.DurationSeconds, cs.DistanceMeters, cs.Rpe, cs.Notes, cs.CreatedAt
              FROM CardioSessions cs
              INNER JOIN CardioActivities a ON a.Id = cs.CardioActivityId
              WHERE cs.UserId = @UserId
              ORDER BY cs.Date DESC, cs.CreatedAt DESC
              OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY",
            new { UserId, Offset = offset, PageSize = pageSize });

        return Ok(new PaginatedResponse<CardioSessionResponse>
        {
            Items = items.ToList(), TotalCount = total, Page = page, PageSize = pageSize,
        });
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CardioSessionResponse>> GetSession(int id)
    {
        var session = await QuerySession(id);
        return session is null ? NotFound() : Ok(session);
    }

    [HttpPost]
    public async Task<ActionResult<CardioSessionResponse>> CreateSession(CreateCardioSessionRequest request)
    {
        var activity = await _db.QueryFirstOrDefaultAsync<CardioActivity>(
            @"SELECT Id, Name, Mode FROM CardioActivities
              WHERE Id = @CardioActivityId AND (IsDefault = 1 OR CreatedByUserId = @UserId)",
            new { request.CardioActivityId, UserId });

        if (activity is null) return BadRequest("That activity doesn't exist.");

        // A distance on a time-mode activity is meaningless and would put a
        // bogus pace on the chart, so it's dropped rather than stored.
        var distance = activity.Mode == CardioMode.Distance ? request.DistanceMeters : null;

        if (_db.State != ConnectionState.Open) _db.Open();
        using var tx = _db.BeginTransaction();

        var id = await _db.QuerySingleAsync<int>(
            @"INSERT INTO CardioSessions
                  (UserId, CardioActivityId, Date, DurationSeconds, DistanceMeters, Rpe, Notes, CreatedAt)
              OUTPUT INSERTED.Id
              VALUES (@UserId, @CardioActivityId, @Date, @DurationSeconds, @distance, @Rpe, @Notes, SYSUTCDATETIME())",
            new
            {
                UserId, request.CardioActivityId, request.Date, request.DurationSeconds,
                distance, request.Rpe, request.Notes,
            },
            tx);

        // Segments only mean anything on a circuit; on a plain activity they'd
        // be an unordered echo of the session itself.
        if (activity.Mode == CardioMode.Circuit && request.Segments.Count > 0)
        {
            await _db.ExecuteAsync(
                @"INSERT INTO CardioSegments
                      (CardioSessionId, [Order], CardioActivityId, DurationSeconds, DistanceMeters, Reps)
                  VALUES (@id, @Order, @CardioActivityId, @DurationSeconds, @DistanceMeters, @Reps)",
                request.Segments.Select((segment, index) => new
                {
                    id,
                    Order = index,
                    segment.CardioActivityId,
                    segment.DurationSeconds,
                    segment.DistanceMeters,
                    segment.Reps,
                }),
                tx);
        }

        tx.Commit();

        return CreatedAtAction(nameof(GetSession), new { id }, await QuerySession(id));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteSession(int id)
    {
        var rows = await _db.ExecuteAsync(
            "DELETE FROM CardioSessions WHERE Id = @id AND UserId = @UserId",
            new { id, UserId });

        return rows == 0 ? NotFound() : NoContent();
    }

    /// <summary>
    /// One value per day for a single activity.
    ///
    /// Pace is the headline for anything that covers ground, and it's the one
    /// metric here where lower is better — the client says so on the axis. It
    /// deliberately ignores sessions with no distance recorded rather than
    /// treating them as zero, which would drop a spike to the floor.
    /// </summary>
    [HttpGet("progress/{activityId:int}")]
    public async Task<ActionResult<List<CardioProgressPoint>>> GetProgress(
        int activityId, [FromQuery] string metric = "pace")
    {
        // Whitelisted rather than interpolated freely — this goes into the SQL text.
        var (aggregate, filter) = metric switch
        {
            "distance" => ("MAX(CAST(cs.DistanceMeters AS FLOAT))", "AND cs.DistanceMeters > 0"),
            "duration" => ("SUM(CAST(cs.DurationSeconds AS FLOAT))", ""),
            "effort" => ("AVG(CAST(cs.Rpe AS FLOAT))", "AND cs.Rpe IS NOT NULL"),
            // Best attempt of the day, not the sum — two runs at a circuit are
            // two results, and adding them together would be meaningless.
            "total" => ("MIN(CAST(cs.DurationSeconds AS FLOAT))", ""),
            _ => ("SUM(CAST(cs.DurationSeconds AS FLOAT)) / (SUM(CAST(cs.DistanceMeters AS FLOAT)) / 1000.0)",
                  "AND cs.DistanceMeters > 0"),
        };

        var points = await _db.QueryAsync<CardioProgressPoint>(
            $@"SELECT CAST(cs.Date AS DATE) AS Date, {aggregate} AS Value
               FROM CardioSessions cs
               WHERE cs.CardioActivityId = @activityId AND cs.UserId = @UserId {filter}
               GROUP BY CAST(cs.Date AS DATE)
               ORDER BY CAST(cs.Date AS DATE)",
            new { activityId, UserId });

        return Ok(points.ToList());
    }

    private async Task<List<CardioStepResponse>> QuerySteps(int circuitId) =>
        (await _db.QueryAsync<CardioStepResponse>(
            @"SELECT s.[Order], s.StepActivityId AS ActivityId, st.Name AS ActivityName,
                     s.TargetDistanceMeters, s.TargetReps
              FROM CardioActivitySteps s
              INNER JOIN CardioActivities st ON st.Id = s.StepActivityId
              WHERE s.CardioActivityId = @circuitId
              ORDER BY s.[Order]",
            new { circuitId })).ToList();

    private async Task<CardioSessionResponse?> QuerySession(int id)
    {
        var session = await QuerySessionRow(id);
        if (session is null) return session;

        session.Segments = (await _db.QueryAsync<CardioSegmentResponse>(
            @"SELECT seg.[Order], seg.CardioActivityId, a.Name AS ActivityName,
                     seg.DurationSeconds, seg.DistanceMeters, seg.Reps
              FROM CardioSegments seg
              INNER JOIN CardioActivities a ON a.Id = seg.CardioActivityId
              WHERE seg.CardioSessionId = @id
              ORDER BY seg.[Order]",
            new { id })).ToList();

        return session;
    }

    private Task<CardioSessionResponse?> QuerySessionRow(int id) =>
        _db.QueryFirstOrDefaultAsync<CardioSessionResponse>(
            @"SELECT cs.Id, cs.CardioActivityId, a.Name AS ActivityName, a.Mode AS ActivityMode,
                     cs.Date, cs.DurationSeconds, cs.DistanceMeters, cs.Rpe, cs.Notes, cs.CreatedAt
              FROM CardioSessions cs
              INNER JOIN CardioActivities a ON a.Id = cs.CardioActivityId
              WHERE cs.Id = @id AND cs.UserId = @UserId",
            new { id, UserId });
}
