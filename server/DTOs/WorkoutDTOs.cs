using System.ComponentModel.DataAnnotations;

namespace server.DTOs;

public class CreateWorkoutRequest
{
    [Required]
    public DateTime Date { get; set; }
    public string? Notes { get; set; }
    public int? PlanDayId { get; set; }

    [Required, MinLength(1)]
    public List<CreateSetRequest> Sets { get; set; } = new();
}

public class LogRestDayRequest
{
    [Required]
    public DateTime Date { get; set; }
    public string? Notes { get; set; }
    public int? PlanDayId { get; set; }
}

public class CreateSetRequest
{
    [Required]
    public int ExerciseId { get; set; }

    [Required, Range(1, 100)]
    public int SetNumber { get; set; }

    [Required, Range(0, 9999)]
    public int Reps { get; set; }

    [Required, Range(0, 99999)]
    public decimal Weight { get; set; }

    public string? Notes { get; set; }
}

public class WorkoutSummaryResponse
{
    public int Id { get; set; }
    public DateTime Date { get; set; }
    public string? Notes { get; set; }
    public int ExerciseCount { get; set; }
    public int SetCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? PlanDayName { get; set; }
    public bool IsRestDay { get; set; }
}

public class WorkoutDetailResponse
{
    public int Id { get; set; }
    public DateTime Date { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? PlanDayName { get; set; }
    public bool IsRestDay { get; set; }
    public List<WorkoutSetResponse> Sets { get; set; } = new();
}

public class WorkoutSetResponse
{
    public int Id { get; set; }
    public int ExerciseId { get; set; }
    public string ExerciseName { get; set; } = string.Empty;
    public string ExerciseCategory { get; set; } = string.Empty;
    public int SetNumber { get; set; }
    public int Reps { get; set; }
    public decimal Weight { get; set; }
    public string? Notes { get; set; }
}

public class PaginatedResponse<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}
