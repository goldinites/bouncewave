import { defineConfig, devices } from '@playwright/test';

// The end-to-end checks run against the dev server on a port of their own, so a dev server the
// developer already has open on 3000 doesn't get in the way
const PORT = 4173;

/**
 * Two kinds of end-to-end checks:
 * - smoke (`npm run test:e2e`): the game opens, plays, pauses and goes back to the menu without
 *   an error, on a desktop and on a phone either way round. Runs in CI.
 * - visual (`npm run test:visual`): every background, drawn deterministically on the stand page
 *   (e2e/stand), compared with its saved picture. Local only: the baselines are rendered on
 *   Windows, and Linux in CI draws text and edges slightly differently.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}-{platform}{ext}',
  expect: {
    // Same machine, same browser build: only a real change in the picture should get past this
    toHaveScreenshot: { maxDiffPixelRatio: 0.002 },
  },
  use: {
    baseURL: `http://localhost:${PORT}/bouncewave/`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      testMatch: 'smoke.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'phone-portrait',
      testMatch: 'smoke.spec.ts',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'phone-landscape',
      testMatch: 'smoke.spec.ts',
      use: { ...devices['Pixel 7 landscape'] },
    },
    {
      name: 'visual',
      testMatch: 'visual.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 800, height: 500 } },
    },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --open false`,
    url: `http://localhost:${PORT}/bouncewave/`,
    reuseExistingServer: !process.env.CI,
  },
});
