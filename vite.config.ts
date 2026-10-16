/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';
import { BACKGROUND } from './src/shared/palette';

export default defineConfig({
  base: '/bouncewave/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    // The background color index.html can't import (see BACKGROUND)
    {
      name: 'background-color',
      transformIndexHtml: (html) => html.replaceAll('__BACKGROUND__', BACKGROUND),
    },
    // Installable and playable offline: the whole game is precached, a new deploy swaps in on the next launch
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Bouncewave',
        short_name: 'Bouncewave',
        description: 'Synthwave pong with procedural music, neon backgrounds and an AI opponent.',
        lang: 'en',
        theme_color: BACKGROUND,
        background_color: BACKGROUND,
        display: 'standalone',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        categories: ['games', 'entertainment'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // iOS keeps its own copy of the launch screen it shows; no need to download them all
        globIgnores: ['splash/**'],
      },
    }),
  ],
  server: {
    port: 3000,
    open: true,
  },
  test: {
    environment: 'happy-dom',
  },
});
