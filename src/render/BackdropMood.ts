import { GameState } from '@/match/GameState';
import { BackgroundMood } from '@/render/backgrounds/Background';
import { approach } from '@/shared/math';

// The backdrop's lights during play: at full climax they rise only to CLIMAX_MAX so the court
// stays readable; surges add on top and fade out
const LIGHTS = {
  PLAY: 0.12, // in play, before any climax
  CLIMAX_MAX: 0.6,
  CELEBRATION_MAX: 1,
  CLIMAX_SURGE: 0.2, // on the climax drop
  GOAL_SURGE: 0.3, // as a point is scored
  CELEBRATION_SURGE: 1.0,
  SURGE_DECAY: 1.5, // 1/s
  EASE: 2.55, // 1/s toward the brightness the moment calls for
} as const;
const CELEBRATION_DECAY = 0.45; // 1/s, linear

/**
 * How the backdrop feels: how bright its lights burn and how much it celebrates. Full behind the
 * menus and while a point is served; low in play, lifting with the rally's climax; all the way up
 * for a victory. Every background reads it (BackgroundMood); the renderer only tells it what is
 * happening.
 */
export class BackdropMood {
  private lights = 1.0;
  private surge = 0;
  private celebration = 0;

  /** The climax peaks: a gentle swell of the lights. */
  public swell(): void {
    // Raises the target rather than the value, so the swell eases in
    this.surge = LIGHTS.CLIMAX_SURGE;
  }

  /** A point scored: the lights flare up and settle. */
  public flare(): void {
    this.surge = Math.max(this.surge, LIGHTS.GOAL_SURGE);
  }

  /** Victory: the lights flare, and the celebration starts at its height. */
  public celebrate(): void {
    this.surge = LIGHTS.CELEBRATION_SURGE;
    this.celebration = 1;
  }

  /** The match is put away: the celebration is over. */
  public calm(): void {
    this.celebration = 0;
  }

  /** Eases toward what the moment calls for. Not called while paused. */
  public update(dt: number, gameState: GameState, serveTime: number, climax: number): void {
    this.surge *= Math.exp(-dt * LIGHTS.SURGE_DECAY);
    this.celebration = Math.max(0, this.celebration - dt * CELEBRATION_DECAY);

    // During play the climax lights the backdrop only part-way so the court stays readable;
    // the victory celebration (no play happening) may go all the way
    const climaxLights = (LIGHTS.CLIMAX_MAX - LIGHTS.PLAY) * climax;
    const celebrationLights = (LIGHTS.CELEBRATION_MAX - LIGHTS.PLAY) * this.celebration;
    const inPlay = LIGHTS.PLAY + Math.max(climaxLights, celebrationLights) + this.surge;
    const target = gameState === 'menu' || serveTime > 0 ? 1.0 : inPlay;
    this.lights = approach(this.lights, target, LIGHTS.EASE, dt);
  }

  /** The mood for this frame, for every background to read. */
  public current(climax: number): BackgroundMood {
    return { laserIntensity: this.lights, climax, celebration: this.celebration };
  }
}
