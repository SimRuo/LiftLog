import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:5230',
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered explicitly in main.jsx instead of the auto-injected
      // script, so the app controls the update-check cadence rather than
      // relying on whatever the browser does on its own schedule.
      injectRegister: false,
      manifest: {
        name: 'LiftLog',
        short_name: 'LiftLog',
        description: 'Track your workouts and progress',
        theme_color: '#08080a',
        background_color: '#08080a',
        display: 'standalone',
        orientation: 'portrait',
        // `any` and `maskable` are separate files on purpose. A maskable icon
        // gets cropped to the launcher's shape, so it carries extra padding that
        // would leave the icon looking undersized wherever it is shown uncropped.
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app shell is precached; API responses deliberately are not, and
        // `runtimeCaching` stays empty on purpose.
        //
        // A Workbox HTTP cache is keyed by URL, so it cannot tell whose data a
        // response holds. The NetworkFirst rule that used to live here cached
        // authenticated GETs in a store outliving the session, which meant that
        // after signing out — or signing in as someone else — a failed request
        // could be answered from the previous account's data.
        //
        // Offline data lives in src/offline instead: an IndexedDB mirror keyed
        // by user id, wiped on sign-out, plus an outbox that queues workout
        // logging. Same goal, but the store knows who owns each row.
        //
        // Everything the SPA needs to boot is precached, including the lazy
        // ProgressPage chunk, so a cold start with no signal still renders.
        // Push and notification-click handling. generateSW writes the whole
        // service worker, so there is no source file to add listeners to —
        // importScripts pulls them in instead, leaving the caching setup above
        // untouched. The file is in public/ and ships unbundled.
        importScripts: ['/push-sw.js'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        runtimeCaching: [],
      },
    }),
  ],
})
