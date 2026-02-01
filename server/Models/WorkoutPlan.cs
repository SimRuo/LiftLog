using Microsoft.AspNetCore.Identity;

namespace server.Models;

public class WorkoutPlan
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public IdentityUser User { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<PlanDay> Days { get; set; } = new List<PlanDay>();
}
