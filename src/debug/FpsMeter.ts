/**
 * Developer-only FPS overlay.
 *
 * - Lives in its own DOM element on top of the page (never drawn on the canvas).
 * - Hidden by default. Enable with `?debug` in the URL or toggle with F3.
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
  private statsText = 'FPS ...';
  private detail = '';
  private errorCount = 0;
  private lastError = '';
  private visible = false;

  constructor() {
    this.el = document.createElement('div');
    this.el.setAttribute('aria-hidden', 'true');
    Object.assign(this.el.style, {
      position: 'fixed',
      top: 'calc(6px + env(safe-area-inset-top, 0px))',
      left: 'calc(6px + env(safe-area-inset-left, 0px))',
      zIndex: '9999',
      padding: '4px 8px',
      font: '12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      whiteSpace: 'pre-wrap',
      maxWidth: 'calc(100vw - 12px)',
      color: '#7cfc8a',
      background: 'rgba(0, 0, 0, 0.6)',
      borderRadius: '4px',
      pointerEvents: 'none',
      userSelect: 'none',
      display: 'none',
    });
    document.body.appendChild(this.el);

    this.setVisible(new URLSearchParams(window.location.search).has('debug'));
    window.addEventListener('keydown', this.onKeyDown);
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
      `FPS ${avgFps.toFixed(0).padStart(3)}  (now ${nowFps.toFixed(0)})\n` +
      `ms  ${avgMs.toFixed(1).padStart(5)}  (worst ${worst.toFixed(1)})`;
    this.updateText();
    this.el.style.color = avgFps >= 55 ? '#7cfc8a' : avgFps >= 30 ? '#ffd84d' : '#ff5c5c';
  }

  private setVisible(value: boolean): void {
    this.visible = value;
    this.el.style.display = value ? 'block' : 'none';

    // Start measuring from scratch every time the overlay is switched on or off.
    this.head = 0;
    this.count = 0;
    this.lastTimestamp = 0;
    this.lastRefresh = 0;
    this.statsText = 'FPS ...';
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
