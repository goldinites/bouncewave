/*
 * The visual checks' stand (served by the dev server, never built): draws one background the
 * same way every time, for e2e/visual.spec.ts to compare with its saved picture.
 *
 * ?bg=<scene>&mode=<menu|play|hot>&rotated=1
 * - menu: lights full, as behind the menus; play: dimmed, as during a rally; hot: a rally at
 *   full climax, lights as high as play allows them
 * - rotated: drawn for a phone held upright, where the stage is turned in CSS
 *
 * Sets `window.standReady` once the frame is on the canvas.
 */
import '@fontsource-variable/tektur/wght.css';

// A fixed seed for everything the backgrounds scatter at random (stars, rain, petals, static).
// Set before the backgrounds are imported, so their module-level randomness is seeded too
let seed = 0x5eed;
Math.random = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Seconds of animation run before the picture is taken, at 60 frames a second
const SECONDS = 3;
const FRAME = 1 / 60;

const MOODS = {
  menu: { laserIntensity: 1, climax: 0, celebration: 0 },
  play: { laserIntensity: 0.12, climax: 0, celebration: 0 },
  // The renderer lets the lights rise to 0.6 at full climax during play
  hot: { laserIntensity: 0.6, climax: 1, celebration: 0 },
} as const;

declare global {
  interface Window {
    standReady?: boolean;
  }
}

const params = new URLSearchParams(location.search);
const scene = params.get('bg') ?? 'lasers';
const mood = MOODS[(params.get('mode') ?? 'menu') as keyof typeof MOODS] ?? MOODS.menu;
const isRotated = params.get('rotated') === '1';

const { gameFont } = await import('@/shared/fonts');
const { isSceneId } = await import('@/shared/scenes');
const { BackgroundRenderer } = await import('@/render/BackgroundRenderer');

if (!isSceneId(scene)) throw new Error(`No background called ${scene}`);
// The OSD text and any other canvas text must be drawn in the game's font, not a fallback
await document.fonts.load(gameFont(700, 16));

const ctx = document.querySelector('canvas')?.getContext('2d', { alpha: false });
if (!ctx) throw new Error('No canvas to draw on');

const renderer = new BackgroundRenderer();
renderer.pin(scene);
for (let time = 0; time <= SECONDS; time += FRAME) {
  renderer.render(ctx, null, time, 0, isRotated, mood);
}
window.standReady = true;
