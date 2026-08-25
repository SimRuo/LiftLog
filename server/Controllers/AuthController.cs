using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using server.DTOs;
using server.Services;

namespace server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    /// <summary>
    /// The provider key stored in AspNetUserLogins and AspNetUserTokens. Change
    /// it and every linked account silently becomes unlinked, so it lives in
    /// exactly one place.
    /// </summary>
    public const string GoogleProvider = "Google";

    private readonly UserManager<IdentityUser> _userManager;
    private readonly IConfiguration _config;
    private readonly GoogleAuthService _google;
    private readonly ILogger<AuthController> _log;

    public AuthController(
        UserManager<IdentityUser> userManager,
        IConfiguration config,
        GoogleAuthService google,
        ILogger<AuthController> log)
    {
        _userManager = userManager;
        _config = config;
        _google = google;
        _log = log;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        var user = new IdentityUser { UserName = request.Username };
        var result = await _userManager.CreateAsync(user, request.Password);

        if (!result.Succeeded)
            return BadRequest(result.Errors.Select(e => e.Description));

        return Ok(new AuthResponse
        {
            Token = GenerateToken(user),
            Username = user.UserName!,
            IsNewAccount = true,
        });
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var user = await _userManager.FindByNameAsync(request.Username);
        if (user == null) return Unauthorized("Invalid username or password");

        // An account created through Google has no password hash. Saying so
        // beats "invalid password" for a password that was never set — the
        // user would otherwise sit there trying to remember one.
        if (!await _userManager.HasPasswordAsync(user))
            return Unauthorized("That account signs in with Google. Use the Google button instead.");

        if (!await _userManager.CheckPasswordAsync(user, request.Password))
            return Unauthorized("Invalid username or password");

        return Ok(new AuthResponse { Token = GenerateToken(user), Username = user.UserName! });
    }

    /// <summary>
    /// Whether to offer the Google button, and the public client id needed to
    /// start the flow. Safe to call unauthenticated — it exposes nothing the
    /// consent screen wouldn't.
    /// </summary>
    [HttpGet("google/config")]
    public ActionResult<GoogleConfigResponse> GoogleConfig()
    {
        var options = _google.Options;
        return Ok(new GoogleConfigResponse
        {
            Enabled = options.Enabled,
            ClientId = options.Enabled ? options.ClientId : null,
            Scope = options.Enabled ? options.Scope : null,
        });
    }

    [HttpPost("google")]
    public async Task<ActionResult<AuthResponse>> GoogleSignIn(GoogleSignInRequest request)
    {
        if (!_google.Options.Enabled)
            return BadRequest("Google sign-in is not configured on this server.");

        GoogleIdentity identity;
        try
        {
            identity = await _google.ExchangeCodeAsync(
                request.Code, request.RedirectUri, HttpContext.RequestAborted);
        }
        catch (GoogleAuthException ex)
        {
            _log.LogWarning(ex, "Google sign-in failed during code exchange");
            return Unauthorized(ex.Message);
        }

        var user = await _userManager.FindByLoginAsync(GoogleProvider, identity.Subject);
        var isNew = false;

        if (user is null)
        {
            // Adopt an existing account with the same address, so someone who
            // registered with a password and later clicks the Google button
            // lands back in their own history instead of an empty new account.
            //
            // Gated on email_verified: an unverified address is a claim, not a
            // fact, and treating it as one is how account-takeover-by-signup
            // works. Unverified falls through to creating a fresh account.
            if (identity.EmailVerified && !string.IsNullOrWhiteSpace(identity.Email))
                user = await _userManager.FindByEmailAsync(identity.Email);

            if (user is null)
            {
                user = await CreateUserForGoogle(identity);
                isNew = true;
            }

            if (user is null)
                return BadRequest("Could not create an account for that Google profile.");

            var link = await _userManager.AddLoginAsync(
                user, new UserLoginInfo(GoogleProvider, identity.Subject, identity.Email));

            if (!link.Succeeded)
                return BadRequest(link.Errors.Select(e => e.Description));

            _log.LogInformation("Linked a Google login to user {UserId}", user.Id);
        }

        await StoreGoogleTokens(user, identity);

        return Ok(new AuthResponse
        {
            Token = GenerateToken(user),
            Username = user.UserName!,
            IsNewAccount = isNew,
        });
    }

    /// <summary>
    /// Whether the signed-in user already has Google linked, for the account
    /// page to render "Connect" or "Connected as ...".
    /// </summary>
    [Authorize]
    [HttpGet("google/status")]
    public async Task<ActionResult<GoogleLinkStatusResponse>> GoogleStatus()
    {
        var user = await CurrentUser();
        if (user is null) return Unauthorized();

        var logins = await _userManager.GetLoginsAsync(user);
        var google = logins.FirstOrDefault(l => l.LoginProvider == GoogleProvider);

        return Ok(new GoogleLinkStatusResponse
        {
            Linked = google is not null,
            Email = google is not null ? user.Email : null,
            // Unlinking has to leave at least one way in. A password is that
            // way; without one, Google is the only door.
            CanUnlink = google is not null && await _userManager.HasPasswordAsync(user),
        });
    }

    /// <summary>
    /// Attach a Google account to the already-signed-in user. Distinct from
    /// <see cref="GoogleSignIn"/>: that endpoint is for someone who isn't
    /// authenticated yet and resolves identity by matching a verified email,
    /// which is the wrong rule here — the user is already known, so the only
    /// question is whether this Google account belongs to someone else.
    /// </summary>
    [Authorize]
    [HttpPost("google/link")]
    public async Task<ActionResult> GoogleLink(GoogleSignInRequest request)
    {
        if (!_google.Options.Enabled)
            return BadRequest("Google sign-in is not configured on this server.");

        var user = await CurrentUser();
        if (user is null) return Unauthorized();

        GoogleIdentity identity;
        try
        {
            identity = await _google.ExchangeCodeAsync(
                request.Code, request.RedirectUri, HttpContext.RequestAborted);
        }
        catch (GoogleAuthException ex)
        {
            _log.LogWarning(ex, "Google account link failed during code exchange");
            return Unauthorized(ex.Message);
        }

        var existing = await _userManager.FindByLoginAsync(GoogleProvider, identity.Subject);
        if (existing is not null && existing.Id != user.Id)
            return Conflict("That Google account is already linked to a different LiftLog account.");

        if (existing is null)
        {
            var link = await _userManager.AddLoginAsync(
                user, new UserLoginInfo(GoogleProvider, identity.Subject, identity.Email));
            if (!link.Succeeded)
                return BadRequest(link.Errors.Select(e => e.Description));

            _log.LogInformation("Linked a Google login to user {UserId}", user.Id);
        }

        await StoreGoogleTokens(user, identity);
        return NoContent();
    }

    /// <summary>
    /// Detach Google from the current user. Refused when there's no password
    /// set — that would leave the account with no way to sign in at all.
    /// </summary>
    [Authorize]
    [HttpDelete("google/link")]
    public async Task<ActionResult> GoogleUnlink()
    {
        var user = await CurrentUser();
        if (user is null) return Unauthorized();

        var google = (await _userManager.GetLoginsAsync(user))
            .FirstOrDefault(l => l.LoginProvider == GoogleProvider);
        if (google is null) return BadRequest("No Google account is linked.");

        if (!await _userManager.HasPasswordAsync(user))
            return BadRequest("Set a password first — otherwise Google is the only way into this account.");

        var result = await _userManager.RemoveLoginAsync(user, GoogleProvider, google.ProviderKey);

        if (!result.Succeeded)
            return BadRequest(result.Errors.Select(e => e.Description));

        // The stored tokens are only good for calling Google on this user's
        // behalf; once the login itself is gone they're dead weight.
        await _userManager.RemoveAuthenticationTokenAsync(user, GoogleProvider, "refresh_token");
        await _userManager.RemoveAuthenticationTokenAsync(user, GoogleProvider, "access_token");
        await _userManager.RemoveAuthenticationTokenAsync(user, GoogleProvider, "expires_at");
        await _userManager.RemoveAuthenticationTokenAsync(user, GoogleProvider, "scopes");

        return NoContent();
    }

    /// <summary>
    /// Whether the current user can sign in with a password at all — the
    /// account page needs this to offer "Set a password" vs "Change password".
    /// </summary>
    [Authorize]
    [HttpGet("password/status")]
    public async Task<ActionResult<PasswordStatusResponse>> PasswordStatus()
    {
        var user = await CurrentUser();
        if (user is null) return Unauthorized();

        return Ok(new PasswordStatusResponse { HasPassword = await _userManager.HasPasswordAsync(user) });
    }

    /// <summary>
    /// Set a password on an account that has none (typically Google-only), or
    /// change an existing one. Which of those it is decides whether
    /// <see cref="SetPasswordRequest.CurrentPassword"/> gets checked — Identity
    /// itself splits these into AddPasswordAsync and ChangePasswordAsync, and
    /// calling the wrong one throws rather than failing gracefully.
    /// </summary>
    [Authorize]
    [HttpPost("password")]
    public async Task<ActionResult> SetPassword(SetPasswordRequest request)
    {
        var user = await CurrentUser();
        if (user is null) return Unauthorized();

        IdentityResult result;
        if (await _userManager.HasPasswordAsync(user))
        {
            if (string.IsNullOrEmpty(request.CurrentPassword))
                return BadRequest("Enter your current password.");

            result = await _userManager.ChangePasswordAsync(
                user, request.CurrentPassword, request.NewPassword);
        }
        else
        {
            result = await _userManager.AddPasswordAsync(user, request.NewPassword);
        }

        if (!result.Succeeded)
            return BadRequest(result.Errors.Select(e => e.Description));

        return NoContent();
    }

    private async Task<IdentityUser?> CurrentUser()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return id is null ? null : await _userManager.FindByIdAsync(id);
    }

    /// <summary>
    /// Keeps whatever Google gave us, so a later feature can call their APIs
    /// without dragging the user back through a consent screen.
    ///
    /// AspNetUserTokens is Identity's own store for exactly this, so it needs
    /// no schema of ours — the table was created with the rest of the Identity
    /// model and has been sitting empty until now.
    /// </summary>
    private async Task StoreGoogleTokens(IdentityUser user, GoogleIdentity identity)
    {
        // Only the first consent yields a refresh token. Overwriting with null
        // on a later sign-in would throw away the one credential that cannot be
        // re-obtained without prompting again.
        if (!string.IsNullOrWhiteSpace(identity.RefreshToken))
            await _userManager.SetAuthenticationTokenAsync(
                user, GoogleProvider, "refresh_token", identity.RefreshToken);

        if (!string.IsNullOrWhiteSpace(identity.AccessToken))
            await _userManager.SetAuthenticationTokenAsync(
                user, GoogleProvider, "access_token", identity.AccessToken);

        if (identity.AccessTokenExpiresAt is { } expiresAt)
            await _userManager.SetAuthenticationTokenAsync(
                user, GoogleProvider, "expires_at", expiresAt.ToString("O"));

        // Recorded so a future sync feature can tell "not connected" from
        // "connected, but you never granted that scope" without asking Google.
        if (!string.IsNullOrWhiteSpace(identity.GrantedScopes))
            await _userManager.SetAuthenticationTokenAsync(
                user, GoogleProvider, "scopes", identity.GrantedScopes);
    }

    private async Task<IdentityUser?> CreateUserForGoogle(GoogleIdentity identity)
    {
        var user = new IdentityUser
        {
            UserName = await AvailableUsername(identity),
            Email = string.IsNullOrWhiteSpace(identity.Email) ? null : identity.Email,
            EmailConfirmed = identity.EmailVerified,
        };

        // No password: this account signs in through Google only. Identity is
        // fine with that, and the login endpoint above reports it plainly.
        var result = await _userManager.CreateAsync(user);
        if (result.Succeeded) return user;

        _log.LogWarning("Could not create a user for a Google sign-in: {Errors}",
            string.Join("; ", result.Errors.Select(e => e.Description)));
        return null;
    }

    /// <summary>
    /// Derive a username from the email's local part, then take the first free
    /// variant. Two people at different domains sharing a local part is common
    /// enough that the suffix is not a theoretical case.
    /// </summary>
    private async Task<string> AvailableUsername(GoogleIdentity identity)
    {
        var seed = identity.Email.Split('@')[0];
        var allowed = _userManager.Options.User.AllowedUserNameCharacters;

        var cleaned = new string(seed.Where(allowed.Contains).ToArray());
        if (cleaned.Length > 24) cleaned = cleaned[..24];
        if (cleaned.Length < 3) cleaned = "lifter";

        if (await _userManager.FindByNameAsync(cleaned) is null) return cleaned;

        for (var i = 2; i < 100; i++)
        {
            var candidate = $"{cleaned}{i}";
            if (await _userManager.FindByNameAsync(candidate) is null) return candidate;
        }

        return $"{cleaned}{Guid.NewGuid().ToString("N")[..6]}";
    }

    private string GenerateToken(IdentityUser user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Name, user.UserName!)
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
