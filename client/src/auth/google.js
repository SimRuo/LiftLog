// Google Identity Services, loaded on demand.
//
// The script is fetched only when a page actually offers the button, so the
// sign-in screen doesn't pay for a third-party request on every cold start —
// and a deployment with no Google credentials never touches Google at all.

const SRC = 'https://accounts.google.com/gsi/client';

let loader = null;

/** Resolves with `window.google`. Cached, so N buttons cause one script load. */
export function loadGoogleScript() {
  if (loader) return loader;

  loader = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve(window.google);
      return;
    }

    const existing = document.querySelector(`script[src="${SRC}"]`);
    const script = existing ?? document.createElement('script');

    const onLoad = () => {
      if (window.google?.accounts?.oauth2) resolve(window.google);
      else reject(new Error('Google sign-in loaded but is unavailable.'));
    };
    const onError = () => {
      // Let a later attempt retry rather than caching the failure forever:
      // the usual cause is a dead connection or a content blocker, both of
      // which can change between one tap and the next.
      loader = null;
      reject(new Error('Could not reach Google. Check your connection.'));
    };

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });

    if (!existing) {
      script.src = SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return loader;
}

/**
 * Build a code client for the authorization-code flow.
 *
 * The code goes to our server, which exchanges it for tokens using the client
 * secret. The browser never sees an access or refresh token, which is the
 * point: the tokens that can read someone's Google data live server-side,
 * where localStorage and extensions can't reach them.
 *
 * Must be created ahead of time. `requestCode()` opens a popup, so it has to
 * run inside the click handler itself — anything awaited first and the popup
 * blocker eats it.
 */
export async function createCodeClient({ clientId, scope, onCode, onError }) {
  const google = await loadGoogleScript();

  return google.accounts.oauth2.initCodeClient({
    client_id: clientId,
    scope: scope || 'openid email profile',
    ux_mode: 'popup',
    // Keeps scopes granted in earlier sessions attached to this consent, so
    // adding a sync scope later doesn't silently drop the ones already given.
    include_granted_scopes: true,
    callback: (response) => {
      if (response?.code) onCode(response.code);
      else onError?.(new Error(response?.error_description || 'Google sign-in was cancelled.'));
    },
    error_callback: (err) => {
      // Closing the popup is a decision, not a failure — nothing to report.
      if (err?.type === 'popup_closed') onError?.(null);
      else onError?.(new Error(err?.message || 'Google sign-in failed.'));
    },
  });
}
