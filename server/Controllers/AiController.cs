using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using server.DTOs;
using server.Services;

namespace server.Controllers;

/// <summary>
/// Plan generation is asynchronous because it takes a minute or two on a CPU,
/// and a request held open that long is at the mercy of every proxy between the
/// phone and the process. Raising each of their timeouts in turn only works
/// until you meet one you don't control — Cloudflare caps origin responses at
/// 100s regardless of configuration. Here every request finishes in
/// milliseconds and no timeout anywhere is relevant.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AiController : ControllerBase
{
    private readonly PlanJobStore _jobs;
    public AiController(PlanJobStore jobs) => _jobs = jobs;

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    /// <summary>Queue a generation. Returns immediately with a job to poll.</summary>
    [HttpPost("generate-plan")]
    public ActionResult<PlanJobResponse> StartGeneratePlan(GeneratePlanRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Description))
            return BadRequest("Describe the plan you want.");

        var job = _jobs.Enqueue(UserId, request.Description.Trim());
        return Accepted(Describe(job));
    }

    /// <summary>
    /// Poll a generation. 404 covers both "never existed" and "expired or lost
    /// to a restart" — the client's response to either is the same: ask again.
    /// </summary>
    [HttpGet("generate-plan/{id}")]
    public ActionResult<PlanJobResponse> GetGeneratePlan(Guid id)
    {
        var job = _jobs.GetForUser(id, UserId);
        return job is null ? NotFound() : Ok(Describe(job));
    }

    private static PlanJobResponse Describe(PlanJob job) => new()
    {
        Id = job.Id.ToString(),
        Status = job.Status switch
        {
            PlanJobStatus.Queued => "queued",
            PlanJobStatus.Running => "running",
            PlanJobStatus.Done => "done",
            _ => "failed"
        },
        ElapsedSeconds = Math.Round(job.ElapsedSeconds, 1),
        Plan = job.Status == PlanJobStatus.Done ? job.Plan : null,
        Error = job.Status == PlanJobStatus.Failed ? job.Error : null,
    };
}
