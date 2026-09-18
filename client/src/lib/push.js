import { pushApi } from '../api/push';

/**
 * Browser half of push notifications: permission, subscription, and keeping the
 * server's copy of that subscription in step with the browser's.
 *
 * The one rule that shapes all of this: `Notification.requestPermission()` and
 * `pushManager.subscribe()` must run inside a user gesture. Nothing here may be
 * called on mount — `enable()` belongs on a click handler and nowhere else.
 */

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * The VAPID key travels as base64url text and has to reach `subscribe()` as
 * bytes. `atob` wants standard base64, hence the alphabet swap and the padding.
 */
function applicationServerKey(base64url) {
  const padded = base64url.padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), '=');
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** Flattens a browser PushSubscription into what the API expects. */
function toRequest(subscription) {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
  };
}

/**
 * Current state, without prompting for anything.
 *
 * `subscribed` is read from the browser rather than from a local flag, because
 * the browser is the side that can revoke it: clearing site data or switching
 * the permission off in Android settings leaves any flag we stored lying.
 */
export async function pushState() {
  if (!pushSupported()) return { supported: false, permission: 'denied', subscribed: false };

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();

  return {
    supported: true,
    permission: Notification.permission,
    subscribed: !!subscription,
  };
}

/**
 * The active service worker, or a useful error instead of an open-ended wait.
 *
 * `ready` is the right thing to await — on a first visit the worker may still
 * be installing, and subscribing against an inactive one throws — but it never
 * rejects. With no worker registered at all it simply hangs, which is exactly
 * what happens under `vite dev`, where the plugin stubs registration out. That
 * would leave the toggle spinning with nothing to show for it.
 */
async function activeRegistration() {
  if (!(await navigator.serviceWorker.getRegistration())) {
    throw new Error(
      "No service worker is registered, so notifications can't be set up. " +
        'In development this is expected — try a production build.',
    );
  }

  let timer;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('The service worker did not finish starting up. Reload and try again.')),
          10000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Asks for permission if needed, subscribes, and registers with the server.
 * Must be called from a click. Resolves to the new state; throws with a message
 * worth showing if the user or the browser says no.
 */
export async function enablePush() {
  const config = await pushApi.config();
  if (!config?.enabled || !config.publicKey) {
    throw new Error('This server has no notification keys configured.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked for this site. Turn them back on in your browser settings.'
        : 'Notifications need permission before they can be switched on.',
    );
  }

  const registration = await activeRegistration();

  // An existing subscription signed with a different key can't be reused; the
  // keys only change if the server's were rotated, in which case the old one is
  // dead anyway.
  const existing = await registration.pushManager.getSubscription();
  if (existing) await existing.unsubscribe();

  const subscription = await registration.pushManager.subscribe({
    // Required to be true by every browser that implements this: a push must
    // result in a visible notification.
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey(config.publicKey),
  });

  try {
    await pushApi.subscribe(toRequest(subscription));
  } catch (err) {
    // Don't leave the browser holding a subscription the server can't push to —
    // it would read as "on" on the next visit and never deliver anything.
    await subscription.unsubscribe().catch(() => {});
    throw err;
  }

  return pushState();
}

/**
 * Unsubscribes this browser and tells the server to forget it.
 *
 * The server is told first: if that call fails, the subscription is still live
 * and the next attempt can still reach it. Dropping it locally first would
 * strand the row, and it would keep receiving pushes until a 410 retired it.
 */
export async function disablePush() {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return pushState();

  await pushApi.unsubscribe(subscription.endpoint);
  await subscription.unsubscribe();

  return pushState();
}

/**
 * Drops this browser's subscription on the way out of a session.
 *
 * Without it, the row on the server still maps this device's endpoint to the
 * account that just left, and the next nudge for them would surface on a phone
 * someone else is now signed in on — the same cross-account leak the Workbox
 * cache notes in vite.config warn about.
 *
 * Only the browser side is torn down here. The server call would need the token
 * that sign-out is in the middle of discarding, and racing it isn't worth the
 * complexity: unsubscribing locally kills the endpoint outright, so the stale
 * row is retired by the 410 the next delivery attempt earns.
 *
 * Fire-and-forget by design — nothing about signing out should wait on it.
 */
export function releasePushOnSignOut() {
  if (!pushSupported()) return;
  navigator.serviceWorker
    .getRegistration()
    .then((registration) => registration?.pushManager.getSubscription())
    .then((subscription) => subscription?.unsubscribe())
    .catch(() => {});
}
