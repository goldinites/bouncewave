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
  /** Whether the player's perfect hits charge Overdrive, and its meter is shown. */
  readonly overdrive: boolean;
  /**
   * Balls in play at once. Every serve sends them off alternately toward one side and the other;
   * the first one out wins the point, which ends it for all of them.
   */
  readonly balls: number;
}

/** The match as it has always been played: first to 10, no clock, Overdrive on, one ball. */
export const STANDARD_RULES: MatchRules = {
  winningScores: [WINNING_SCORE, WINNING_SCORE],
  timeLimit: null,
  overdrive: true,
  balls: 1,
};

/** The same winning score for both sides. */
export const firstTo = (points: number): Scores => [points, points];

/** Both sides are one point from winning: the next point decides the match. */
export function isDecidingPoint(scores: Scores, rules: MatchRules): boolean {
  return scores.every((score, side) => score === rules.winningScores[side] - 1);
}
