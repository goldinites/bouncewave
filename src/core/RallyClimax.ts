import { CLIMAX_RALLY } from '@/constants/game.constants';
import { CLIMAX_LEVEL_SMOOTHING } from '@/constants/visual.constants';

/**
 * Presentation-only reward for a long rally.
 *
 * Once the rally reaches full "heat" (CLIMAX_RALLY hits) the climax switches on and stays
 * until the point ends. `update` reports the moment it switches on so callers can fire
 * one-shot effects (music drop, laser surge). Rules are never affected.
 */
export class RallyClimax {
  private _level = 0;
  private _isActive = false;

  /** Smoothed intensity in [0, 1] for continuous effects. */
  public get level(): number {
    return this._level;
  }

  public get isActive(): boolean {
    return this._isActive;
  }

  /**
   * @param realDt
   * @param isMatchActive false outside of a real match (demo, menu)
   * @param rally
   * @param serveTime
   * @returns true on the frame the climax starts
   */
  public update(realDt: number, isMatchActive: boolean, rally: number, serveTime: number): boolean {
    const shouldBeActive = isMatchActive && serveTime <= 0 && rally >= CLIMAX_RALLY;
    const started = shouldBeActive && !this._isActive;
    this._isActive = shouldBeActive;

    const target = shouldBeActive ? 1 : 0;
    this._level += (target - this._level) * Math.min(1, realDt * CLIMAX_LEVEL_SMOOTHING);

    return started;
  }

  public reset(): void {
    this._isActive = false;
    this._level = 0;
  }
}
