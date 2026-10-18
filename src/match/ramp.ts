import {
  DifficultyConfig,
  DIFFICULTY_CONFIGS,
  DIFFICULTY_LEVELS,
  DifficultyLevel,
} from '@/match/difficulty';
import { CpuRamp } from '@/match/rules';
import { clamp, lerp } from '@/shared/math';

// Past the hardest level a ramping CPU's strength goes into the ball: per rank above it, the
// share each hit's speed-up and the top speed grow by
const BEYOND_HARDEST = {
  ACCELERATION: 0.25,
  MAX_SPEED: 0.1,
} as const;

/** The ball's side of a level: how much each hit speeds it up, and how fast it can get. */
export type BallPace = Pick<DifficultyConfig, 'acceleration' | 'maxSpeed'>;

/** The rank of a level: its place in DIFFICULTY_LEVELS, as `skillAt` counts. */
export const rankOf = (level: DifficultyLevel): number => DIFFICULTY_LEVELS.indexOf(level);

/**
 * How strong a ramping CPU is, in ranks: the match's level, `ramp.perPoint` more for each point
 * its opponent has won, up to `ramp.maxRank`.
 */
export function cpuRank(level: DifficultyLevel, ramp: CpuRamp, opponentPoints: number): number {
  return Math.min(rankOf(level) + ramp.perPoint * opponentPoints, ramp.maxRank);
}

/**
 * The ball's pace at a fractional rank, blended between the two levels around it as `skillAt`
 * blends the AI. Past the hardest level it keeps quickening by BEYOND_HARDEST per rank; it never
 * goes below the easiest.
 */
export function paceAt(rank: number): BallPace {
  const top = DIFFICULTY_LEVELS.length - 1;
  const hardest = DIFFICULTY_CONFIGS[DIFFICULTY_LEVELS[top]];
  if (rank > top) {
    const beyond = rank - top;
    return {
      acceleration: hardest.acceleration * (1 + BEYOND_HARDEST.ACCELERATION * beyond),
      maxSpeed: hardest.maxSpeed * (1 + BEYOND_HARDEST.MAX_SPEED * beyond),
    };
  }

  const position = clamp(rank, 0, top);
  const lower = Math.min(Math.floor(position), top - 1);
  const t = position - lower;
  const from = DIFFICULTY_CONFIGS[DIFFICULTY_LEVELS[lower]];
  const to = DIFFICULTY_CONFIGS[DIFFICULTY_LEVELS[lower + 1]];
  return {
    acceleration: lerp(from.acceleration, to.acceleration, t),
    maxSpeed: lerp(from.maxSpeed, to.maxSpeed, t),
  };
}
