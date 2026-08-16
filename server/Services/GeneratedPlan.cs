namespace server.Services;

/// <summary>
/// A plan as the model expresses it — in exercise <em>names</em>, not ids.
///
/// The previous contract had the model pick an id from an enum of the user's
/// catalogue. That guaranteed a valid id but not a sensible one: when the
/// exercise the user asked for wasn't in the list, the grammar left no way to
/// say so and forced a wrong pick — back extension came back as Squat. And
/// even when the right id existed the model sometimes missed it, answering
/// "Barbell Row" with the id for Seated Cable Row.
///
/// Naming is the thing a language model is actually good at. Turning a name
/// into an id is then a deterministic server-side lookup that can't get it
/// wrong, and a name with no match becomes a new exercise instead of a
/// silently mangled one.
/// </summary>
public class GeneratedPlan
{
    public string Name { get; set; } = string.Empty;
    public List<GeneratedDay> Days { get; set; } = new();
}

public class GeneratedDay
{
    public string Name { get; set; } = string.Empty;
    public List<GeneratedExercise> Exercises { get; set; } = new();
}

public class GeneratedExercise
{
    /// <summary>Catalogue name where one fits, otherwise a new exercise to create.</summary>
    public string Exercise { get; set; } = string.Empty;

    /// <summary>Only consulted when the name is new. Constrained to the known categories.</summary>
    public string Category { get; set; } = string.Empty;

    public int Sets { get; set; }
    public string Reps { get; set; } = string.Empty;
    public string? Notes { get; set; }
}
