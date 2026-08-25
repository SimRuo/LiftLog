using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Google.Apis.Auth;
using Microsoft.Extensions.Options;

namespace server.Services;

/// <summary>
/// Configuration for "Sign in with Google". Absent credentials simply turn the
/// feature off rather than breaking startup — a dev box without a Google
/// project should still run the app, it just won't offer the button.
/// </summary>
public class GoogleAuthOptions
{
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;

    /// <summary>
    /// What we ask for at sign-in. Deliberately the identity minimum: the
    /// macro- and weight-sync scopes get requested later, when the user turns
    /// that feature on and can see why it's being asked for. Asking for
    /// everything on the login screen is how consent screens get declined.
    /// </summary>
    public string Scope { get; set; } = "openid email profile";

    public bool Enabled =>
        !string.IsNullOrWhiteSpace(ClientId) && !string.IsNullOrWhiteSpace(ClientSecret);
}

/// <summary>Anything Google told us was wrong with the exchange.</summary>
public class GoogleAuthException : Exception
{
    public GoogleAuthException(string message) : base(message) { }
}

/// <summary>
/// What one round of the authorization-code flow gave us.
///
/// RefreshToken is null more often than you'd expect: Google issues one only
/// on the first consent for a given client/user pair, so a second sign-in
/// returns nothing there. Callers must treat null as "keep what you already
/// have", never as "the user revoked us".
/// </summary>
public record GoogleIdentity(
    string Subject,
    string Email,
    bool EmailVerified,
    string? Name,
    string? RefreshToken,
    string? AccessToken,
    DateTimeOffset? AccessTokenExpiresAt,
    string? GrantedScopes);

/// <summary>
/// Exchanges the one-time code the browser received for real tokens.
///
/// We take the code route rather than the simpler ID-token route on purpose.
/// An ID token proves who someone is and nothing more; the code exchange also
/// yields a refresh token, which is the only way to call Google APIs on a
/// user's behalf later — the whole reason this exists. Doing it now means
/// adding a scope for macro or bodyweight sync is an incremental consent
/// prompt, not a re-plumbing of authentication.
/// </summary>
public class GoogleAuthService
{
    private const string TokenEndpoint = "https://oauth2.googleapis.com/token";

    private readonly HttpClient _http;
    private readonly GoogleAuthOptions _options;

    public GoogleAuthService(HttpClient http, IOptions<GoogleAuthOptions> options)
    {
        _http = http;
        _options = options.Value;
    }

    public GoogleAuthOptions Options => _options;

    public async Task<GoogleIdentity> ExchangeCodeAsync(
        string code, string? redirectUri, CancellationToken ct = default)
    {
        if (!_options.Enabled)
            throw new GoogleAuthException("Google sign-in is not configured on this server.");

        // "postmessage" is not a placeholder — it is the literal redirect_uri
        // Google expects when the code came from the JavaScript popup flow
        // (google.accounts.oauth2.initCodeClient). Send the site's real URL
        // here instead and the exchange fails with redirect_uri_mismatch, which
        // is the single most common way this integration goes wrong.
        var form = new Dictionary<string, string>
        {
            ["code"] = code,
            ["client_id"] = _options.ClientId,
            ["client_secret"] = _options.ClientSecret,
            ["redirect_uri"] = string.IsNullOrWhiteSpace(redirectUri) ? "postmessage" : redirectUri,
            ["grant_type"] = "authorization_code",
        };

        using var response = await _http.PostAsync(
            TokenEndpoint, new FormUrlEncodedContent(form), ct);

        var body = await response.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken: ct);

        if (!response.IsSuccessStatusCode || body is null)
        {
            var reason = body?.ErrorDescription ?? body?.Error ?? response.StatusCode.ToString();
            throw new GoogleAuthException($"Google rejected the sign-in ({reason}).");
        }

        if (string.IsNullOrWhiteSpace(body.IdToken))
            throw new GoogleAuthException("Google returned no identity token.");

        // The token came straight from Google over TLS, so the signature is
        // already implied — but validating pins the audience to our own client
        // id, which is the check that actually matters. Without it a code
        // minted for a different application would be accepted here.
        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(
                body.IdToken,
                new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = new[] { _options.ClientId },
                });
        }
        catch (InvalidJwtException ex)
        {
            throw new GoogleAuthException($"Google's identity token failed validation: {ex.Message}");
        }

        if (string.IsNullOrWhiteSpace(payload.Subject))
            throw new GoogleAuthException("Google's identity token carried no subject.");

        return new GoogleIdentity(
            Subject: payload.Subject,
            Email: payload.Email ?? string.Empty,
            EmailVerified: payload.EmailVerified,
            Name: payload.Name,
            RefreshToken: body.RefreshToken,
            AccessToken: body.AccessToken,
            AccessTokenExpiresAt: body.ExpiresIn is > 0
                ? DateTimeOffset.UtcNow.AddSeconds(body.ExpiresIn.Value)
                : null,
            GrantedScopes: body.Scope);
    }

    private class TokenResponse
    {
        [JsonPropertyName("access_token")] public string? AccessToken { get; set; }
        [JsonPropertyName("refresh_token")] public string? RefreshToken { get; set; }
        [JsonPropertyName("id_token")] public string? IdToken { get; set; }
        [JsonPropertyName("expires_in")] public int? ExpiresIn { get; set; }
        [JsonPropertyName("scope")] public string? Scope { get; set; }
        [JsonPropertyName("error")] public string? Error { get; set; }
        [JsonPropertyName("error_description")] public string? ErrorDescription { get; set; }
    }
}
