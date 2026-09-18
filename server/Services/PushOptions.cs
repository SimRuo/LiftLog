namespace server.Services;

/// <summary>
/// VAPID credentials for the Web Push protocol, bound from the `Push` config
/// section.
///
/// Bound rather than read ad hoc for the same reason as <see cref="GoogleAuthOptions"/>:
/// "is this feature configured?" gets one answer, and a deployment without keys
/// simply never offers the toggle instead of failing at startup.
/// </summary>
public class PushOptions
{
    /// <summary>Base64url P-256 public key. Handed to the browser — not a secret.</summary>
    public string PublicKey { get; set; } = string.Empty;

    /// <summary>Base64url P-256 private key. Signs the VAPID token; keep it server-side.</summary>
    public string PrivateKey { get; set; } = string.Empty;

    /// <summary>
    /// Contact for the push service to reach if this application misbehaves.
    /// Must be a `mailto:` or `https:` URI — push services reject anything else.
    /// </summary>
    public string Subject { get; set; } = "mailto:admin@liftlog.local";

    /// <summary>How long a workout may stay open before the first nudge.</summary>
    public int RemindAfterHours { get; set; } = 3;

    /// <summary>Gap between repeat nudges, once the first has been sent.</summary>
    public int RepeatEveryHours { get; set; } = 1;

    /// <summary>
    /// Total nudges per open workout. A cap rather than "until acknowledged",
    /// because a workout that is never closed would otherwise nag forever.
    /// </summary>
    public int MaxReminders { get; set; } = 4;

    /// <summary>How often the worker scans for workouts that are due a nudge.</summary>
    public int ScanIntervalMinutes { get; set; } = 5;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(PublicKey) && !string.IsNullOrWhiteSpace(PrivateKey);
}
