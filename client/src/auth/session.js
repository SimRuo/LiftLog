// Single source of truth for the stored session.
//
// The old code kept `token` and `username` as two loose localStorage keys and
// wrote/removed them from three different places, one of which cleared a key
// named `email` that nothing ever wrote. That left the app in a half-signed-in
// state: token gone, username still present. One blob, written in one place,
// makes that class of bug unreachable.

const KEY = 'liftlog.session';
const LEGACY_TOKEN_KEY = 'token';
const LEGACY_USERNAME_KEY = 'username';

/** Decode a JWT payload without verifying it — we only need `exp` client-side. */
export function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    // atob yields a binary string; round-trip through URI escaping so non-ASCII
    // claims (e.g. a username with an å in it) survive.
    return JSON.parse(
      decodeURIComponent(
        json
          .split('')
          .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join(''),
      ),
    );
  } catch {
    return null;
  }
}

/**
 * A token is usable until 30s before its own `exp`. The margin means a request
 * fired right at the boundary can't land after expiry and 401 mid-flight.
 */
export function isTokenValid(token) {
  if (!token) return false;
  const claims = decodeJwt(token);
  if (!claims?.exp) return false;
  return claims.exp * 1000 - 30_000 > Date.now();
}

export function expiresAt(token) {
  const claims = decodeJwt(token);
  return claims?.exp ? new Date(claims.exp * 1000) : null;
}

/**
 * Read the stored session, validating expiry. An expired token is cleared here
 * rather than handed back — otherwise `isAuthenticated` is true, the app shell
 * renders, and then every request 401s and bounces you out. That mid-render
 * bounce was the "weird logged in / not logged in" behaviour.
 */
export function loadSession() {
  let raw = localStorage.getItem(KEY);

  // Migrate anyone holding a still-valid token under the old key layout so a
  // deploy doesn't sign everybody out.
  if (!raw) {
    const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacyToken) {
      raw = JSON.stringify({
        token: legacyToken,
        username: localStorage.getItem(LEGACY_USERNAME_KEY) || '',
      });
      localStorage.setItem(KEY, raw);
    }
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_USERNAME_KEY);
  }

  if (!raw) return null;

  try {
    const session = JSON.parse(raw);
    if (!isTokenValid(session?.token)) {
      localStorage.removeItem(KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(KEY);
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(LEGACY_USERNAME_KEY);
}

/** Used by the API layer on every request, so it never reads storage keys itself. */
export function currentToken() {
  try {
    const session = JSON.parse(localStorage.getItem(KEY) || 'null');
    return session?.token ?? null;
  } catch {
    return null;
  }
}
