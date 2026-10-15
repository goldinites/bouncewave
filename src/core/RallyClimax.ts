import { CLIMAX_RALLY } from '@/constants/game.constants';
import { CLIMAX_FALL_TIME, CLIMAX_RISE_TIME } from '@/constants/visual.constants';
import { clamp } from '@/utils/math';

/**
 * Presentation-only reward for a long rally.
 *
 * Once the rally reaches full "heat" (CLIMAX_RALLY hits) the climax builds up slowly over
 * CLIMAX_RISE_TIME, like a riser in a track, and `update` reports the moment it peaks so
 * callers can fire the drop. When the point ends it cools down over CLIMAX_FALL_TIME.
 * Rules are never affected.
 */
export class RallyClimax {
  private progress = 0;
  private _isActive = false;
  private hasPeaked = false;

  /** Eased intensity in [0, 1] for continuous effects. */
  public get level(): number {
    // Smoothstep: gentle start, gentle arrival, no visible kinks
    const p = this.progress;
    return p * p * (3 - 2 * p);
  }

  public get isActive(): boolean {
    return this._isActive;
  }

  /**
   * @param realDt
   * @param isMatchActive false outside of a real match (demo, menu)
   * @param rally
   * @param serveTime
   * @returns true on the frame the build-up reaches its peak (the drop)
   */
  public update(realDt: number, isMatchActive: boolean, rally: number, serveTime: number): boolean {
    this._isActive = isMatchActive && serveTime <= 0 && rally >= CLIMAX_RALLY;

    const rate = this._isActive ? 1 / CLIMAX_RISE_TIME : -1 / CLIMAX_FALL_TIME;
    this.progress = clamp(this.progress + realDt * rate, 0, 1);

    if (!this._isActive) {
      this.hasPeaked = false;
      return false;
    }

    const peakedNow = this.progress >= 1 && !this.hasPeaked;
    if (peakedNow) this.hasPeaked = true;
    return peakedNow;
  }

  public reset(): void {
    this._isActive = false;
    this.hasPeaked = false;
    this.progress = 0;
  }
}
