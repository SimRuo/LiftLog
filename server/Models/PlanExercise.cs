namespace server.Models;

public class PlanExercise
{
    public int Id { get; set; }
    public int PlanDayId { get; set; }
    public PlanDay PlanDay { get; set; } = null!;
    public int ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;
    public int Order { get; set; }
    public int Sets { get; set; }
    public string Reps { get; set; } = string.Empty;
    public decimal Weight { get; set; }
    public string? Notes { get; set; }
}
