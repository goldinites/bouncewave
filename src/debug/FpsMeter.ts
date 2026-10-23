/**
 * Developer-only FPS overlay.
 *
 * - Lives in its own DOM element on top of the page (never drawn on the canvas).
 * - Hidden by default. Enable with `?debug` in the URL or toggle with F3; the other developer
 *   tools (the background menu) show and hide with it.
 * - Costs almost nothing while hidden: tick() returns immediately.
 * - Also shows the last error the game caught and survived (reportError), for devices
 *   without a developer console such as iPhones.
 */

const BUFFER_SIZE = 360; // enough for ~3 s at 120 Hz
const WINDOW_MS = 3000; // stats are computed over the last 3 s
const REFRESH_MS = 500; // how often the text is redrawn
const GAP_MS = 1000; // longer gaps (hidden tab, debugger pause) are ignored

export class FpsMeter {
  private readonly el: HTMLDivElement;
  private readonly deltas = new Float32Array(BUFFER_SIZE);
  private head = 0;
  private count = 0;
  private lastTimestamp = 0;
  private lastRefresh = 0;
  private statsText = '… fps';
  private detail = '';
  private errorCount = 0;
  private lastError = '';
  private visible = false;
  private readonly onVisibilityChange: (isVisible: boolean) => void;

  /** @param onVisibilityChange told whenever the overlay is shown or hidden, at once included */
  constructor(onVisibilityChange: (isVisible: boolean) => void = () => {}) {
    this.onVisibilityChange = onVisibilityChange;
    this.el = document.createElement('div');
    this.el.setAttribute('aria-hidden', 'true');
    this.el.className = 'dbg-fps dbg-mono';
    // Placed by the debug dock (DebugDock.ts)
    Object.assign(this.el.style, {
      whiteSpace: 'pre-wrap',
      pointerEvents: 'none',
      userSelect: 'none',
      display: 'none',
    });
    document.body.appendChild(this.el);

    this.setVisible(new URLSearchParams(window.location.search).has('debug'));
    window.addEventListener('keydown', this.onKeyDown);
  }

  /** Whether the tools are shown (`?debug`, F3). */
  public get isShown(): boolean {
    return this.visible;
  }

  /** The panel's element, for the debug dock to place. */
  public get element(): HTMLElement {
    return this.el;
  }

  /** Call once per frame with the timestamp passed by requestAnimationFrame. */
  public tick(timestamp: number): void {
    if (!this.visible) return;

    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
      this.lastRefresh = timestamp;
      return;
    }

    const delta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    if (delta > GAP_MS) return;

    this.deltas[this.head] = delta;
    this.head = (this.head + 1) % BUFFER_SIZE;
    this.count = Math.min(this.count + 1, BUFFER_SIZE);

    if (timestamp - this.lastRefresh >= REFRESH_MS) {
      this.lastRefresh = timestamp;
      this.refresh(delta);
    }
  }

  /** An extra line of state to show under the stats (e.g. the render resolution). */
  public setDetail(text: string): void {
    this.detail = text;
    this.updateText();
  }

  /** Logs an error the game caught and survived, and shows it in the overlay. */
  public reportError(error: unknown): void {
    console.error(error);
    this.errorCount++;
    this.lastError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    this.updateText();
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.el.remove();
  }

  private refresh(lastDelta: number): void {
    let sum = 0;
    let worst = 0;
    let samples = 0;

    for (let i = 0; i < this.count && sum < WINDOW_MS; i++) {
      const delta = this.deltas[(this.head - 1 - i + BUFFER_SIZE) % BUFFER_SIZE];
      sum += delta;
      samples++;
      if (delta > worst) worst = delta;
    }

    const avgMs = Math.max(sum / samples, 0.001);
    const avgFps = 1000 / avgMs;
    const nowFps = 1000 / Math.max(lastDelta, 0.001);

    this.statsText =
      `${avgFps.toFixed(0)} fps · now ${nowFps.toFixed(0)} · ` +
      `${avgMs.toFixed(1)} ms · worst ${worst.toFixed(0)}`;
    this.updateText();
    this.el.dataset.state = avgFps >= 55 ? 'good' : avgFps >= 30 ? 'warn' : 'bad';
  }

  private setVisible(value: boolean): void {
    this.visible = value;
    this.el.style.display = value ? 'block' : 'none';
    this.onVisibilityChange(value);

    // Start measuring from scratch every time the overlay is switched on or off.
    this.head = 0;
    this.count = 0;
    this.lastTimestamp = 0;
    this.lastRefresh = 0;
    this.statsText = '… fps';
    this.updateText();
  }

  private updateText(): void {
    if (!this.visible) return;
    const errors = this.errorCount ? `\nERR ×${this.errorCount}: ${this.lastError}` : '';
    const detail = this.detail ? `\n${this.detail}` : '';
    this.el.textContent = this.statsText + detail + errors;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'F3') return;
    event.preventDefault();
    this.setVisible(!this.visible);
  };
}
