using server.DTOs;

namespace server.Services;

/// <summary>
/// Fills in the parts of a plan the model was deliberately not asked for, and
/// re-checks the parts it was.
/// </summary>
public static class PlanNormaliser
{
    /// <summary>
    /// Ordering comes from array position and weight is always 0, because the
    /// lifter supplies their own — asking a model generating at ten tokens a
    /// second to write those out would be pure latency.
    ///
    /// The ID filter and the set clamp are redundant under the Ollama path,
    /// where the grammar already guarantees valid IDs. They stay because the
    /// Groq path has no such guarantee, and because a validation failure in
    /// PlansController later is a far worse way to discover the problem.
    /// </summary>
    public static CreatePlanRequest Normalise(CreatePlanRequest plan, List<ExerciseInfo> exercises)
    {
        var validIds = exercises.Select(e => e.Id).ToHashSet();

        plan.Name = Truncate(plan.Name, 100, "Generated plan");
        plan.Days = plan.Days.Where(d => d.Exercises.Count > 0).ToList();

        for (var i = 0; i < plan.Days.Count; i++)
        {
            var day = plan.Days[i];
            day.Order = i;
            day.Name = Truncate(day.Name, 100, $"Day {i + 1}");
            day.Exercises = day.Exercises.Where(e => validIds.Contains(e.ExerciseId)).ToList();

            for (var j = 0; j < day.Exercises.Count; j++)
            {
                var ex = day.Exercises[j];
                ex.Order = j;
                ex.Sets = Math.Clamp(ex.Sets, 1, 20);
                ex.Reps = Truncate(ex.Reps, 20, "8");
                ex.Weight = 0;
                if (string.IsNullOrWhiteSpace(ex.Notes)) ex.Notes = null;
            }
        }

        // Days can empty out if everything in them was filtered.
        plan.Days = plan.Days.Where(d => d.Exercises.Count > 0).ToList();
        return plan;
    }

    private static string Truncate(string? value, int max, string fallback)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return fallback;
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }
}
