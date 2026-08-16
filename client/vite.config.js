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
      manifest: {
        name: 'LiftLog',
        short_name: 'LiftLog',
        description: 'Track your workouts and progress',
        theme_color: '#08080a',
        background_color: '#08080a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // The app shell is precached; API responses deliberately are not.
        //
        // The previous NetworkFirst rule cached authenticated GETs in a store
        // that outlives the session, so after signing out — or signing in as
        // someone else — a failed request could be answered from another
        // account's cached data. It also meant a workout you just saved could
        // be hidden behind a 24h-stale list.
        //
        // Offline resilience comes from the in-progress workout draft in
        // localStorage instead, which is the only data that actually matters
        // to keep when the signal drops mid-session.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [],
      },
    }),
  ],
})
