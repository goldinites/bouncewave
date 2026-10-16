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
  INITIAL_SPEED: 340,
  INITIAL_RADIUS: 8,
  TRAIL_MAX_LENGTH: 9,
  /** How far past the edge of the court the ball travels before the point counts. */
  OUT_OF_BOUNDS_OFFSET: 30,
} as const;

export const WINNING_SCORE = 1;
