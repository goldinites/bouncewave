import { WINNING_SCORE } from '@/match/config';
import { Scores } from '@/match/side';

/**
 * How a match is played: what wins it and which mechanics are on. A mode picks its rules and
 * hands them to `MatchFlow.startMatch`; everything that depends on them (the deciding point's
 * drama, the CPU's form, the Overdrive meter) reads them from there.
 */
export interface MatchRules {
  /** Points that win the match. */
  readonly winningScore: number;
  /** Whether the player's perfect hits charge Overdrive, and its meter is shown. */
  readonly overdrive: boolean;
}

/** The match as it has always been played: first to 10, Overdrive on. */
export const STANDARD_RULES: MatchRules = {
  winningScore: WINNING_SCORE,
  overdrive: true,
};

/** Both sides are one point from winning: the next point decides the match. */
export function isDecidingPoint(scores: Scores, rules: MatchRules): boolean {
  return scores.every((score) => score === rules.winningScore - 1);
}
