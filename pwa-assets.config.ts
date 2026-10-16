import { defineConfig } from '@vite-pwa/assets-generator/config';

// Home-screen and install icons, drawn from the app icon. It is full bleed with its own night sky
// and keeps everything that matters inside the maskable safe circle, so none of them is padded.
// The favicon is a separate, simpler mark: see pwa-assets.favicon.config.ts. Regenerate both with
// `npm run icons`.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [64, 192, 512], padding: 0 },
    maskable: { sizes: [512], padding: 0 },
    apple: { sizes: [180], padding: 0 },
  },
  images: ['public/app-icon.svg'],
});
