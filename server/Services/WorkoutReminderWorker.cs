using System.Data;
using Dapper;
using Microsoft.Extensions.Options;

namespace server.Services;

/// <summary>
/// Nudges anyone whose workout has been open unreasonably long.
///
/// The case this exists for: you finish the last set, put the phone away, and
/// never tap Finish. Nothing is lost — the draft is safe in localStorage — but
/// the session stays unlogged, and by the time you remember, the elapsed clock
/// is meaningless. A timer in the page can't cover it, because by hour three
/// the tab has long since been discarded; only something server-side can.
///
/// Rows come from the device (see WorkoutsController.BeginActiveWorkout) and go
/// away the moment the workout is saved, rested, or discarded.
///
/// Like PlanGenerationWorker, every dependency below the singleton line is
/// resolved from a fresh scope per pass — there is no request scope out here to
/// borrow an IDbConnection from.
/// </summary>
public class WorkoutReminderWorker : BackgroundService
{
    private readonly PushSender _push;
    private readonly PushOptions _options;
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<WorkoutReminderWorker> _log;

    public WorkoutReminderWorker(
        PushSender push,
        IOptions<PushOptions> options,
        IServiceScopeFactory scopes,
        ILogger<WorkoutReminderWorker> log)
        => (_push, _options, _scopes, _log) = (push, options.Value, scopes, log);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_push.Enabled)
        {
            _log.LogInformation(
                "Workout reminders are off — no VAPID keys configured (Push:PublicKey / Push:PrivateKey)");
            return;
        }

        _log.LogInformation(
            "Workout reminders on: first nudge after {Hours}h, repeating every {Repeat}h, {Max} at most",
            _options.RemindAfterHours, _options.RepeatEveryHours, _options.MaxReminders);

        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(_options.ScanIntervalMinutes));
        do
        {
            try
            {
                await ScanAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                // A bad pass must not take the loop down with it — the next one
                // is only a few minutes away and will very likely succeed.
                _log.LogError(ex, "Workout reminder scan failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ScanAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IDbConnection>();

        // Two clocks, not one: the first nudge is measured from when the workout
        // started, every later one from the previous nudge. Both are evaluated
        // in SQL so a worker restart can't re-send anything already sent.
        var due = (await db.QueryAsync<DueReminder>(new CommandDefinition(
            @"SELECT UserId, StartedAt, Reminders
              FROM ActiveWorkouts
              WHERE Reminders < @MaxReminders
                AND (
                    (RemindedAt IS NULL
                        AND StartedAt <= DATEADD(HOUR, -@RemindAfterHours, SYSUTCDATETIME()))
                 OR (RemindedAt IS NOT NULL
                        AND RemindedAt <= DATEADD(HOUR, -@RepeatEveryHours, SYSUTCDATETIME()))
                )",
            new { _options.MaxReminders, _options.RemindAfterHours, _options.RepeatEveryHours },
            cancellationToken: ct))).ToList();

        foreach (var reminder in due)
        {
            var hours = (int)Math.Round((DateTime.UtcNow - reminder.StartedAt).TotalHours);
            var payload = new PushPayload(
                Title: "Still training?",
                Body: $"Your workout has been open for {hours} hours. Finish it if you're done — "
                    + "otherwise the sets stay unlogged.",
                // One tag for the feature, so a second nudge replaces the first
                // in the shade instead of stacking up next to it.
                Tag: "workout-open",
                Url: "/log");

            var delivered = await _push.SendToUserAsync(db, reminder.UserId, payload, ct);

            // Counted even when nothing was delivered. If a user has no working
            // subscription left, retrying on every pass forever just burns the
            // scan; the cap should retire the row either way.
            await db.ExecuteAsync(new CommandDefinition(
                @"UPDATE ActiveWorkouts
                  SET RemindedAt = SYSUTCDATETIME(), Reminders = Reminders + 1
                  WHERE UserId = @UserId",
                new { reminder.UserId },
                cancellationToken: ct));

            _log.LogInformation(
                "Nudged {UserId} about a {Hours}h-old workout ({Delivered} device(s), nudge {N}/{Max})",
                reminder.UserId, hours, delivered, reminder.Reminders + 1, _options.MaxReminders);
        }

        // Rows for workouts nobody ever closed. The reminder cap already stopped
        // the nudging; this just stops the table growing without bound.
        var stale = await db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM ActiveWorkouts WHERE StartedAt <= DATEADD(DAY, -2, SYSUTCDATETIME())",
            cancellationToken: ct));
        if (stale > 0) _log.LogInformation("Cleared {Count} abandoned active workout(s)", stale);
    }

    private class DueReminder
    {
        public string UserId { get; set; } = string.Empty;
        public DateTime StartedAt { get; set; }
        public int Reminders { get; set; }
    }
}
