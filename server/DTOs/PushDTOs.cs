using System.ComponentModel.DataAnnotations;

namespace server.DTOs;

/// <summary>
/// What the client needs before it can subscribe. Mirrors the Google config
/// endpoint: an unconfigured deployment reports `enabled: false` and the UI
/// hides the toggle rather than offering something that can't work.
///
/// The public key is served at runtime instead of being baked into the bundle
/// so the frontend image doesn't have to be rebuilt to change it.
/// </summary>
public class PushConfigResponse
{
    public bool Enabled { get; set; }
    public string? PublicKey { get; set; }
}

/// <summary>
/// A browser's PushSubscription, as `subscription.toJSON()` hands it over.
/// </summary>
public class SavePushSubscriptionRequest
{
    [Required, MaxLength(500)]
    public string Endpoint { get; set; } = string.Empty;

    /// <summary>Base64url ECDH public key of the browser's keypair.</summary>
    [Required, MaxLength(200)]
    public string P256dh { get; set; } = string.Empty;

    /// <summary>Base64url shared authentication secret.</summary>
    [Required, MaxLength(100)]
    public string Auth { get; set; } = string.Empty;
}

public class RemovePushSubscriptionRequest
{
    [Required, MaxLength(500)]
    public string Endpoint { get; set; } = string.Empty;
}

/// <summary>
/// Sent when the first set of a workout is ticked off, and again whenever a
/// draft is restored. `StartedAt` comes from the device because that's where
/// the clock the user sees is kept.
/// </summary>
public class BeginActiveWorkoutRequest
{
    [Required]
    public DateTimeOffset StartedAt { get; set; }
}
