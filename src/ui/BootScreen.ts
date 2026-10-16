import { gameFont } from '@/shared/fonts';

/** How long the loader waits for the font before showing the game in the fallback face. */
const FONT_TIMEOUT_MS = 2500;

/** Latin and Cyrillic come in separate files; the menu needs whichever the language uses. */
const FONT_SAMPLE = 'BOUNCEWAVE Ая';

/** Fetches the faces the menu draws with; main.css only declares them. */
async function whenFontReady(): Promise<void> {
  await Promise.all(
    [400, 700, 900].map((weight) => document.fonts?.load(gameFont(weight, 16), FONT_SAMPLE)),
  );
}

/**
 * Fades out the loader from index.html once the game has drawn its first frame in its own
 * font, then takes it out of the page.
 */
export function dismissBootScreen(): void {
  const boot = document.getElementById('boot');
  if (!boot) return;

  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, FONT_TIMEOUT_MS));
  void Promise.race([whenFontReady().catch(() => {}), timeout]).then(() => {
    // Two frames: the first one the game draws, the next one shown with it on screen
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        boot.addEventListener('transitionend', () => boot.remove(), { once: true });
        boot.classList.add('boot--done');
      }),
    );
  });
}
