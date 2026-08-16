using System.Data;
using Dapper;

namespace server.Services;

/// <summary>
/// Drains the plan queue, one generation at a time, for the life of the process.
///
/// Everything the job needs is resolved from a fresh DI scope here rather than
/// captured from the request that enqueued it — that request returned its 202
/// long ago and its scope, along with the scoped IDbConnection, is gone.
/// </summary>
public class PlanGenerationWorker : BackgroundService
{
    private readonly PlanJobStore _store;
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<PlanGenerationWorker> _log;

    public PlanGenerationWorker(
        PlanJobStore store,
        IServiceScopeFactory scopes,
        ILogger<PlanGenerationWorker> log)
        => (_store, _scopes, _log) = (store, scopes, log);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var id in _store.Reader.ReadAllAsync(stoppingToken))
        {
            var job = _store.Get(id);
            if (job is null) continue;

            job.Status = PlanJobStatus.Running;
            job.StartedAt = DateTimeOffset.UtcNow;

            try
            {
                job.Plan = await Generate(job, stoppingToken);
                job.Status = job.Plan is null ? PlanJobStatus.Failed : PlanJobStatus.Done;
                job.Error = job.Plan is null
                    ? "The model returned nothing usable. Try rephrasing the request."
                    : null;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Shutting down. Leave the job unfinished; the client will see
                // it disappear on the next poll and can ask again.
                _log.LogInformation("Plan job {Id} abandoned — host is stopping", job.Id);
                throw;
            }
            catch (TaskCanceledException)
            {
                job.Status = PlanJobStatus.Failed;
                job.Error = "The model took too long to respond. It may still be loading — try again shortly.";
                _log.LogError("Plan job {Id} timed out", job.Id);
            }
            catch (Exception ex)
            {
                job.Status = PlanJobStatus.Failed;
                job.Error = ex is HttpRequestException
                    ? ex.Message
                    : "Plan generation failed. Check the server logs.";
                _log.LogError(ex, "Plan job {Id} failed", job.Id);
            }
            finally
            {
                job.CompletedAt = DateTimeOffset.UtcNow;
            }

            _log.LogInformation(
                "Plan job {Id} finished as {Status} in {Seconds:F1}s",
                job.Id, job.Status, job.ElapsedSeconds);
        }
    }

    private async Task<DTOs.CreatePlanRequest?> Generate(PlanJob job, CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IDbConnection>();
        var generator = scope.ServiceProvider.GetRequiredService<IPlanGenerator>();
        var resolver = scope.ServiceProvider.GetRequiredService<ExerciseResolver>();

        var catalogue = (await db.QueryAsync<ExerciseInfo>(
            new CommandDefinition(
                @"SELECT Id, Name, Category FROM Exercises
                  WHERE IsDefault = 1 OR CreatedByUserId = @UserId
                  ORDER BY Category, Name",
                new { job.UserId },
                cancellationToken: ct))).ToList();

        // The model works in names; turning those into ids — and creating the
        // ones that don't exist yet — happens here, deterministically.
        var generated = await generator.GeneratePlan(job.Description, catalogue);
        if (generated is null) return null;

        var plan = await resolver.ResolveAsync(generated, job.UserId, ct);
        return PlanNormaliser.Normalise(plan);
    }
}
