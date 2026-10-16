import { createAppleSplashScreens, defineConfig } from '@vite-pwa/assets-generator/config';

// iOS launch screens for the home-screen app. Without them iOS shows a black screen while the
// page loads; with them it shows the launch mark on the night sky, and the loader in index.html
// takes over in the same place. Keep .boot__mark's size there in step with the padding below.
// Regenerate with `npm run icons`, then paste the printed <link> tags into index.html with the
// "-light" taken out of their names: the generator prints it, but the files are named without.
// Only the last four iPhone generations: every other device gets the black screen back.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [] },
    maskable: { sizes: [] },
    apple: { sizes: [] },
    appleSplashScreens: createAppleSplashScreens(
      {
        // The mark is drawn 40% of the screen's shorter side
        padding: 0.6,
        resizeOptions: { background: '#0b0320', fit: 'contain' },
        linkMediaOptions: { basePath: '/splash/' },
      },
      [
        'iPhone 17 Pro Max',
        'iPhone 17 Pro',
        'iPhone Air',
        'iPhone 17',
        'iPhone 16 Pro Max',
        'iPhone 16 Pro',
        'iPhone 16 Plus',
        'iPhone 16',
        'iPhone 16e',
        'iPhone 15 Pro Max',
        'iPhone 15 Pro',
        'iPhone 15 Plus',
        'iPhone 15',
        'iPhone 14 Pro Max',
        'iPhone 14 Pro',
        'iPhone 14 Plus',
        'iPhone 14',
      ],
    ),
  },
  images: ['public/splash/mark.svg'],
});
