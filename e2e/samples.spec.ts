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
// The action sounds' budget is 300 ms on a phone (docs/AUDIO.md, "Бюджеты"), scaled as the
// drums' is for a CI runner
const ACTIONS_RENDER_MS = 1500;
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

test('renders every action sound’s layers, sounding, dying away, within budget', async ({
  page,
}) => {
  await page.goto('./');
  const report = await page.evaluate(async () => {
    const source = (path: string) => `/bouncewave/src/audio/samples/${path}`;
    const { SampleBank } = (await import(
      /* @vite-ignore */ source('SampleBank.ts')
    )) as typeof import('../src/audio/samples/SampleBank');
    const { ACTION_PITCHED, ACTION_SAMPLES } = (await import(
      /* @vite-ignore */ source('actions.ts')
    )) as typeof import('../src/audio/samples/actions');
    const bank = new SampleBank();
    await bank.render(48000, ACTION_SAMPLES);
    await bank.renderPitched(48000, ACTION_PITCHED);
    const measure = (buffer: AudioBuffer) => {
      const data = buffer.getChannelData(0);
      const tail = data.subarray(Math.floor(data.length * 0.98));
      let peak = 0;
      for (const sample of data) peak = Math.max(peak, Math.abs(sample));
      return { peak, tailPeak: Math.max(...tail.map(Math.abs)) };
    };
    const layers = Object.keys(ACTION_SAMPLES).map((id) => ({ id, ...measure(bank.pick(id)!) }));
    const bodies = Object.entries(ACTION_PITCHED).flatMap(([id, recipe]) =>
      recipe.roots.map((root) => ({
        id: `${id} @${root}`,
        ...measure(bank.pickNote(id, root)!.buffer),
      })),
    );
    return { sounds: [...layers, ...bodies], renderTime: bank.renderTime };
  });

  for (const { id, peak, tailPeak } of report.sounds) {
    expect(peak, id).toBeGreaterThan(0.3);
    expect(tailPeak / peak, `${id} dies away`).toBeLessThan(TAIL_SHARE);
  }
  expect(report.renderTime).toBeLessThan(ACTIONS_RENDER_MS);
  test.info().annotations.push({
    type: 'actions',
    description: `${report.renderTime.toFixed(0)} ms`,
  });
});

test('renders the wider palette’s percussion and hits, sounding and dying away', async ({
  page,
}) => {
  await page.goto('./');
  const report = await page.evaluate(async () => {
    const source = (path: string) => `/bouncewave/src/audio/samples/${path}`;
    const { SampleBank } = (await import(
      /* @vite-ignore */ source('SampleBank.ts')
    )) as typeof import('../src/audio/samples/SampleBank');
    const { EXTRA_DRUMS, FX_HITS } = (await import(
      /* @vite-ignore */ source('percussion.ts')
    )) as typeof import('../src/audio/samples/percussion');
    const recipes = { ...EXTRA_DRUMS, ...FX_HITS };
    const bank = new SampleBank();
    await bank.render(48000, recipes);
    return Object.entries(recipes).flatMap(([id, recipe]) =>
      Array.from({ length: recipe.variants }, () => {
        const data = bank.pick(id)!.getChannelData(0);
        let peak = 0;
        let finite = true;
        for (const sample of data) {
          if (!Number.isFinite(sample)) finite = false;
          peak = Math.max(peak, Math.abs(sample));
        }
        const tail = data.subarray(Math.floor(data.length * 0.98));
        return { id, peak, finite, tailPeak: Math.max(...tail.map(Math.abs)) };
      }),
    );
  });
  for (const { id, peak, finite, tailPeak } of report) {
    expect(finite, id).toBe(true);
    expect(peak, id).toBeGreaterThan(0.3);
    expect(tailPeak / peak, `${id} dies away`).toBeLessThan(TAIL_SHARE);
  }
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
      const { EXTRA_LEADS, LOW_TWINS } = (await import(
        /* @vite-ignore */ source('leads.ts')
      )) as typeof import('../src/audio/samples/leads');
      const { EXTRA_PITCHED } = (await import(
        /* @vite-ignore */ source('extra.ts')
      )) as typeof import('../src/audio/samples/extra');
      const bank = new SampleBank();
      await bank.renderPitched(rate, PITCHED_SAMPLES);
      // The wider palette is checked too, in a bank of its own: it is rendered only when a song
      // plays it or the stand asks, so it doesn't count toward the game's memory; so are the
      // leads' low twins, at the roots under their own
      const auditions = new SampleBank();
      const twins = Object.fromEntries(
        Object.values(LOW_TWINS).map(({ id, recipe }) => [id, recipe]),
      );
      await auditions.renderPitched(rate, { ...EXTRA_LEADS, ...EXTRA_PITCHED, ...twins });
      const recipes = { ...PITCHED_SAMPLES, ...EXTRA_LEADS, ...EXTRA_PITCHED, ...twins };
      const notes = Object.entries(recipes).flatMap(([id, recipe]) =>
        recipe.roots.map((root) => {
          const note = (bank.pickNote(id, root) ?? auditions.pickNote(id, root))!;
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
              // A sound may be rendered below the device's rate (RENDER_RATE): its own counts
              const own = note.buffer.sampleRate;
              const start = Math.round(note.loop.start * own);
              const end = Math.round(note.loop.end * own);
              for (let j = 0; j < checked * own; j++) {
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

const TRANSITIONS_MEMORY = 4 * 1024 * 1024; // bytes
// A swell starts quiet and peaks late: its first tenth no louder than this share of its peak,
// its peak in its last third, and its very last sample silent (it stops, not clicks)
const SWELL_HEAD_SHARE = 0.1;
const SWELL_END_SHARE = 0.01;

test('renders every transition: swells build to their end, the rest die away', async ({ page }) => {
  await page.goto('./');
  const report = await page.evaluate(async () => {
    const source = (path: string) => `/bouncewave/src/audio/samples/${path}`;
    const { SampleBank } = (await import(
      /* @vite-ignore */ source('SampleBank.ts')
    )) as typeof import('../src/audio/samples/SampleBank');
    const { TRANSITION_SAMPLES } = (await import(
      /* @vite-ignore */ source('transitions.ts')
    )) as typeof import('../src/audio/samples/transitions');
    const bank = new SampleBank();
    await bank.render(48000, TRANSITION_SAMPLES);
    const sounds = Object.entries(TRANSITION_SAMPLES).flatMap(([id, recipe]) =>
      Array.from({ length: recipe.variants }, () => {
        const data = bank.pick(id)!.getChannelData(0);
        let peak = 0;
        let peakAt = 0;
        let finite = true;
        data.forEach((sample, i) => {
          if (!Number.isFinite(sample)) finite = false;
          if (Math.abs(sample) > peak) [peak, peakAt] = [Math.abs(sample), i / data.length];
        });
        const loudest = (from: number, to: number) =>
          Math.max(
            ...data
              .subarray(Math.floor(from * data.length), Math.floor(to * data.length))
              .map(Math.abs),
          );
        return {
          id,
          isSwell: 'shape' in recipe && recipe.shape === 'swell',
          peak,
          peakAt,
          finite,
          head: loudest(0, 0.1),
          tail: loudest(0.98, 1),
          last: Math.abs(data[data.length - 1]),
        };
      }),
    );
    return { sounds, bytes: bank.bytes };
  });

  for (const { id, isSwell, peak, peakAt, finite, head, tail, last } of report.sounds) {
    expect(finite, id).toBe(true);
    expect(peak, id).toBeGreaterThan(0.3);
    if (isSwell) {
      expect(head / peak, `${id} starts quiet`).toBeLessThan(SWELL_HEAD_SHARE);
      expect(peakAt, `${id} peaks late`).toBeGreaterThan(2 / 3);
      expect(last / peak, `${id} stops cleanly`).toBeLessThan(SWELL_END_SHARE);
    } else {
      expect(tail / peak, `${id} dies away`).toBeLessThan(TAIL_SHARE);
    }
  }
  expect(report.bytes).toBeLessThan(TRANSITIONS_MEMORY);
});

// The whole palette's memory (docs/AUDIO.md, "Бюджеты"): the action sounds and transitions
// rendered at the first touch, plus the sounds of the songs in play, walking every song in turn
// as a long session does
const PALETTE_MEMORY = 24 * 1024 * 1024; // bytes

test('keeps every rendered sound within budget through a session of every song', async ({
  page,
}) => {
  await page.goto('./');
  const report = await page.evaluate(async () => {
    const load = async <T>(path: string) =>
      (await import(/* @vite-ignore */ `/bouncewave/src/audio/${path}`)) as T;
    const { SampleBank } =
      await load<typeof import('../src/audio/samples/SampleBank')>('samples/SampleBank.ts');
    const { TRANSITION_SAMPLES } =
      await load<typeof import('../src/audio/samples/transitions')>('samples/transitions.ts');
    const { ACTION_PITCHED, ACTION_SAMPLES } =
      await load<typeof import('../src/audio/samples/actions')>('samples/actions.ts');
    const { SONGS } = await load<typeof import('../src/audio/music/songs')>('music/songs.ts');
    const { soundsFor, unneeded } =
      await load<typeof import('../src/audio/music/palette')>('music/palette.ts');
    const rate = 48000;
    const bank = new SampleBank();
    await bank.render(rate, TRANSITION_SAMPLES);
    await bank.render(rate, ACTION_SAMPLES);
    await bank.renderPitched(rate, ACTION_PITCHED);
    const kept = bank.bytes;
    let peak = kept;
    let peakAt = '';
    // Twice round, so the first songs come back after the last
    const order = [...SONGS, ...SONGS];
    for (let i = 1; i < order.length; i++) {
      const [playing, next] = [order[i - 1], order[i]];
      bank.release(unneeded([playing, next]));
      for (const song of [playing, next]) {
        const { pitched, oneShots } = soundsFor(song);
        await bank.renderPitched(rate, pitched);
        await bank.render(rate, oneShots);
      }
      if (bank.bytes > peak) {
        peak = bank.bytes;
        peakAt = `${playing.title} → ${next.title}`;
      }
    }
    return { kept, peak, peakAt };
  });
  test.info().annotations.push({
    type: 'palette',
    description: `kept ${(report.kept / 1048576).toFixed(1)} MB, peak ${(report.peak / 1048576).toFixed(1)} MB at ${report.peakAt}`,
  });
  console.log(report);
  expect(report.peak).toBeLessThan(PALETTE_MEMORY);
});

// A song's own instruments are rendered just before it plays, during a match too (docs/AUDIO.md,
// "Бюджеты": 500 ms on a phone), scaled as the drums' is for a CI runner. Meanwhile the page
// must keep drawing: no stretch of the main thread longer than a few frames
const SONG_RENDER_MS = 1500;
const SONG_LONGEST_STALL_MS = 80; // built all at once, a song's sounds held it ~110 ms here

test("renders each song's instruments within budget, the page still drawing", async ({ page }) => {
  await page.goto('./');
  const report = await page.evaluate(async () => {
    const source = (path: string) => `/bouncewave/src/audio/${path}`;
    const { SampleBank } = (await import(
      /* @vite-ignore */ source('samples/SampleBank.ts')
    )) as typeof import('../src/audio/samples/SampleBank');
    const { soundsFor } = (await import(
      /* @vite-ignore */ source('music/palette.ts')
    )) as typeof import('../src/audio/music/palette');
    const { SONGS } = (await import(
      /* @vite-ignore */ source('music/songs.ts')
    )) as typeof import('../src/audio/music/songs');
    /** The longest the main thread was held while `during` ran: a timer that should tick every
     * few ms, and how late it came (frames don't run in a page nobody sees). */
    const longestStall = async (during: () => Promise<unknown>) => {
      let longest = 0;
      let last = performance.now();
      const watch = setInterval(() => {
        const now = performance.now();
        longest = Math.max(longest, now - last);
        last = now;
      }, 4);
      await during();
      clearInterval(watch);
      return longest;
    };
    // The timer's own lateness with nothing to do, to tell the renders' stalls from it
    const idle = await longestStall(() => new Promise((resolve) => setTimeout(resolve, 200)));
    const songs = [];
    for (const song of SONGS) {
      const bank = new SampleBank();
      const { pitched, oneShots } = soundsFor(song);
      const longest = await longestStall(() =>
        Promise.all([bank.renderPitched(48000, pitched), bank.render(48000, oneShots)]),
      );
      songs.push({ title: song.title, renderTime: bank.renderTime, longest, bytes: bank.bytes });
    }
    return { idle, songs };
  });
  for (const { title, renderTime, longest } of report.songs) {
    expect(renderTime, title).toBeLessThan(SONG_RENDER_MS);
    expect(longest, `${title} stalls the page`).toBeLessThan(SONG_LONGEST_STALL_MS);
  }
  test.info().annotations.push({
    type: 'songs',
    description: [
      `idle ${report.idle.toFixed(0)} ms`,
      ...report.songs.map(
        ({ title, renderTime, longest, bytes }) =>
          `${title}: ${(bytes / 1048576).toFixed(2)} MB, ${renderTime.toFixed(0)} ms, stall ${longest.toFixed(0)} ms`,
      ),
    ].join('; '),
  });
});
