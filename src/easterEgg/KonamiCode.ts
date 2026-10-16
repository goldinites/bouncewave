const KONAMI_SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA',
];

/**
 * The classic arcade cheat code. Listens globally (alongside whatever else reads the same
 * keys, e.g. paddle control) and calls back once the sequence lands in order.
 */
export class KonamiCode {
  private progress = 0;
  private readonly listeners = new AbortController();

  constructor(onComplete: () => void) {
    window.addEventListener(
      'keydown',
      (event) => {
        const expected = KONAMI_SEQUENCE[this.progress];
        const matched = event.code === expected;
        this.progress = matched ? this.progress + 1 : event.code === KONAMI_SEQUENCE[0] ? 1 : 0;

        if (this.progress === KONAMI_SEQUENCE.length) {
          this.progress = 0;
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
