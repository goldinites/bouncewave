// Renders songs into pictures and numbers (docs/AUDIO.md, "Как делаем трек"): each song's whole
// form is played silently in Chromium, faster than real time, through the game's own mixer
// (e2e/render), and written to renders/<song-id>/:
//
// - spectrogram.png — where the mix is mud and where it is empty, bar by bar, the phone's cut
//   marked in red;
// - lead-arp.png — the melody (magenta) and the arpeggio (cyan) alone on one picture: white
//   where they share a register and the ear may hear one line;
// - similarity.png — how alike every two bars sound: a track that never changes is an even grid;
// - report.md — loudness by part and band and the `level` change to -25 dB, what a phone's
//   speaker keeps, how far the paddle hits stand above the loudest part, the melody's density.
//
//   npm run render -- neon-cathedral kabukicho-rain
//   npm run render -- --lead=sax --mute=drums sunset-strip
//
// --lead=<voice> plays the melodies on that lead and --kit=<kit> the drums on that kit (the
// stand's `?lead=`, `?kit=`); --mute= silences layers
// in the mix (the melody and arpeggio pictures always have their layer alone).

import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const OUT_DIR = 'renders';
const PARALLEL = 2; // each render holds a few minutes of audio several times over

const args = process.argv.slice(2);
const option = (name) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(`--${name}=`.length) ?? null;
const lead = option('lead') ?? undefined;
const kit = option('kit') ?? undefined;
const mute = option('mute')?.split(',') ?? [];
const songs = args.filter((arg) => !arg.startsWith('--'));
if (songs.length === 0) {
  console.error(
    'Usage: npm run render -- [--lead=<voice>] [--kit=<kit>] [--mute=drums,...] <song-id> ...',
  );
  process.exit(1);
}

const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch();

/** One song rendered on its own page, its files written; resolves to its report's first lines. */
async function render(song) {
  const page = await browser.newPage();
  page.on('pageerror', (error) => console.error(`${song}: ${error.message}`));
  await page.goto(`${base}e2e/render/index.html`);
  await page.waitForFunction(() => window.renderSong !== undefined, null, { timeout: 60000 });
  const { markdown, images } = await page.evaluate((options) => window.renderSong(options), {
    song,
    lead,
    kit,
    mute,
  });
  await page.close();
  const dir = `${OUT_DIR}/${song}`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/report.md`, markdown);
  for (const [name, url] of Object.entries(images)) {
    await writeFile(`${dir}/${name}`, Buffer.from(url.split(',')[1], 'base64'));
  }
  return { dir, markdown };
}

try {
  for (let i = 0; i < songs.length; i += PARALLEL) {
    const results = await Promise.all(songs.slice(i, i + PARALLEL).map(render));
    for (const { dir, markdown } of results) console.info(`${markdown}\n→ ${dir}/\n`);
  }
} finally {
  await browser.close();
  await server.close();
}
