// Measures how loud songs play, part by part, the way the soundtrack is levelled (docs/AUDIO.md,
// "Как делаем трек"): each part is held on the listening stand at a fixed intensity in Chromium
// and read off the stand's K-weighted meter. Prints each part's average and the `level` change
// that would bring the song to the target.
//
//   npm run loudness -- neon-cathedral sunset-strip
//   npm run loudness -- --parts=hook,hot outrun-o3-sunset
//
// --lead=<voice> plays the melodies on that lead, as the stand's switch does, and --mute= silences
// layers: `--mute=drums,bass,pads,arp,fx --lead=sax` hears the sax alone, to level a lead voice
// against the others (LEAD_VOLUME in Arrangement.ts).

import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const TARGET = -25; // dB: where the soundtrack sits
const INTENSITY = 0.7; // a rally's heat, held while measuring
const LISTEN_MS = 12000; // per part: a few bars, past the switch into it
// The music bus's compressor takes about a quarter of any change: a level moves the meter by
// about three quarters of itself
const LEVEL_EFFECT = 0.75;
const PARALLEL = 4;

const args = process.argv.slice(2);
const option = (name) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(`--${name}=`.length) ?? null;
const parts = option('parts')?.split(',') ?? ['verse', 'chorus'];
const lead = option('lead');
const mute = option('mute');
const songs = args.filter((arg) => !arg.startsWith('--'));
if (songs.length === 0) {
  console.error('Usage: npm run loudness -- [--parts=verse,chorus] <song-id> ...');
  process.exit(1);
}

const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

/** One song's parts, each as the stand's average over its listening time. */
async function measure(song) {
  const page = await browser.newPage();
  await page.goto(`${base}?debug&song=${song}&part=${parts[0]}${mute ? `&mute=${mute}` : ''}`);
  await page.waitForTimeout(800);
  await page.click('[data-stand="toggle"]');
  if (lead) await page.selectOption('select[data-stand="leadVoice"]', lead);
  await page.evaluate((level) => {
    const range = document.querySelector('input[data-level="intensity"]');
    range.value = String(level);
    range.dispatchEvent(new Event('input'));
  }, INTENSITY);
  const result = {};
  for (const part of parts) {
    await page.selectOption('select[data-stand="part"]', part);
    await page.waitForTimeout(LISTEN_MS);
    const readout = await page.evaluate(
      () =>
        [...document.querySelectorAll('[aria-label="Sound stand (debug)"] span')]
          .map((span) => span.textContent)
          .find((text) => text?.includes('bar ')) ?? '',
    );
    const match = /avg (-?[\d.]+)\)/.exec(readout);
    result[part] = match ? Number(match[1]) : NaN;
  }
  await page.close();
  return result;
}

try {
  for (let i = 0; i < songs.length; i += PARALLEL) {
    const batch = songs.slice(i, i + PARALLEL);
    const results = await Promise.all(batch.map(measure));
    batch.forEach((song, j) => {
      const values = Object.values(results[j]);
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const change = Math.round(((TARGET - mean) / LEVEL_EFFECT) * 2) / 2;
      const each = Object.entries(results[j])
        .map(([part, value]) => `${part} ${value.toFixed(1)}`)
        .join(', ');
      console.info(
        `${song}: ${each} → mean ${mean.toFixed(1)} dB, level ${change >= 0 ? '+' : ''}${change}`,
      );
    });
  }
} finally {
  await browser.close();
  await server.close();
}
