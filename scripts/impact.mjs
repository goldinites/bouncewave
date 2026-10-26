// Films hits frame by frame (docs/ROADMAP.md, 6.1): a scripted rally played on the impact stand
// (e2e/impact) through the game's own simulation, effects and renderer, written to
// renders/impact/<scene>/:
//
// - <moment>-close.png — the frames around a moment, close up around the contact;
// - <moment>-whole.png — the same frames, the whole screen at half size (shake, flash);
// - report.md — what each moment was: its speed and rally.
//
// The moments: a plain hit slow and fast, a perfect hit, the perfect hit that fills Overdrive,
// the power shot, a wall bounce and the goal. The randomness is seeded: every run films the same
// frames, so a change to the effects can be compared before and after.
//
//   npm run render:impact                      # lasers
//   npm run render:impact -- lasers neonCity   # scene ids in src/shared/scenes.ts
//   npm run render:impact -- --reduced-motion lasers

import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const OUT_DIR = 'renders/impact';

const args = process.argv.slice(2);
const isReducedMotion = args.includes('--reduced-motion');
const scenes = args.filter((arg) => !arg.startsWith('--'));
if (scenes.length === 0) scenes.push('lasers');

const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch();

try {
  for (const scene of scenes) {
    // One CSS px a canvas px: the court is drawn 800 × 500, as the sheets measure it
    const page = await browser.newPage({
      viewport: { width: 800, height: 500 },
      deviceScaleFactor: 1,
      reducedMotion: isReducedMotion ? 'reduce' : 'no-preference',
    });
    page.on('pageerror', (error) => console.error(`${scene}: ${error.message}`));
    await page.goto(`${base}e2e/impact/index.html`);
    await page.waitForFunction(() => window.renderImpact !== undefined, null, { timeout: 60000 });
    const { markdown, images } = await page.evaluate((options) => window.renderImpact(options), {
      scene,
    });
    await page.close();

    const dir = `${OUT_DIR}/${scene}${isReducedMotion ? '-reduced' : ''}`;
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/report.md`, markdown);
    for (const [name, url] of Object.entries(images)) {
      await writeFile(`${dir}/${name}`, Buffer.from(url.split(',')[1], 'base64'));
    }
    console.info(`${markdown}→ ${dir}/\n`);
  }
} finally {
  await browser.close();
  await server.close();
}
