using Microsoft.AspNetCore.Identity;

namespace server.Models;

public class WorkoutSession
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public IdentityUser User { get; set; } = null!;
    public DateTime Date { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<WorkoutSet> Sets { get; set; } = new List<WorkoutSet>();
}
