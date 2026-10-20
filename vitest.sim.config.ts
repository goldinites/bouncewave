import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

/**
 * The balance report (npm run sim): long AI-against-AI simulations whose tables guide the
 * balancing steps. Not a check: it asserts nothing and stays out of npm test and CI.
 */
export default defineConfig({
  ...viteConfig,
  test: {
    ...viteConfig.test,
    include: ['tests/**/*.sim.ts'],
    testTimeout: 30 * 60_000,
  },
});
