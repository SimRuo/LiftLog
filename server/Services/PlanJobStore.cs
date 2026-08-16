using System.Collections.Concurrent;
using System.Threading.Channels;

namespace server.Services;

/// <summary>
/// The queue of plan generations, and the record of finished ones.
///
/// The channel is deliberately consumed by exactly one worker. The box has
/// four cores and no GPU, so two generations running at once wouldn't be twice
/// as fast — they would contend for the same memory bandwidth and both take
/// far longer than they would in sequence, while starving SQL Server. Queuing
/// is the honest behaviour.
/// </summary>
public class PlanJobStore
{
    /// <summary>How long a finished job stays readable before it's swept.</summary>
    private static readonly TimeSpan Retention = TimeSpan.FromMinutes(30);

    private readonly ConcurrentDictionary<Guid, PlanJob> _jobs = new();
    private readonly Channel<Guid> _queue = Channel.CreateUnbounded<Guid>(
        new UnboundedChannelOptions { SingleReader = true });

    public ChannelReader<Guid> Reader => _queue.Reader;

    /// <summary>
    /// Enqueue a generation, or hand back the one already in flight.
    ///
    /// One active job per user, because the obvious failure here is an
    /// impatient double-tap turning a two-minute wait into a four-minute one.
    /// </summary>
    public PlanJob Enqueue(string userId, string description)
    {
        Prune();

        var existing = _jobs.Values.FirstOrDefault(j => j.UserId == userId && !j.IsFinished);
        if (existing is not null) return existing;

        var job = new PlanJob { Id = Guid.NewGuid(), UserId = userId, Description = description };
        _jobs[job.Id] = job;
        _queue.Writer.TryWrite(job.Id);
        return job;
    }

    public PlanJob? Get(Guid id) => _jobs.GetValueOrDefault(id);

    /// <summary>Scoped to the owner so a job id is not a readable handle for anyone who guesses it.</summary>
    public PlanJob? GetForUser(Guid id, string userId)
    {
        var job = Get(id);
        return job?.UserId == userId ? job : null;
    }

    private void Prune()
    {
        var cutoff = DateTimeOffset.UtcNow - Retention;
        foreach (var (id, job) in _jobs)
        {
            if (job.IsFinished && job.CompletedAt < cutoff)
                _jobs.TryRemove(id, out _);
        }
    }
}
