import { WINNING_SCORE } from '@/match/config';
import { Scores } from '@/match/side';

/**
 * How a match is played: what wins it and which mechanics are on. A mode picks its rules and
 * hands them to `MatchFlow.startMatch`; everything that depends on them (the deciding point's
 * drama, the CPU's form, the Overdrive meter) reads them from there.
 */
export interface MatchRules {
  /**
   * Points that win the match, for each side: [left, right]. Usually the same; a challenge may
   * give a side its own (Survival's three lives are the CPU's winning score). Infinity for a side
   * that cannot win on points, only on time.
   */
  readonly winningScores: Scores;
  /**
   * Seconds of play the match lasts, or null for no clock. The clock runs while a point is served
   * and played, not while the match is paused. When it runs out, the match ends at once, mid-rally
   * if need be: the side ahead wins it, and a level score is the player's loss.
   */
  readonly timeLimit: number | null;
  /**
   * Hits in one rally that end the match at once, won by the player (the left side when no one
   * plays); null when rallies end only in points.
   */
  readonly rallyGoal: number | null;
  /** The CPU growing stronger with every point its opponent wins; null for a CPU that doesn't. */
  readonly cpuRamp: CpuRamp | null;
  /** Whether the player's perfect hits charge Overdrive, and its meter is shown. */
  readonly overdrive: boolean;
  /**
   * Balls in play at once. Every serve sends them off alternately toward one side and the other;
   * the first one out wins the point, which ends it for all of them.
   */
  readonly balls: number;
}

/**
 * A CPU that gets stronger as its opponent scores (Survival). Its strength is a rank, as in
 * `skillAt`: the match's level to begin with, then `perPoint` more for every point it loses, up to
 * `maxRank`. Past the hardest level its play stays the hardest level's and the ball takes over:
 * it speeds up harder and gets faster (`paceAt`). It plays at that strength, with no form.
 */
export interface CpuRamp {
  /** Ranks (levels) added for every point the CPU's opponent wins. */
  readonly perPoint: number;
  /** The strongest it gets, in ranks; above the hardest level's, the ball keeps quickening. */
  readonly maxRank: number;
}

/** The match as it has always been played: first to 10, no clock, Overdrive on, one ball. */
export const STANDARD_RULES: MatchRules = {
  winningScores: [WINNING_SCORE, WINNING_SCORE],
  timeLimit: null,
  rallyGoal: null,
  cpuRamp: null,
  overdrive: true,
  balls: 1,
};

/** The same winning score for both sides. */
export const firstTo = (points: number): Scores => [points, points];

/** Both sides are one point from winning: the next point decides the match. */
export function isDecidingPoint(scores: Scores, rules: MatchRules): boolean {
  return scores.every((score, side) => score === rules.winningScores[side] - 1);
}
