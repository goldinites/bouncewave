/**
 * Sizes of the court and of what moves on it, in game units (the canvas is scaled to fit).
 * Read by the match, its effects and the renderer alike.
 */

export const COURT = {
  WIDTH: 800,
  HEIGHT: 500,
  /** Thickness of the walls the ball bounces off. */
  TOP_WALL: 14,
  BOTTOM_WALL: 14,
} as const;

export const PADDLE = {
  WIDTH: 14,
  HEIGHT: 92,
  /** Gap between a paddle and its edge of the court. */
  OFFSET_X: 34,
  /** How close to the walls a paddle may get. */
  TOP_MARGIN: 20,
  BOTTOM_MARGIN: 20,
} as const;

export const BALL = {
  INITIAL_SPEED: 380,
  INITIAL_RADIUS: 8,
  /** Seconds of flight the trail shows: nine points, the same length at any rate. */
  TRAIL_DURATION: 0.14,
  /**
   * Seconds between trail points, however often the simulation steps: the points are drawn
   * additively, so more of them would make the trail brighter, not longer.
   */
  TRAIL_INTERVAL: 1 / 60,
  /** How far past the edge of the court the ball travels before the point counts. */
  OUT_OF_BOUNDS_OFFSET: 30,
} as const;

/**
 * Points that win a standard match. A match reads its own from its MatchRules (match/rules.ts);
 * use STANDARD_RULES rather than this.
 */
export const WINNING_SCORE = 10;
