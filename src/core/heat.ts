import { BALL_INITIAL_SPEED, RALLY_HEAT_MAX } from '@/constants/game.constants';
import { clamp } from '@/utils/math';

/**
 * Shared "heat" measures that the ball glow, ball size and music intensity all react to.
 * Both are in [0, 1].
 */

/** How long the rally is, relative to full heat. */
export function getRallyHeat(rally: number): number {
  return clamp(rally / RALLY_HEAT_MAX, 0, 1);
}

/** How fast the ball is, from serve speed (0) to the difficulty's top speed (1). */
export function getSpeedHeat(speed: number, maxSpeed: number): number {
  return clamp((speed - BALL_INITIAL_SPEED) / (maxSpeed - BALL_INITIAL_SPEED), 0, 1);
}
