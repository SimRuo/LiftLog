using System.ComponentModel.DataAnnotations;

namespace server.DTOs;

public class RegisterRequest
{
    [Required, MinLength(3), MaxLength(30)]
    public string Username { get; set; } = string.Empty;

    [Required, MinLength(6)]
    public string Password { get; set; } = string.Empty;
}

public class LoginRequest
{
    [Required]
    public string Username { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

public class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;

    /// <summary>
    /// True only when this call created the account. Google sign-in is one
    /// button for both signing up and signing back in, so the client has no
    /// other way to know whether to open the empty-plan editor or the history
    /// the user came back for.
    /// </summary>
    public bool IsNewAccount { get; set; }
}

/// <summary>
/// The one-time authorization code from the Google popup.
///
/// RedirectUri is here for completeness — the popup flow leaves it null and the
/// server substitutes "postmessage" — but a future full-page redirect flow
/// needs to send the exact URI it used, so the shape supports it now.
/// </summary>
public class GoogleSignInRequest
{
    [Required]
    public string Code { get; set; } = string.Empty;

    public string? RedirectUri { get; set; }
}

/// <summary>
/// Told to the client at runtime rather than baked into the bundle at build
/// time. The client id isn't a secret, but shipping it as a VITE_ variable
/// would mean a rebuild to rotate it and a CI secret to build the frontend at
/// all. This way the same static bundle works on any deployment.
/// </summary>
public class GoogleConfigResponse
{
    public bool Enabled { get; set; }
    public string? ClientId { get; set; }
    public string? Scope { get; set; }
}

/// <summary>
/// Whether the signed-in user already has a Google account linked, for the
/// account page to render "Connect" vs "Connected as ...".
/// </summary>
public class GoogleLinkStatusResponse
{
    public bool Linked { get; set; }
    public string? Email { get; set; }

    /// <summary>
    /// Whether Google can safely be unlinked. False when it's the only way
    /// into the account — unlinking would lock the user out entirely.
    /// </summary>
    public bool CanUnlink { get; set; }
}

public class PasswordStatusResponse
{
    public bool HasPassword { get; set; }
}

/// <summary>
/// CurrentPassword is required only when the account already has one — a
/// Google-only account has nothing to prove it owns yet, so the same endpoint
/// doubles as both "set" and "change" depending on that.
/// </summary>
public class SetPasswordRequest
{
    public string? CurrentPassword { get; set; }

    [Required, MinLength(6)]
    public string NewPassword { get; set; } = string.Empty;
}
