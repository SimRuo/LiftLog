using server.DTOs;

namespace server.Services;

public record ExerciseInfo(int Id, string Name, string Category);

/// <summary>
/// Turns a plain-language description ("6 day PPL, one hard set per exercise")
/// into a plan built only from exercises the user actually has.
/// </summary>
public interface IPlanGenerator
{
    Task<CreatePlanRequest?> GeneratePlan(string description, List<ExerciseInfo> exercises);
}
