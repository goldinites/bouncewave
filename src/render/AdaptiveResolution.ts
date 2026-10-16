// Frame times are averaged over windows of this length before any decision
const WINDOW_MS = 1000;
// Measuring starts after this much play, so page load and font loading don't count
const WARMUP_MS = 2000;
// Frames longer than this are a hitch or a hidden tab, not steady load: ignored
const MAX_FRAME_MS = 250;

// Average frame time above SLOW (under ~50 fps) lowers the resolution a step; below FAST
// (a steady 60 fps or better) for UPGRADE_AFTER_MS raises it back
const SLOW_FRAME_MS = 20;
const FAST_FRAME_MS = 17.5;
const UPGRADE_AFTER_MS = 8000;

// Each step renders this share of the previous pixel ratio
const STEP = 0.8;
// A step down has to make frames at least this much faster, or it is undone
const MIN_IMPROVEMENT = 0.05;
// How long to stop adapting after a step down did not help
const LOCK_MS = 30000;

/**
 * Picks the canvas pixel ratio from measured frame times (dynamic resolution).
 *
 * Fill rate is what integrated GPUs and phones run out of first, so while frames are slow the
 * canvas is drawn at a lower pixel ratio and stretched by CSS. Steps back up once frames have
 * been fast for a while; a ratio that turned out too slow right after stepping up is not tried
 * again. If a step down doesn't speed frames up — the game is not fill-rate bound, or the
 * browser itself caps the frame rate (iOS Low Power Mode runs at 30 fps) — it is undone, so the
 * picture never gets blurry for nothing.
 */
export class AdaptiveResolution {
  private readonly levels: number[];
  /** Index into `levels`: 0 = sharpest. */
  private level = 0;
  /** Sharpest level allowed: raised past every level that proved too slow. */
  private ceiling = 0;

  private elapsed = 0;
  private windowTime = 0;
  private windowFrames = 0;
  private fastTime = 0;
  private lockedFor = 0;

  /** Set by a step down until the next window shows whether it helped. */
  private pendingCheck: { fromLevel: number; frameMs: number } | null = null;
  /** The level just stepped up to, until its first window has been judged. */
  private upgradedTo: number | null = null;

  /**
   * @param maxRatio the sharpest pixel ratio (the display's, capped)
   * @param minRatio never draws below this
   */
  constructor(maxRatio: number, minRatio = 0.75) {
    this.levels = [maxRatio];
    for (let ratio = maxRatio * STEP; ratio > minRatio; ratio *= STEP) {
      this.levels.push(ratio);
    }
    if (maxRatio > minRatio) this.levels.push(minRatio);
  }

  public get pixelRatio(): number {
    return this.levels[this.level];
  }

  /**
   * @param frameMs wall-clock time since the previous frame
   * @returns true when the pixel ratio changed and the canvas has to be resized
   */
  public tick(frameMs: number): boolean {
    if (!(frameMs > 0) || frameMs > MAX_FRAME_MS) return false;

    this.elapsed += frameMs;
    if (this.elapsed < WARMUP_MS) return false;

    if (this.lockedFor > 0) {
      this.lockedFor -= frameMs;
      return false;
    }

    this.windowTime += frameMs;
    this.windowFrames++;
    if (this.windowTime < WINDOW_MS) return false;

    const windowTime = this.windowTime;
    const averageMs = windowTime / this.windowFrames;
    this.windowTime = 0;
    this.windowFrames = 0;
    return this.evaluate(averageMs, windowTime);
  }

  private evaluate(averageMs: number, windowTime: number): boolean {
    const check = this.pendingCheck;
    this.pendingCheck = null;
    if (check && averageMs > check.frameMs * (1 - MIN_IMPROVEMENT)) {
      this.level = check.fromLevel;
      this.upgradedTo = null;
      this.fastTime = 0;
      this.lockedFor = LOCK_MS;
      return true;
    }

    const upgradedTo = this.upgradedTo;
    this.upgradedTo = null;

    if (averageMs > SLOW_FRAME_MS) {
      this.fastTime = 0;
      if (upgradedTo === this.level) this.ceiling = this.level + 1;
      if (this.level >= this.levels.length - 1) return false;

      this.pendingCheck = { fromLevel: this.level, frameMs: averageMs };
      this.level++;
      return true;
    }

    if (averageMs < FAST_FRAME_MS && this.level > this.ceiling) {
      this.fastTime += windowTime;
      if (this.fastTime < UPGRADE_AFTER_MS) return false;

      this.fastTime = 0;
      this.level--;
      this.upgradedTo = this.level;
      return true;
    }

    this.fastTime = 0;
    return false;
  }
}
