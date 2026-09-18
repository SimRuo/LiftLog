/*
 * Push handlers, pulled into the generated service worker by
 * `workbox.importScripts` in vite.config.js.
 *
 * This lives in public/ as a plain script rather than in src/ because the SW is
 * built in `generateSW` mode — Workbox writes the whole of sw.js, so there is no
 * source file to add a listener to. Switching to `injectManifest` would give us
 * one, at the cost of hand-maintaining the precache setup that file already has.
 *
 * No bundler runs over this. Keep it dependency-free and ES2019-ish.
 */

const DEFAULT_URL = '/log';

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // A push with no payload, or one we didn't send. Still worth showing
    // something: Chrome revokes the permission from origins that receive a
    // push and display nothing.
  }

  const title = data.title || 'LiftLog';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/badge-96x96.png',
      // Same tag across the series, so a repeat nudge replaces the previous one
      // in the shade rather than stacking four of them up.
      tag: data.tag || 'liftlog',
      renotify: true,
      data: { url: data.url || DEFAULT_URL },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || DEFAULT_URL;

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Prefer the tab that's already open — the workout being nudged about is
      // in its localStorage draft, and opening a second window would leave the
      // user looking at a restored copy while the original sits behind it.
      for (const client of clients) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.focus();
        if ('navigate' in client) await client.navigate(url);
        return;
      }

      await self.clients.openWindow(url);
    })(),
  );
});
