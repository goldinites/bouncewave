import { defineConfig } from '@vite-pwa/assets-generator/config';

// favicon.ico for browsers that skip the SVG, drawn from the favicon rather than the app icon:
// at 16–48 px only the paddle and the ball still read.
export default defineConfig({
  preset: {
    transparent: { sizes: [], padding: 0, favicons: [[48, 'favicon.ico']] },
    maskable: { sizes: [] },
    apple: { sizes: [] },
  },
  images: ['public/favicon.svg'],
});
