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

// Budgets for the pitched instruments: what the 24 MB leaves after the drums and the voices to come
const PITCHED_MEMORY = 14 * 1024 * 1024; // bytes
const PITCHED_RENDER_MS = 4000; // on a CI runner, in the background while the menu plays
// Where a loop joins, the sound after its end may differ from the sound after its start by no
// more than this share of its peak: any more is a click on every held note
const SEAM_SHARE = 0.01;
const SEAM_CHECKED = 0.04; // s compared after the join

test('renders every pitched instrument at every root, its loops seamless', async ({ page }) => {
  await page.goto('./');
  const rate = 48000;
  const report = await page.evaluate(
    async ({ rate, checked }) => {
      const source = (path: string) => `/bouncewave/src/audio/samples/${path}`;
      const { SampleBank } = (await import(
        /* @vite-ignore */ source('SampleBank.ts')
      )) as typeof import('../src/audio/samples/SampleBank');
      const { PITCHED_SAMPLES } = (await import(
        /* @vite-ignore */ source('pitched.ts')
      )) as typeof import('../src/audio/samples/pitched');
      const bank = new SampleBank();
      await bank.renderPitched(rate, PITCHED_SAMPLES);
      const notes = Object.entries(PITCHED_SAMPLES).flatMap(([id, recipe]) =>
        recipe.roots.map((root) => {
          const note = bank.pickNote(id, root)!;
          const channels = Array.from({ length: note.buffer.numberOfChannels }, (_, c) =>
            note.buffer.getChannelData(c),
          );
          let peak = 0;
          let finite = true;
          let seam = 0;
          let tail = 0;
          for (const data of channels) {
            for (const sample of data) {
              if (!Number.isFinite(sample)) finite = false;
              peak = Math.max(peak, Math.abs(sample));
            }
            if (note.loop) {
              const start = Math.round(note.loop.start * rate);
              const end = Math.round(note.loop.end * rate);
              for (let j = 0; j < checked * rate; j++) {
                seam = Math.max(seam, Math.abs(data[start + j] - data[end + j]));
              }
            } else {
              for (const sample of data.subarray(Math.floor(data.length * 0.98))) {
                tail = Math.max(tail, Math.abs(sample));
              }
            }
          }
          return { id: `${id} @${root}`, peak, finite, seam, tail, rate: note.rate };
        }),
      );
      return { notes, bytes: bank.bytes, renderTime: bank.renderTime };
    },
    { rate, checked: SEAM_CHECKED },
  );

  for (const { id, peak, finite, seam, tail, rate: speed } of report.notes) {
    expect(finite, id).toBe(true);
    expect(peak, id).toBeGreaterThan(0.3);
    expect(seam / peak, `${id} loops seamlessly`).toBeLessThan(SEAM_SHARE);
    expect(tail / peak, `${id} dies away`).toBeLessThan(TAIL_SHARE);
    // A root plays itself within the few cents its loop's tuning moved it
    expect(Math.abs(1200 * Math.log2(speed)), id).toBeLessThan(50);
  }
  expect(report.bytes).toBeLessThan(PITCHED_MEMORY);
  expect(report.renderTime).toBeLessThan(PITCHED_RENDER_MS);
  test.info().annotations.push({
    type: 'pitched',
    description: `${(report.bytes / 1048576).toFixed(2)} MB, ${report.renderTime.toFixed(0)} ms`,
  });
});
