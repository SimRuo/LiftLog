using System.ComponentModel.DataAnnotations;

namespace server.DTOs;

public class CreatePlanRequest
{
    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required, MinLength(1)]
    public List<CreatePlanDayRequest> Days { get; set; } = new();
}

public class CreatePlanDayRequest
{
    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    public int Order { get; set; }

    [Required, MinLength(1)]
    public List<CreatePlanExerciseRequest> Exercises { get; set; } = new();
}

public class CreatePlanExerciseRequest
{
    [Required]
    public int ExerciseId { get; set; }

    /// <summary>
    /// Populated on the way out of plan generation; ignored on the way in.
    ///
    /// Generation can create exercises, so the id alone is not enough for a
    /// client whose catalogue predates them — it would render "Exercise #1051".
    /// The resolver has just looked these up, so sending them costs nothing and
    /// removes the client's dependency on having a fresh catalogue.
    /// </summary>
    public string? ExerciseName { get; set; }
    public string? ExerciseCategory { get; set; }

    public int Order { get; set; }

    [Required, Range(1, 20)]
    public int Sets { get; set; }

    [Required, MaxLength(20)]
    public string Reps { get; set; } = string.Empty;

    [Range(0, 99999)]
    public decimal Weight { get; set; }

    public string? Notes { get; set; }
}

public class PlanResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public bool IsActive { get; set; }
    public List<PlanDayResponse> Days { get; set; } = new();
}

public class PlanSummaryResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public bool IsActive { get; set; }
}

public class PlanDayResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Order { get; set; }
    public List<PlanExerciseResponse> Exercises { get; set; } = new();
}

public class PlanExerciseResponse
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
    public List<LastSessionSetData> LastSessionSets { get; set; } = new();
}

public class LastSessionSetData
{
    public int ExerciseId { get; set; }
    public int SetNumber { get; set; }
    public int Reps { get; set; }
    public decimal Weight { get; set; }
}

public class NextWorkoutResponse
{
    public int PlanDayId { get; set; }
    public string DayName { get; set; } = string.Empty;
    public int DayOrder { get; set; }
    public List<PlanExerciseResponse> Exercises { get; set; } = new();
}
