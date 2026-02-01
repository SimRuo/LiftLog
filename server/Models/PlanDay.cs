namespace server.Models;

public class PlanDay
{
    public int Id { get; set; }
    public int WorkoutPlanId { get; set; }
    public WorkoutPlan WorkoutPlan { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public int Order { get; set; }
    public ICollection<PlanExercise> Exercises { get; set; } = new List<PlanExercise>();
}
