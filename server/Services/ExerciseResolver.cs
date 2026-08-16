using System.Data;
using System.Text;
using Dapper;
using server.DTOs;

namespace server.Services;

/// <summary>
/// Turns the names a model produced into real exercise ids, creating the ones
/// that genuinely don't exist yet.
///
/// This is where the correctness that used to be asked of the model now lives.
/// A name either matches something in the catalogue — deterministically, and
/// debuggably — or it becomes a new exercise. Neither outcome can quietly
/// substitute one lift for another.
/// </summary>
public class ExerciseResolver
{
    private readonly IDbConnection _db;
    private readonly ILogger<ExerciseResolver> _log;

    public ExerciseResolver(IDbConnection db, ILogger<ExerciseResolver> log) => (_db, _log) = (db, log);

    /// <summary>
    /// Token-level expansions for the shorthand lifters actually write. Applied
    /// to both sides of the comparison, so they cost nothing when absent.
    /// Deliberately short: every entry is a chance to conflate two different
    /// lifts, so it covers only unambiguous abbreviations.
    /// </summary>
    private static readonly Dictionary<string, string> Aliases = new(StringComparer.Ordinal)
    {
        ["db"] = "dumbbell",
        ["bb"] = "barbell",
        ["ohp"] = "overhead press",
        ["rdl"] = "romanian deadlift",
        ["pressdown"] = "pushdown",
        ["ez"] = "ez bar",
    };

    /// <summary>
    /// Lowercase, reduce anything that isn't a letter or digit to a single
    /// space, singularise, then expand shorthand.
    ///
    /// This makes "Pull-ups", "Pull Ups" and "pull up" one key, and "Triceps
    /// pressdown" match the catalogue's "Tricep Pushdown" — the drift that
    /// otherwise turns a perfectly good match into a duplicate row. It stops
    /// well short of fuzzy matching: two genuinely different lifts must never
    /// collapse into one, so nothing here is edit-distance based.
    /// </summary>
    public static string Normalise(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return string.Empty;

        var sb = new StringBuilder(name.Length);
        var lastWasSpace = true; // suppresses a leading space
        foreach (var c in name.Trim().ToLowerInvariant())
        {
            if (char.IsLetterOrDigit(c))
            {
                sb.Append(c);
                lastWasSpace = false;
            }
            else if (!lastWasSpace)
            {
                sb.Append(' ');
                lastWasSpace = true;
            }
        }

        var tokens = sb.ToString()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(Singularise)
            .Select(t => Aliases.GetValueOrDefault(t, t));

        return string.Join(' ', tokens);
    }

    /// <summary>
    /// "raises" to "raise", "ups" to "up". Leaves "press" alone — a double-s
    /// ending is almost never a plural in this vocabulary.
    /// </summary>
    private static string Singularise(string token) =>
        token.Length > 2 && token[^1] == 's' && token[^2] != 's'
            ? token[..^1]
            : token;

    /// <summary>Second-chance key: "pullups" matches "pull ups".</summary>
    public static string Compact(string? name) => Normalise(name).Replace(" ", "");

    public async Task<CreatePlanRequest> ResolveAsync(
        GeneratedPlan generated, string userId, CancellationToken ct = default)
    {
        var catalogue = (await _db.QueryAsync<ExerciseInfo>(
            new CommandDefinition("SELECT Id, Name, Category FROM Exercises", cancellationToken: ct)))
            .ToList();

        // Built once per plan; later creations are added as we go so two days
        // asking for the same new exercise don't create it twice.
        var byName = new Dictionary<string, int>();
        var byCompact = new Dictionary<string, int>();
        var known = new Dictionary<int, ExerciseInfo>();
        foreach (var e in catalogue)
        {
            byName.TryAdd(Normalise(e.Name), e.Id);
            byCompact.TryAdd(Compact(e.Name), e.Id);
            known.TryAdd(e.Id, e);
        }

        var plan = new CreatePlanRequest { Name = generated.Name, Days = new List<CreatePlanDayRequest>() };

        foreach (var day in generated.Days)
        {
            var planDay = new CreatePlanDayRequest
            {
                Name = day.Name,
                Exercises = new List<CreatePlanExerciseRequest>()
            };

            foreach (var item in day.Exercises)
            {
                var id = await ResolveOne(item, userId, byName, byCompact, known, ct);
                if (id is null) continue;

                var info = known.GetValueOrDefault(id.Value);
                planDay.Exercises.Add(new CreatePlanExerciseRequest
                {
                    ExerciseId = id.Value,
                    ExerciseName = info?.Name,
                    ExerciseCategory = info?.Category,
                    Sets = item.Sets,
                    Reps = item.Reps,
                    Notes = item.Notes,
                });
            }

            plan.Days.Add(planDay);
        }

        return plan;
    }

    private async Task<int?> ResolveOne(
        GeneratedExercise item,
        string userId,
        Dictionary<string, int> byName,
        Dictionary<string, int> byCompact,
        Dictionary<int, ExerciseInfo> known,
        CancellationToken ct)
    {
        var key = Normalise(item.Exercise);
        if (key.Length == 0) return null;

        if (byName.TryGetValue(key, out var existing)) return existing;
        if (byCompact.TryGetValue(Compact(item.Exercise), out var compact)) return compact;

        var name = item.Exercise.Trim();
        if (name.Length > 100) name = name[..100];

        var category = PlanSchema.Categories.Contains(item.Category) ? item.Category : "Other";

        var id = await CreateExercise(name, category, userId, ct);
        _log.LogInformation("Created exercise {Name} ({Category}) while resolving a plan", name, category);

        byName[key] = id;
        byCompact[Compact(name)] = id;
        known[id] = new ExerciseInfo(id, name, category);
        return id;
    }

    private async Task<int> CreateExercise(string name, string category, string userId, CancellationToken ct)
    {
        try
        {
            return await _db.QuerySingleAsync<int>(new CommandDefinition(
                @"INSERT INTO Exercises (Name, Category, IsDefault, CreatedByUserId)
                  OUTPUT INSERTED.Id
                  VALUES (@Name, @Category, 0, @UserId)",
                new { Name = name, Category = category, UserId = userId },
                cancellationToken: ct));
        }
        catch (Microsoft.Data.SqlClient.SqlException ex) when (ex.Number is 2601 or 2627)
        {
            // Name is uniquely indexed. Losing the race is fine — the row we
            // wanted now exists, which is all we needed.
            return await _db.QuerySingleAsync<int>(new CommandDefinition(
                "SELECT Id FROM Exercises WHERE Name = @Name",
                new { Name = name },
                cancellationToken: ct));
        }
    }
}
