# Google sign-in

The button only appears once the server has a client id **and** a client
secret. Without them `GET /api/auth/google/config` reports `enabled: false` and
the login screen is exactly what it was before, so nothing here has to be done
in a hurry.

## 1. Create the OAuth client

In the [Google Cloud console](https://console.cloud.google.com/apis/credentials):

1. Create a project (or reuse one).
2. **OAuth consent screen** — External, app name `LiftLog`, your own email as
   support and developer contact. Leave it in *Testing* and add your Google
   account under *Test users*; that is enough for a personal deployment and
   avoids verification entirely. Verification only becomes necessary if you
   publish the app or add sensitive scopes for other people's accounts.
3. **Credentials → Create credentials → OAuth client ID → Web application.**
4. **Authorised JavaScript origins** — the origins the app is served from:
   - `https://your-domain` (production)
   - `http://localhost:5173` (vite dev)
5. **Authorised redirect URIs** — leave empty. The popup flow uses the literal
   value `postmessage`, which is not a URL and is not configured here. This
   trips people up: a `redirect_uri_mismatch` at this stage almost always means
   the *origin* is missing above, not the redirect URI.

Copy the client id and client secret.

## 2. Configure the server

Production — two GitHub Actions repository secrets, which the deploy workflow
exports into the compose file:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Local development — user secrets, so the secret never reaches a file in the
repo:

```
cd server
dotnet user-secrets set "Google:ClientId" "....apps.googleusercontent.com"
dotnet user-secrets set "Google:ClientSecret" "GOCSPX-..."
```

## 3. What happens on sign-in

1. The browser gets a one-time authorization code from Google. It never sees a
   Google access or refresh token.
2. `POST /api/auth/google` exchanges that code server-side and validates the
   returned identity token against our own client id.
3. The Google account is matched, in order: an existing link in
   `AspNetUserLogins`; an existing account with the same **verified** email; a
   newly created account. The verified-email condition is what stops an
   unverified address from being used to claim someone else's account.
4. Google's tokens are stored in `AspNetUserTokens` under provider `Google`
   (`refresh_token`, `access_token`, `expires_at`, `scopes`).
5. The response is an ordinary LiftLog JWT — identical to the password path
   from the client's point of view.

## 4. Adding API scopes later

The refresh token in step 4 is the whole reason this uses the code flow rather
than the simpler ID-token flow. To add macro or bodyweight sync:

- Add the scope to `Google:Scope` (server config). The client reads its scope
  list from `/api/auth/google/config`, so nothing needs rebuilding.
- `include_granted_scopes` is already set, so a returning user consents only to
  what is new and keeps what they already granted.
- Better still, request the new scope from the settings screen rather than the
  login screen — consent is far more likely to be granted next to the feature
  that explains it.

Two things to know before building on this:

- **A refresh token arrives only on the first consent** for a given user and
  client. `StoreGoogleTokens` never overwrites a stored one with null for that
  reason. If you need to force a fresh one (say, after changing scopes and
  losing the old token), the user must re-consent with `prompt=consent`.
- **Google Fit's REST API is shut down.** Bodyweight and nutrition sync now
  goes through Health Connect on Android, or a third party such as Fitbit or
  MyFitnessPal, each with its own OAuth client. Google sign-in gives us the
  account and the token plumbing; it does not by itself give us that data.
