namespace server.Services;

/// <summary>
/// The JSON Schema describing a plan, with the exercise IDs baked in as an enum.
///
/// This is the whole reason a 4B model on a CPU is enough for this job. The
/// schema is compiled into a grammar that constrains the sampler, so:
///
///   - structurally invalid JSON is unreachable, rather than something we hope
///     for and retry on
///   - an exercise ID that isn't in the user's catalogue is unreachable, rather
///     than something we filter out afterwards and silently drop from the plan
///
/// What's left for the model is a selection problem — which of these forty
/// exercises, how many sets, what rep range — which is well within a small
/// model's ability. Asking it to also produce well-formed JSON from a prose
/// description of the shape, the way the Groq prompt does, is what would need
/// a 70B.
/// </summary>
public static class PlanSchema
{
    public static object Build(IEnumerable<int> exerciseIds)
    {
        var ids = exerciseIds.ToArray();

        return new
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
                                    required = new[] { "exerciseId", "sets", "reps" },
                                    properties = new
                                    {
                                        // The constraint that matters most.
                                        exerciseId = new { type = "integer", @enum = ids },
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
}
