namespace server.Models;

public class CardioSession
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public int CardioActivityId { get; set; }
    public DateTime Date { get; set; }
    public int DurationSeconds { get; set; }
    public int? DistanceMeters { get; set; }
    public byte? Rpe { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
}
