import { WINNING_SCORE } from '@/match/config';
import { ModifierId } from '@/match/modifiers/Modifier';
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
   * if need be, won as `timeUp` says.
   */
  readonly timeLimit: number | null;
  /**
   * Who wins when the clock runs out: `leader`, the side ahead (a level score is the player's
   * loss); `opponent`, the player's opponent whatever the score, so the clock is a limit to win
   * within (Blitz). With no player, the right side.
   */
  readonly timeUp: 'leader' | 'opponent';
  /**
   * When a point is the deciding one (its drama, MATCH POINT, the CPU's form held steady): when
   * `both` sides are a point from winning, or when `either` is (Survival: every point on the
   * last life, and the last point to score).
   */
  readonly decider: 'both' | 'either';
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
   * Whether a CPU charges Overdrive too, at a level that does (`AiSkill.overdrive`: Hard and
   * Insane), its meter shown on its paddle. Off in the challenges, set without it.
   */
  readonly cpuOverdrive: boolean;
  /**
   * Whether a long rally presses on, so it ends before it drags: at the lower levels it tires the
   * CPU (match/fatigue.ts), at the upper both paddles shrink in overtime (match/overtime.ts), as
   * the level says. On wherever rallies end in points, off where a long rally is the player's
   * goal, which the pressure would cut short.
   */
  readonly rallyPressure: boolean;
  /**
   * Balls in play at once. Every serve sends them off alternately toward one side and the other;
   * the first one out wins the point, which ends it for all of them.
   */
  readonly balls: number;
  /** What changes the match beyond these rules: wind, darkness and the rest (docs/CHALLENGES.md). */
  readonly modifiers: readonly ModifierId[];
  /** Modifiers taken in turn on top of those (Chaos); null for none. */
  readonly rotation: ModifierRotation | null;
  /**
   * How the ball speeds up, over the level's own (the tutorial's slow, steady ball); null for
   * the level's.
   */
  readonly pace: Pace | null;
}

/** How much faster the ball gets with every hit, and how fast at most. */
export interface Pace {
  /** Share the ball speeds up on each paddle hit. */
  readonly acceleration: number;
  readonly maxSpeed: number; // px/s
}

/**
 * Modifiers played one at a time, each for a few points, in an order dealt afresh for every match
 * (Chaos). The next one and when it comes are shown ahead. Only those that change the court, the
 * ball or what is seen: not Two opponents, which changes who plays.
 */
export interface ModifierRotation {
  readonly modifiers: readonly ModifierId[];
  /** Points (both sides' together) each one is played for. */
  readonly points: number;
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
  timeUp: 'leader',
  decider: 'both',
  rallyGoal: null,
  cpuRamp: null,
  overdrive: true,
  cpuOverdrive: false,
  rallyPressure: true,
  balls: 1,
  modifiers: [],
  rotation: null,
  pace: null,
};

/** The same winning score for both sides. */
export const firstTo = (points: number): Scores => [points, points];

/**
 * The next point can decide the match: both sides are one point from winning, or either is, as
 * the rules' `decider` says.
 */
export function isDecidingPoint(scores: Scores, rules: MatchRules): boolean {
  const isMatchPoint = (score: number, side: number) => score === rules.winningScores[side] - 1;
  return rules.decider === 'either' ? scores.some(isMatchPoint) : scores.every(isMatchPoint);
}
