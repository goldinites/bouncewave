import { PADDLE } from '@/match/config';

/**
 * What a paddle is like to play with: its size and how it hits. Every paddle carries one, and
 * everything that measures or plays a paddle reads it there, so a paddle can differ from the
 * standard one (a wider paddle, a harder hitter) without touching any of that code.
 *
 * The multipliers are 1 for the standard paddle; above 1 is more of it.
 */
export interface PaddleSpec {
  /** px from end to end. */
  readonly height: number;
  /** px across its face. */
  readonly width: number;
  /** Central share of its half-height where a hit counts as perfect. */
  readonly perfectZone: number;
  /** How much each hit speeds the ball up, on top of the difficulty's acceleration. */
  readonly power: number;
  /** How far its own motion steers the ball it hits. */
  readonly spin: number;
  /** How quickly it follows where it is steered, and how fast its player can steer it. */
  readonly speed: number;
}

/** The paddle as the game has always had it. */
export const STANDARD_PADDLE: PaddleSpec = {
  height: PADDLE.HEIGHT,
  width: PADDLE.WIDTH,
  // ~18 px of a 92 px paddle; was 0.15 until playtesting the skills (4.3) found the meter too
  // hard to charge
  perfectZone: 0.2,
  power: 1,
  spin: 1,
  speed: 1,
};
