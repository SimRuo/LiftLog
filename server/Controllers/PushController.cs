using System.Data;
using System.Security.Claims;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using server.DTOs;
using server.Services;

namespace server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PushController : ControllerBase
{
    private readonly IDbConnection _db;
    private readonly PushOptions _options;
    private readonly PushSender _push;

    public PushController(IDbConnection db, IOptions<PushOptions> options, PushSender push)
        => (_db, _options, _push) = (db, options.Value, push);

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    /// <summary>
    /// The VAPID public key, or `enabled: false` where none is configured.
    /// Anonymous: it isn't a secret, and the client needs it to decide whether
    /// to render the toggle at all.
    /// </summary>
    [HttpGet("config")]
    [AllowAnonymous]
    public ActionResult<PushConfigResponse> GetConfig() => Ok(new PushConfigResponse
    {
        Enabled = _options.IsConfigured,
        PublicKey = _options.IsConfigured ? _options.PublicKey : null,
    });

    /// <summary>
    /// Registers this browser. Upserted on the endpoint, which is what the
    /// browser hands back unchanged on every resubscribe — so re-enabling
    /// notifications, or signing in as someone else on a shared device,
    /// updates the row rather than accumulating duplicates.
    /// </summary>
    [HttpPost("subscribe")]
    public async Task<IActionResult> Subscribe(SavePushSubscriptionRequest request)
    {
        if (!_options.IsConfigured)
            return StatusCode(StatusCodes.Status503ServiceUnavailable, "Push is not configured on this server.");

        await _db.ExecuteAsync(
            @"UPDATE PushSubscriptions
              SET UserId = @UserId, P256dh = @P256dh, Auth = @Auth, CreatedAt = SYSUTCDATETIME()
              WHERE Endpoint = @Endpoint;

              IF @@ROWCOUNT = 0
              INSERT INTO PushSubscriptions (UserId, Endpoint, P256dh, Auth)
              VALUES (@UserId, @Endpoint, @P256dh, @Auth);",
            new { UserId, request.Endpoint, request.P256dh, request.Auth });

        return NoContent();
    }

    /// <summary>
    /// Forgets this browser. Scoped to the caller so one account can't
    /// unsubscribe another's device by guessing an endpoint.
    /// </summary>
    [HttpPost("unsubscribe")]
    public async Task<IActionResult> Unsubscribe(RemovePushSubscriptionRequest request)
    {
        await _db.ExecuteAsync(
            "DELETE FROM PushSubscriptions WHERE Endpoint = @Endpoint AND UserId = @UserId",
            new { request.Endpoint, UserId });

        return NoContent();
    }

    /// <summary>
    /// Fires the real notification immediately, so "is this actually working?"
    /// has an answer that doesn't involve leaving a workout open for three hours.
    /// </summary>
    [HttpPost("test")]
    public async Task<IActionResult> SendTest()
    {
        var delivered = await _push.SendToUserAsync(
            _db, UserId,
            new PushPayload(
                "LiftLog notifications are on",
                "This is what a reminder about an unfinished workout will look like.",
                "workout-open",
                "/log"),
            HttpContext.RequestAborted);

        return delivered == 0
            ? BadRequest("No registered device accepted the notification. Try turning reminders off and on again.")
            : NoContent();
    }
}
