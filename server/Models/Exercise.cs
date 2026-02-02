namespace server.Models;

public class Exercise
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
    public string? CreatedByUserId { get; set; }
}
