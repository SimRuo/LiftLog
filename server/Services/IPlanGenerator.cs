namespace server.Services;

public record ExerciseInfo(int Id, string Name, string Category);

/// <summary>
/// Turns a plain-language description ("6 day PPL, one hard set per exercise")
/// into a plan expressed in exercise names. Mapping those names onto real
/// catalogue rows is <see cref="ExerciseResolver"/>'s job, not the model's.
/// </summary>
public interface IPlanGenerator
{
    Task<GeneratedPlan?> GeneratePlan(string description, List<ExerciseInfo> catalogue);
}
