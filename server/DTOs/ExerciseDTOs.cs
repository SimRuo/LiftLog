namespace server.DTOs;

public class ExerciseResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
}

public class ExerciseByCategoryResponse
{
    public string Category { get; set; } = string.Empty;
    public List<ExerciseResponse> Exercises { get; set; } = new();
}
