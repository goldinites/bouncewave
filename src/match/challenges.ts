import { DifficultyLevel } from '@/match/difficulty';
import { PaddleSpec, STANDARD_PADDLE } from '@/match/PaddleSpec';
import { firstTo, MatchRules, STANDARD_RULES } from '@/match/rules';

/**
 * What the player has to do in a challenge's match to pass it. The judge (step 2.2) reads it
 * off the match's events; it never changes how the match ends.
 */
export type ChallengeGoal =
  /** Win the match. */
  | { readonly type: 'win' }
  /** Win it without losing a point. */
  | { readonly type: 'shutout' }
  /** Play a rally of this many hits (both paddles' hits count) before the match ends. */
  | { readonly type: 'rally'; readonly hits: number }
  /** Win it with at least this many Overdrive power shots. */
  | { readonly type: 'powerShots'; readonly count: number };

/**
 * A challenge: a match set up in advance, plus one goal. The player is the left side against the
 * CPU on the right. Its name and description live in the translations; the description is all its
 * card says, so it names the goal and whatever sets the match apart (points, clock, level, paddles).
 */
export interface Challenge {
  readonly rules: MatchRules;
  /** How fast the ball gets and how well the CPU plays; the player's choice doesn't apply. */
  readonly difficulty: DifficultyLevel;
  /** What each side plays with: [player, CPU]. */
  readonly paddles: readonly [player: PaddleSpec, cpu: PaddleSpec];
  readonly goal: ChallengeGoal;
}

const STANDARD_PADDLES = [STANDARD_PADDLE, STANDARD_PADDLE] as const;

// Survival: the CPU's three winning points are the player's lives. The CPU starts at the
// challenge's level (Easy, rank 0) and gains 0.15 of a level per point the player wins: past
// Normal by the last points (step 2.5: 15 points at +0.2 was out of reach even for a strong player)
const SURVIVAL = { POINTS: 10, LIVES: 3, RAMP: { perPoint: 0.15, maxRank: 3 } } as const;
// Giant: the CPU's paddle is this much longer than the standard one
const GIANT_HEIGHT = 1.5;

/**
 * Every challenge, easiest first (docs/CHALLENGES.md): all are open from the start, so the order is
 * the difficulty curve, set in step 2.5 by simulating each with an AI in the player's place. A
 * new one is an entry here and its name and description in both languages; the compiler insists
 * on them. The numbers are starting points for playtesting.
 */
export const CHALLENGES = {
  warmUp: {
    rules: { ...STANDARD_RULES, winningScores: firstTo(3) },
    difficulty: DifficultyLevel.EASY,
    paddles: STANDARD_PADDLES,
    goal: { type: 'win' },
  },
  // Points don't end this one: the clock does, or the rally of 20 that passes it
  longRally: {
    rules: { ...STANDARD_RULES, winningScores: firstTo(Infinity), timeLimit: 60, rallyGoal: 20 },
    difficulty: DifficultyLevel.EASY,
    paddles: STANDARD_PADDLES,
    goal: { type: 'rally', hits: 20 },
  },
  twoBalls: {
    rules: { ...STANDARD_RULES, winningScores: firstTo(5), balls: 2 },
    difficulty: DifficultyLevel.EASY,
    paddles: STANDARD_PADDLES,
    goal: { type: 'win' },
  },
  // Three points within two minutes: when they are up, the player has lost, whatever the score.
  // Five were hardly ever scored in time (step 2.5)
  blitz: {
    rules: { ...STANDARD_RULES, winningScores: firstTo(3), timeLimit: 120, timeUp: 'opponent' },
    difficulty: DifficultyLevel.EASY,
    paddles: STANDARD_PADDLES,
    goal: { type: 'win' },
  },
  // The first point lost ends the attempt: the CPU wins on 1, the player's one life
  shutout: {
    rules: { ...STANDARD_RULES, winningScores: [3, 1] },
    difficulty: DifficultyLevel.EASY,
    paddles: STANDARD_PADDLES,
    goal: { type: 'shutout' },
  },
  giant: {
    rules: { ...STANDARD_RULES, winningScores: firstTo(5) },
    difficulty: DifficultyLevel.NORMAL,
    paddles: [
      STANDARD_PADDLE,
      { ...STANDARD_PADDLE, height: STANDARD_PADDLE.height * GIANT_HEIGHT },
    ],
    goal: { type: 'win' },
  },
  survival: {
    rules: {
      ...STANDARD_RULES,
      winningScores: [SURVIVAL.POINTS, SURVIVAL.LIVES],
      cpuRamp: SURVIVAL.RAMP,
      // Every point on the last life is a deciding one, and so is the last point to score
      decider: 'either',
    },
    difficulty: DifficultyLevel.EASY,
    paddles: STANDARD_PADDLES,
    goal: { type: 'win' },
  },
  overload: {
    rules: { ...STANDARD_RULES, winningScores: firstTo(7) },
    difficulty: DifficultyLevel.NORMAL,
    paddles: STANDARD_PADDLES,
    goal: { type: 'powerShots', count: 5 },
  },
  insanity: {
    rules: { ...STANDARD_RULES, winningScores: firstTo(5) },
    difficulty: DifficultyLevel.INSANE,
    paddles: STANDARD_PADDLES,
    goal: { type: 'win' },
  },
} as const satisfies Record<string, Challenge>;

export type ChallengeId = keyof typeof CHALLENGES;

/** Every challenge, easiest first. */
export const CHALLENGE_IDS = Object.keys(CHALLENGES) as ChallengeId[];

export const isChallengeId = (value: unknown): value is ChallengeId =>
  (CHALLENGE_IDS as readonly unknown[]).includes(value);
