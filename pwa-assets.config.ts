import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Home-screen icons drawn from the favicon; maskable and Apple ones sit on the game's night sky
// so the launcher's crop never shows a white square. Regenerate with `npm run icons`.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#0b0320' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#0b0320' } },
  },
  images: ['public/favicon.svg'],
});
