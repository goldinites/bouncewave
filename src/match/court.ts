/** A fixed post on the court the ball bounces off (the Bumpers modifier). */
export interface Bumper {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** How far it has grown, in [0, 1], for one that rises and sinks; whole when left out. */
  readonly growth?: number;
}

/**
 * What the court itself does to a ball flying over it: a match's modifiers set it, `Physics`
 * applies it, and a forecast flies through it too. Nothing by default: the plain court.
 */
export class CourtConditions {
  /** Wind across the ball's path, px/s²: positive blows it down, negative up. */
  public wind = 0;
  /** Seconds until the wind turns around; Infinity while it won't. */
  public windTurnsIn = Infinity;
  /** How fast a ball in flight gains speed, px/s² (Turbo), up to the level's top speed... */
  public turbo = 0;
  /** ...and this share over it (Turbo, growing with the rally). */
  public turboOver = 0;
  /** Posts the ball bounces off. */
  public bumpers: readonly Bumper[] = [];

  /** Back to the plain court. */
  public reset(): void {
    this.wind = 0;
    this.windTurnsIn = Infinity;
    this.turbo = 0;
    this.turboOver = 0;
    this.bumpers = [];
  }
}
