using server.DTOs;

namespace server.Services;

public enum PlanJobStatus
{
    Queued,
    Running,
    Done,
    Failed
}

/// <summary>
/// One plan generation, tracked across requests.
///
/// Held in memory rather than the database on purpose: a job is worth less
/// than the two minutes it takes to redo, nothing outside this process needs
/// to see one, and the app runs as a single instance. The trade is that a
/// backend restart loses in-flight jobs — the client treats a job that has
/// vanished as "gone, ask again", which is the same thing it would do if the
/// job had expired.
/// </summary>
public class PlanJob
{
    public required Guid Id { get; init; }
    public required string UserId { get; init; }
    public required string Description { get; init; }

    public PlanJobStatus Status { get; set; } = PlanJobStatus.Queued;
    public CreatePlanRequest? Plan { get; set; }
    public string? Error { get; set; }

    public DateTimeOffset CreatedAt { get; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    public bool IsFinished => Status is PlanJobStatus.Done or PlanJobStatus.Failed;

    public double ElapsedSeconds =>
        ((CompletedAt ?? DateTimeOffset.UtcNow) - (StartedAt ?? CreatedAt)).TotalSeconds;
}
