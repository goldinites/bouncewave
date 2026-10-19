import { expect, test } from '@playwright/test';
import { SCENES } from '../src/shared/scenes';

/**
 * Every background as the player sees it: behind the menus, dimmed during play, at a rally's
 * full heat, and turned for a phone held upright. Drawn on the stand page (e2e/stand), which
 * seeds the randomness and fixes the time, so the same code always gives the same picture.
 *
 * A deliberate change to a background updates its pictures with
 * `npm run test:visual -- --update-snapshots`; look at the new ones before committing them.
 */
const VARIANTS = [
  { name: 'menu', query: 'mode=menu' },
  { name: 'play', query: 'mode=play' },
  { name: 'hot', query: 'mode=hot' },
  { name: 'portrait', query: 'mode=menu&rotated=1' },
] as const;

// The challenges' own backgrounds too, as they arrive (steps 2.7–2.9: all three now)
for (const scene of [...SCENES, 'warehouse', 'dojo', 'brokenNet']) {
  for (const variant of VARIANTS) {
    test(`${scene} ${variant.name}`, async ({ page }) => {
      await page.goto(`e2e/stand/index.html?bg=${scene}&${variant.query}`);
      await page.waitForFunction(() => window.standReady === true);

      await expect(page.locator('canvas')).toHaveScreenshot(`${scene}-${variant.name}.png`);
    });
  }
}
