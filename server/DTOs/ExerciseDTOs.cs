using System.ComponentModel.DataAnnotations;

namespace server.DTOs;

public class CreateExerciseRequest
{
    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string Category { get; set; } = string.Empty;
}

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
