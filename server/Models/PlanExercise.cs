namespace server.Models;

public class PlanExercise
{
    public int Id { get; set; }
    public int PlanDayId { get; set; }
    public int ExerciseId { get; set; }
    public int Order { get; set; }
    public int Sets { get; set; }
    public string Reps { get; set; } = string.Empty;
    public decimal Weight { get; set; }
    public string? Notes { get; set; }
}
