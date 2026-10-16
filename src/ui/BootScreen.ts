/** How long the loader waits for the font before showing the game in the fallback face. */
const FONT_TIMEOUT_MS = 2500;

/** Latin and Cyrillic come in separate files; the menu needs whichever the language uses. */
const FONT_SAMPLE = 'BOUNCEWAVE Ая';

/** Resolves once the Google Fonts stylesheet has loaded (or failed: offline on a first launch). */
function whenStylesheetLoaded(link: HTMLLinkElement): Promise<void> {
  if (link.sheet) return Promise.resolve();
  return new Promise((resolve) => {
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => resolve(), { once: true });
  });
}

async function whenFontReady(): Promise<void> {
  const link = document.getElementById('fontStylesheet');
  if (link instanceof HTMLLinkElement) await whenStylesheetLoaded(link);
  // The stylesheet only declares the font; this fetches the faces the menu draws with
  await Promise.all(
    [400, 700, 900].map((weight) => document.fonts?.load(`${weight} 1em Tektur`, FONT_SAMPLE)),
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
