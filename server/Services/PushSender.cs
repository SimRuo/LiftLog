using System.Data;
using System.Net;
using System.Text.Json;
using Dapper;
using Lib.Net.Http.WebPush;
using Lib.Net.Http.WebPush.Authentication;
using Microsoft.Extensions.Options;
using WebPushSubscription = Lib.Net.Http.WebPush.PushSubscription;

namespace server.Services;

/// <summary>What a `push` event carries to the service worker.</summary>
public record PushPayload(string Title, string Body, string Tag, string Url);

/// <summary>
/// Delivers a payload to every browser a user has subscribed.
///
/// Singleton, because the VAPID token it signs is reusable for hours and
/// there's no reason to redo that ECDSA work per request. The HttpClient comes
/// from the factory per send so handler rotation still applies.
/// </summary>
public class PushSender
{
    private readonly IHttpClientFactory _clients;
    private readonly PushOptions _options;
    private readonly VapidAuthentication? _vapid;
    private readonly ILogger<PushSender> _log;

    private static readonly JsonSerializerOptions Json =
        new(JsonSerializerDefaults.Web);

    public PushSender(
        IHttpClientFactory clients,
        IOptions<PushOptions> options,
        ILogger<PushSender> log)
    {
        _clients = clients;
        _options = options.Value;
        _log = log;

        if (_options.IsConfigured)
        {
            _vapid = new VapidAuthentication(_options.PublicKey, _options.PrivateKey)
            {
                Subject = _options.Subject,
            };
        }
    }

    public bool Enabled => _vapid is not null;

    /// <summary>
    /// Pushes to all of a user's registered browsers. Returns how many were
    /// actually delivered to a push service.
    /// </summary>
    public async Task<int> SendToUserAsync(
        IDbConnection db, string userId, PushPayload payload, CancellationToken ct)
    {
        if (_vapid is null) return 0;

        var subscriptions = (await db.QueryAsync<PushSubscriptionRow>(
            new CommandDefinition(
                "SELECT Id, Endpoint, P256dh, Auth FROM PushSubscriptions WHERE UserId = @userId",
                new { userId },
                cancellationToken: ct))).ToList();

        if (subscriptions.Count == 0) return 0;

        var message = new PushMessage(JsonSerializer.Serialize(payload, Json))
        {
            // A nudge about a workout you left open is worth delivering late —
            // the phone may well have been asleep for the whole window.
            TimeToLive = 6 * 60 * 60,
            Urgency = PushMessageUrgency.Normal,
            // Collapses with any undelivered nudge already queued, so coming
            // back online doesn't unload four hours of backlog at once.
            Topic = payload.Tag,
        };

        using var http = _clients.CreateClient(nameof(PushSender));
        var client = new PushServiceClient(http) { DefaultAuthentication = _vapid };

        var delivered = 0;
        var dead = new List<int>();

        foreach (var row in subscriptions)
        {
            var subscription = new WebPushSubscription { Endpoint = row.Endpoint };
            subscription.SetKey(PushEncryptionKeyName.P256DH, row.P256dh);
            subscription.SetKey(PushEncryptionKeyName.Auth, row.Auth);

            try
            {
                await client.RequestPushMessageDeliveryAsync(subscription, message, ct);
                delivered++;
            }
            catch (PushServiceClientException ex) when (
                ex.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Gone)
            {
                // The browser dropped this subscription — uninstalled, site data
                // cleared, or the push service expired it. It will never work
                // again, so stop carrying it.
                dead.Add(row.Id);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // A push service being unreachable is not this user's problem,
                // and definitely not a reason to skip their other devices.
                _log.LogWarning(ex, "Push delivery failed for subscription {Id}", row.Id);
            }
        }

        if (dead.Count > 0)
        {
            await db.ExecuteAsync(new CommandDefinition(
                "DELETE FROM PushSubscriptions WHERE Id IN @dead",
                new { dead },
                cancellationToken: ct));
            _log.LogInformation("Dropped {Count} expired push subscription(s)", dead.Count);
        }

        return delivered;
    }

    private class PushSubscriptionRow
    {
        public int Id { get; set; }
        public string Endpoint { get; set; } = string.Empty;
        public string P256dh { get; set; } = string.Empty;
        public string Auth { get; set; } = string.Empty;
    }
}
