import { expect, test } from '@playwright/test';

/**
 * The instruments rendered from code (audio/samples), checked in a real browser, which unit
 * tests can't do: every one renders, sounds, has died away by its end (a sound cut off mid-tail
 * clicks), and the lot stays within the budgets of docs/AUDIO.md.
 */

// Budgets for the drums alone: the whole palette has 24 MB and 300 ms for the action sounds,
// so the drums, rendered first, take a share of it
const DRUMS_MEMORY = 5 * 1024 * 1024; // bytes
const DRUMS_RENDER_MS = 1500; // on a CI runner, slower than a phone's best
// The last 2% of a sound may be no louder than this share of its peak
const TAIL_SHARE = 0.02;

test('renders every drum sound, sounding, dying away, within budget', async ({ page }) => {
  await page.goto('./');
  const report = await page.evaluate(async () => {
    // The dev server serves the sources, so the bank is rendered here exactly as in the game
    const source = (path: string) => `/bouncewave/src/audio/samples/${path}`;
    const { SampleBank } = (await import(
      /* @vite-ignore */ source('SampleBank.ts')
    )) as typeof import('../src/audio/samples/SampleBank');
    const { DRUM_SAMPLES } = (await import(
      /* @vite-ignore */ source('drums.ts')
    )) as typeof import('../src/audio/samples/drums');
    const bank = new SampleBank();
    await bank.render(48000, DRUM_SAMPLES);
    const sounds = Object.entries(DRUM_SAMPLES).map(([id, recipe]) => {
      const variants = Array.from({ length: recipe.variants }, () => bank.pick(id)!);
      return {
        id,
        variants: variants.map((buffer) => {
          const data = buffer.getChannelData(0);
          const tail = data.subarray(Math.floor(data.length * 0.98));
          let peak = 0;
          let finite = true;
          for (const sample of data) {
            if (!Number.isFinite(sample)) finite = false;
            peak = Math.max(peak, Math.abs(sample));
          }
          return { peak, finite, tailPeak: Math.max(...tail.map(Math.abs)) };
        }),
        distinct: new Set(variants.map((b) => b.getChannelData(0)[2000])).size,
      };
    });
    return { sounds, bytes: bank.bytes, renderTime: bank.renderTime };
  });

  for (const { id, variants, distinct } of report.sounds) {
    for (const { peak, finite, tailPeak } of variants) {
      expect(finite, id).toBe(true);
      expect(peak, id).toBeGreaterThan(0.3);
      expect(peak, id).toBeLessThanOrEqual(1.0001);
      expect(tailPeak / peak, `${id} dies away`).toBeLessThan(TAIL_SHARE);
    }
    expect(distinct, `${id} variants differ`).toBe(variants.length);
  }
  expect(report.bytes).toBeLessThan(DRUMS_MEMORY);
  expect(report.renderTime).toBeLessThan(DRUMS_RENDER_MS);
  test.info().annotations.push({
    type: 'samples',
    description: `${(report.bytes / 1048576).toFixed(2)} MB, ${report.renderTime.toFixed(0)} ms`,
  });
});
