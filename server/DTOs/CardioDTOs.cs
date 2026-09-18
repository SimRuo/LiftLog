using System.ComponentModel.DataAnnotations;

namespace server.DTOs;

public class CardioActivityResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>"distance" or "time" — the client shows a distance field only for the former.</summary>
    public string Mode { get; set; } = string.Empty;

    public bool IsDefault { get; set; }

    /// <summary>
    /// When this activity was last logged, or null if never. The picker sorts
    /// on it so the two or three things actually done regularly float to the
    /// top instead of being hunted for in an alphabetical list.
    /// </summary>
    public DateTime? LastUsed { get; set; }

    /// <summary>
    /// The ordered stations, for circuits only. Empty for a plain activity —
    /// the client uses this to decide between the simple form and the
    /// station-by-station one.
    /// </summary>
    public List<CardioStepResponse> Steps { get; set; } = new();
}

public class CardioStepResponse
{
    public int Order { get; set; }
    public int ActivityId { get; set; }
    public string ActivityName { get; set; } = string.Empty;
    public int? TargetDistanceMeters { get; set; }
    public int? TargetReps { get; set; }
}

public class CreateCircuitRequest
{
    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required, MinLength(1)]
    public List<CreateCircuitStepRequest> Steps { get; set; } = new();
}

public class CreateCircuitStepRequest
{
    [Required]
    public int ActivityId { get; set; }

    [Range(0, 1000000)]
    public int? TargetDistanceMeters { get; set; }

    [Range(0, 100000)]
    public int? TargetReps { get; set; }
}

public class CardioSegmentResponse
{
    public int Order { get; set; }
    public int CardioActivityId { get; set; }
    public string ActivityName { get; set; } = string.Empty;
    public int? DurationSeconds { get; set; }
    public int? DistanceMeters { get; set; }
    public int? Reps { get; set; }
}

public class CreateCardioSegmentRequest
{
    [Required]
    public int CardioActivityId { get; set; }

    [Range(1, 86400)]
    public int? DurationSeconds { get; set; }

    [Range(0, 1000000)]
    public int? DistanceMeters { get; set; }

    [Range(0, 100000)]
    public int? Reps { get; set; }
}

/// <summary>One logged run at a circuit, with whatever splits were filled in.</summary>
public class CircuitAttemptResponse
{
    public int SessionId { get; set; }
    public DateTime Date { get; set; }
    public int DurationSeconds { get; set; }
    public byte? Rpe { get; set; }
    public List<CardioSegmentResponse> Segments { get; set; } = new();
}

public class CreateCardioActivityRequest
{
    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required, RegularExpression("^(distance|time)$")]
    public string Mode { get; set; } = string.Empty;
}

public class CreateCardioSessionRequest
{
    [Required]
    public int CardioActivityId { get; set; }

    [Required]
    public DateTime Date { get; set; }

    /// <summary>Capped at 24 hours — past that it's a typo, not a session.</summary>
    [Required, Range(1, 86400)]
    public int DurationSeconds { get; set; }

    /// <summary>Whole metres. Null for time-mode activities.</summary>
    [Range(0, 1000000)]
    public int? DistanceMeters { get; set; }

    [Range(1, 10)]
    public byte? Rpe { get; set; }

    public string? Notes { get; set; }

    /// <summary>
    /// Station-by-station detail, for a circuit. Ordered by position in the
    /// list. Splits inside may be null — the session's own duration is the
    /// number that has to be there.
    /// </summary>
    public List<CreateCardioSegmentRequest> Segments { get; set; } = new();
}

public class CardioSessionResponse
{
    public int Id { get; set; }
    public int CardioActivityId { get; set; }
    public string ActivityName { get; set; } = string.Empty;
    public string ActivityMode { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public int DurationSeconds { get; set; }
    public int? DistanceMeters { get; set; }
    public byte? Rpe { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<CardioSegmentResponse> Segments { get; set; } = new();
}

/// <summary>
/// One point on a cardio progress chart. `Value`'s unit depends on the metric
/// asked for: seconds per kilometre for pace, metres for distance, seconds for
/// duration, and the raw 1-10 figure for effort.
/// </summary>
public class CardioProgressPoint
{
    public DateTime Date { get; set; }
    public double Value { get; set; }
}
