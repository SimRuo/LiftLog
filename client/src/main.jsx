import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// vite.config's registerType: 'autoUpdate' means "no prompt, just take the
// new version" — but that only happens once the browser has actually fetched
// a new service worker. Left to itself, that only happens on a fresh
// navigation, and a PWA opened once on a phone and left running (or just
// backgrounded, never fully closed) can go days without one. Poll instead so
// a deploy shows up on the next tick rather than the next reinstall.
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => registration.update();
      setInterval(check, 60 * 60 * 1000);
      // Also check whenever the app comes back to the foreground — the case
      // that actually matters on a phone, where "open the app" often means
      // "switch back to an already-running tab" rather than a fresh load.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
