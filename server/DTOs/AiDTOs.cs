namespace server.DTOs;

public class GeneratePlanRequest
{
    public string Description { get; set; } = string.Empty;
}

/// <summary>
/// Returned by both the enqueue call and every poll, so the client has one
/// shape to handle. `Plan` is populated only once Status is "done".
/// </summary>
public class PlanJobResponse
{
    public string Id { get; set; } = string.Empty;

    /// <summary>queued | running | done | failed</summary>
    public string Status { get; set; } = string.Empty;

    public double ElapsedSeconds { get; set; }
    public CreatePlanRequest? Plan { get; set; }
    public string? Error { get; set; }
}
