const TAPS_TO_UNLOCK = 5;
// Taps further apart than this start the count over
const TAP_GAP_MS = 500;

/**
 * The touch way into the classic mode, for a phone with no keyboard for the Konami code and,
 * installed as an app, no address bar for `?classic`: five quick taps on the menu's title.
 */
export class TitleTaps {
  private count = 0;
  private lastTap = -Infinity;
  private readonly listeners = new AbortController();

  constructor(
    title: HTMLElement,
    onComplete: () => void,
    now: () => number = () => performance.now(),
  ) {
    title.addEventListener(
      'pointerdown',
      () => {
        const time = now();
        this.count = time - this.lastTap < TAP_GAP_MS ? this.count + 1 : 1;
        this.lastTap = time;

        if (this.count === TAPS_TO_UNLOCK) {
          this.count = 0;
          onComplete();
        }
      },
      { signal: this.listeners.signal },
    );
  }

  public dispose(): void {
    this.listeners.abort();
  }
}
