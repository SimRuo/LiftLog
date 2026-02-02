namespace server.Data;

public class PlanDayRow
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Order { get; set; }
    public List<PlanExerciseRow> Exercises { get; set; } = new();
}

public class PlanExerciseRow
{
    public int Id { get; set; }
    public int ExerciseId { get; set; }
    public string ExerciseName { get; set; } = string.Empty;
    public string ExerciseCategory { get; set; } = string.Empty;
    public int Order { get; set; }
    public int Sets { get; set; }
    public string Reps { get; set; } = string.Empty;
    public decimal Weight { get; set; }
    public string? Notes { get; set; }
}
