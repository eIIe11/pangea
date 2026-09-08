import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Pangea',
        short_name: 'Pangea',
        description: 'Control surface for the SESSION systematic trading platform.',
        theme_color: '#0e1112',
        background_color: '#0e1112',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Now', url: '/?screen=now' },
          { name: 'Trades', url: '/?screen=trades' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // The shell is cached so the kill switch loads on bad wifi; account data is
        // never served from cache — a stale number without a timestamp is a lie.
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: { host: true, port: 5173 },
  build: { target: 'es2022' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
