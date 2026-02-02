namespace server.Models;

public class PlanDay
{
    public int Id { get; set; }
    public int WorkoutPlanId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Order { get; set; }
}
