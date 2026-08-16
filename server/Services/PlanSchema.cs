namespace server.Services;

/// <summary>
/// The JSON Schema describing a generated plan, compiled to a grammar that
/// constrains the sampler.
///
/// What it still guarantees: the response is structurally valid JSON with the
/// right keys, and every category is one the app knows about. That is what
/// lets a 4B model on a CPU do this job at all — it never has to spend tokens
/// getting braces right, and there is no parse-and-retry loop.
///
/// What it deliberately no longer constrains is which exercise. That used to
/// be an enum of catalogue ids, which made an invalid id impossible but a
/// *wrong* id mandatory whenever the exercise the user wanted wasn't in the
/// list. A free-text name can be resolved against the catalogue exactly, and
/// created when it genuinely is new — see <see cref="ExerciseResolver"/>.
/// </summary>
public static class PlanSchema
{
    public static readonly string[] Categories =
        ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core"];

    public static object Build() => new
    {
        type = "object",
        required = new[] { "name", "days" },
        properties = new
        {
            name = new { type = "string" },
            days = new
            {
                type = "array",
                minItems = 1,
                items = new
                {
                    type = "object",
                    required = new[] { "name", "exercises" },
                    properties = new
                    {
                        name = new { type = "string" },
                        exercises = new
                        {
                            type = "array",
                            minItems = 1,
                            items = new
                            {
                                type = "object",
                                required = new[] { "exercise", "category", "sets", "reps" },
                                properties = new
                                {
                                    exercise = new { type = "string" },
                                    category = new { type = "string", @enum = Categories },
                                    sets = new { type = "integer" },
                                    reps = new { type = "string" },
                                    notes = new { type = "string" }
                                }
                            }
                        }
                    }
                }
            }
        }
    };
}
