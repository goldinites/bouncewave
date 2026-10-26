// Films a video of e2e/video/videos.ts on the video stand (ROADMAP 7.3): the game's own
// simulation, effects and renderer frame by frame at 60 fps, its sound rendered offline through
// the game's own mixer, put together by ffmpeg into renders/video/<id>/:
//
// - <id>.mp4 — the video (H.264 and AAC, as Shorts, TikTok, Telegram and Steam take it);
// - frames/ — every half second's frame, to look at without playing it;
// - report.md — where the cuts fall and when the power shots, goals and finales came, to tune a
//   script by.
//
//   npm run video -- overdrive            # as videos.ts sets it (vertical)
//   npm run video -- overdrive-wide       # the same video 16:9
//
// The randomness is seeded: every run films the same video.

import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import ffmpeg from 'ffmpeg-static';
import { createServer } from 'vite';

const OUT_DIR = 'renders/video';
const FPS = 60;
const PREVIEW_EVERY = 30; // frames between the stills kept to look at
const FADE_OUT = 1.2; // s the sound fades over at the end
const LOUDNESS = { TARGET: -14, PEAK: -1 }; // LUFS integrated, dBTP

const ids = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
if (ids.length === 0) {
  console.error('Usage: npm run video -- <video-id> ...   (ids in e2e/video/videos.ts)');
  process.exit(1);
}

/** Runs ffmpeg; resolves when it is done, with its stdin for whoever feeds it. */
function runFfmpeg(args) {
  const child = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))));
  });
  return { stdin: child.stdin, done };
}

/** Writes to a stream, waiting for it to take more when it is full (ffmpeg's failure ends the run). */
const write = (stream, chunk) =>
  new Promise((resolve) => {
    if (stream.write(chunk)) resolve();
    else stream.once('drain', resolve);
  });

const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch();

try {
  for (const id of ids) {
    const started = performance.now();
    // One CSS px a canvas px: the court is filmed at the size the format asks for
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1200 },
      deviceScaleFactor: 1,
    });
    page.on('pageerror', (error) => console.error(`${id}: ${error.message}`));
    await page.goto(`${base}e2e/video/index.html`);
    await page.waitForFunction(() => window.startVideo !== undefined, null, { timeout: 60000 });
    const { frames, width, height } = await page.evaluate((video) => window.startVideo(video), id);

    const dir = `${OUT_DIR}/${id}`;
    await rm(dir, { recursive: true, force: true });
    await mkdir(`${dir}/frames`, { recursive: true });
    const silent = `${dir}/picture.mp4`;
    const picture = runFfmpeg([
      ...['-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-'],
      ...['-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p'],
      ...['-s', `${width}x${height}`, silent],
    ]);
    for (let frame = 0; ; frame++) {
      const url = await page.evaluate(() => window.nextFrame());
      if (url === null) break;
      const jpeg = Buffer.from(url.split(',')[1], 'base64');
      await write(picture.stdin, jpeg);
      if (frame % PREVIEW_EVERY === 0) {
        await writeFile(`${dir}/frames/${String(frame).padStart(5, '0')}.jpg`, jpeg);
      }
      if (frame % (FPS * 2) === 0) process.stdout.write(`\r${id}: frame ${frame} of ${frames}`);
    }
    picture.stdin.end();
    await picture.done;

    const report = await page.evaluate(() => window.videoReport());
    await writeFile(`${dir}/report.md`, report);
    const sound = `${dir}/sound.wav`;
    await writeFile(sound, Buffer.from(await page.evaluate(() => window.renderAudio()), 'base64'));
    await page.close();

    const seconds = frames / FPS;
    const video = `${dir}/${id}.mp4`;
    await runFfmpeg([
      ...['-i', silent, '-i', sound],
      // As loud as the platforms play videos (about -14 LUFS): the game's own mix keeps
      // headroom, and a quiet video loses to the one before it in the feed
      ...[
        '-af',
        `loudnorm=I=${LOUDNESS.TARGET}:TP=${LOUDNESS.PEAK}:LRA=11,` +
          `afade=t=out:st=${(seconds - FADE_OUT).toFixed(3)}:d=${FADE_OUT}`,
      ],
      ...['-ar', '48000'],
      ...['-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart'],
      video,
    ]).done;
    await rm(silent);
    await rm(sound);
    const took = ((performance.now() - started) / 1000).toFixed(0);
    console.info(`\n${report}`);
    console.info(
      `\r${id}: ${seconds.toFixed(1)} s, ${width}×${height}, filmed in ${took} s → ${video}`,
    );
  }
} finally {
  await browser.close();
  await server.close();
}
