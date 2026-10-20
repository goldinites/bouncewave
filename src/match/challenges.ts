import { DifficultyLevel } from '@/match/difficulty';
import { PaddleSpec, STANDARD_PADDLE } from '@/match/PaddleSpec';
import { ModifierId } from '@/match/modifiers/Modifier';
import { firstTo, MatchRules, STANDARD_RULES } from '@/match/rules';
import { EXCLUSIVE_SCENES, ExclusiveSceneId } from '@/shared/scenes';

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
  | { readonly type: 'rally'; readonly hits: number };

/**
 * A challenge: a match set up in advance, plus one goal. The player is the left side against the
 * CPU on the right. Its name and description live in the translations; the description is all its
 * card says, so it names the goal and whatever sets the match apart (points, clock, level,
 * paddles, modifiers).
 */
export interface Challenge {
  readonly rules: MatchRules;
  /** How fast the ball gets and how well the CPU plays; the player's choice doesn't apply. */
  readonly difficulty: DifficultyLevel;
  /** What each side plays with: [player, CPU]. */
  readonly paddles: readonly [player: PaddleSpec, cpu: PaddleSpec];
  readonly goal: ChallengeGoal;
  /** The backdrop (and its song) it is played on: its tier's, one of the challenges' own. */
  readonly scene: ChallengeTier;
}

/** A tier of the list, named by the backdrop its challenges are played on. */
export type ChallengeTier = ExclusiveSceneId<'challenges'>;

/** The list's tiers, easiest first: six challenges each, on the challenges' own backdrops. */
export const CHALLENGE_TIERS: readonly ChallengeTier[] = EXCLUSIVE_SCENES.challenges;

const STANDARD_PADDLES = [STANDARD_PADDLE, STANDARD_PADDLE] as const;

// The list's three tiers, six challenges each, and the backdrop each is played on: together a
// road from an underground league, through an exam of mastery, to a world losing its connection
const TIER_SCENES = { FIRST: 'warehouse', SECOND: 'dojo', THIRD: 'brokenNet' } as const;

// Survival: the CPU's three winning points are the player's lives. The CPU starts at the
// challenge's level (Easy, rank 0) and gains 0.15 of a level per point the player wins: past
// Normal by the last points (step 2.5: 15 points at +0.2 was out of reach even for a strong player)
const SURVIVAL = { POINTS: 10, LIVES: 3, RAMP: { perPoint: 0.15, maxRank: 3 } } as const;
// Giant: the CPU's paddle is this much longer than the standard one
const GIANT_HEIGHT = 1.5;
// Chaos: every modifier that changes the court, the ball or what is seen, two points each
const CHAOS = {
  MODIFIERS: [
    'wind',
    'darkness',
    'turbo',
    'shrinkingPaddle',
    'bumpers',
    'invisibleBand',
    'ice',
    'bricks',
  ],
  POINTS: 2,
} as const;

/** A match to `points` played with `modifiers`. */
const withModifiers = (points: number, ...modifiers: ModifierId[]): MatchRules => ({
  ...STANDARD_RULES,
  winningScores: firstTo(points),
  modifiers,
});

/**
 * Every challenge, easiest first (docs/CHALLENGES.md): all are open from the start, so the order is
 * the difficulty curve, with or without modifiers, set in steps 2.5 and 4.5b by simulating each
 * with an AI in the player's place (and by judgement where the AI sees what a person can't: in the
 * dark, through the invisible band). A new one is an entry here and its name and description in
 * both languages; the compiler insists on them. The numbers are starting points for playtesting.
 */
export const CHALLENGES = {
  warmUp: {
    rules: { ...STANDARD_RULES, winningScores: firstTo(3) },
    difficulty: DifficultyLevel.EASY,
    paddles: STANDARD_PADDLES,
    goal: { type: 'win' },
    scene: TIER_SCENES.FIRST,
  },
  twoBalls: {
    rules: { ...STANDARD_RULES, winningScores: firstTo(5), balls: 2 },
    difficulty: DifficultyLevel.EASY,
    paddles: STANDARD_PADDLES,
    goal: { type: 'win' },
    scene: TIER_SCENES.FIRST,
  },
  // Points don't end this one: the rally of 20 does, won, or the clock, lost whatever the score
  longRally: {
    rules: {
      ...STANDARD_RULES,
      winningScores: firstTo(Infinity),
      timeLimit: 60,
      timeUp: 'opponent',
      rallyGoal: 20,
    },
    difficulty: DifficultyLevel.EASY,
    paddles: STANDARD_PADDLES,
    goal: { type: 'rally', hits: 20 },
    scene: TIER_SCENES.FIRST,
  },
  bricks: {
    rules: withModifiers(5, 'bricks'),
    difficulty: DifficultyLevel.NORMAL,
    paddles: STANDARD_PADDLES,
    goal: { type: 'win' },
    scene: TIER_SCENES.FIRST,
  },
  wind: {
    rules: withModifiers(5, 'wind'),
    difficulty: DifficultyLevel.NORMAL,
    paddles: STANDARD_PADDLES,
    goal: { type: 'win' },
    scene: TIER_SCENES.FIRST,
  },
  turbo: {
    rules: withModifiers(5, 'turbo'),
    difficulty: DifficultyLevel.NORMAL,
    paddles: STANDARD_PADDLES,
    goal: { type: 'win' },
    scene: TIER_SCENES.FIRST,
  },
  // A rally of 20 within a minute on a paddle that shrinks with every hit of the player's: 15
  // hits were passed more easily than Warm-up (step 4.5b)
  shrinkingPaddle: {
    rules: {
      ...withModifiers(Infinity, 'shrinkingPaddle'),
      timeLimit: 60,
      timeUp: 'opponent',
      rallyGoal: 20,
    },
    difficulty: DifficultyLevel.NORMAL,
    paddles: STANDARD_PADDLES,
    goal: { type: 'rally', hits: 20 },
    scene: TIER_SCENES.SECOND,
  },
  darkness: {
    rules: withModifiers(5, 'darkness'),
    difficulty: DifficultyLevel.NORMAL,
    paddles: STANDARD_PADDLES,
    goal: { type: 'win' },
    scene: TIER_SCENES.SECOND,
  },
  // Three points within two minutes: when they are up, the player has lost, whatever the score.
  // Five were hardly ever scored in time (step 2.5)
  blitz: {
    rules: { ...STANDARD_RULES, winningScores: firstTo(3), timeLimit: 120, timeUp: 'opponent' },
    difficulty: DifficultyLevel.EASY,
    paddles: STANDARD_PADDLES,
    goal: { type: 'win' },
    scene: TIER_SCENES.SECOND,
  },
  bumpers: {
    rules: withModifiers(5, 'bumpers'),
    difficulty: DifficultyLevel.HARD,
    paddles: STANDARD_PADDLES,
    goal: { type: 'win' },
    scene: TIER_SCENES.SECOND,
  },
  ice: {
    rules: withModifiers(5, 'ice'),
    difficulty: DifficultyLevel.HARD,
    paddles: STANDARD_PADDLES,
    goal: { type: 'win' },
    scene: TIER_SCENES.SECOND,
  },
  ghost: {
    rules: withModifiers(5, 'invisibleBand'),
    difficulty: DifficultyLevel.HARD,
    paddles: STANDARD_PADDLES,
    goal: { type: 'win' },
    scene: TIER_SCENES.SECOND,
  },
  twoOnOne: {
    rules: withModifiers(5, 'twoOpponents'),
    difficulty: DifficultyLevel.NORMAL,
    paddles: STANDARD_PADDLES,
    goal: { type: 'win' },
    scene: TIER_SCENES.THIRD,
  },
  giant: {
    rules: { ...STANDARD_RULES, winningScores: firstTo(5) },
    difficulty: DifficultyLevel.NORMAL,
    paddles: [
      STANDARD_PADDLE,
      { ...STANDARD_PADDLE, height: STANDARD_PADDLE.height * GIANT_HEIGHT },
    ],
    goal: { type: 'win' },
    scene: TIER_SCENES.THIRD,
  },
  // The first point lost ends the attempt: the CPU wins on 1, the player's one life
  shutout: {
    rules: { ...STANDARD_RULES, winningScores: [3, 1] },
    difficulty: DifficultyLevel.EASY,
    paddles: STANDARD_PADDLES,
    goal: { type: 'shutout' },
    scene: TIER_SCENES.THIRD,
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
    scene: TIER_SCENES.THIRD,
  },
  insanity: {
    rules: { ...STANDARD_RULES, winningScores: firstTo(5) },
    difficulty: DifficultyLevel.INSANE,
    paddles: STANDARD_PADDLES,
    goal: { type: 'win' },
    scene: TIER_SCENES.THIRD,
  },
  // The list's finale: the modifiers one after another, in an order dealt for every attempt
  chaos: {
    rules: {
      ...STANDARD_RULES,
      winningScores: firstTo(7),
      rotation: { modifiers: CHAOS.MODIFIERS, points: CHAOS.POINTS },
    },
    difficulty: DifficultyLevel.HARD,
    paddles: STANDARD_PADDLES,
    goal: { type: 'win' },
    scene: TIER_SCENES.THIRD,
  },
} as const satisfies Record<string, Challenge>;

export type ChallengeId = keyof typeof CHALLENGES;

/** Every challenge, easiest first. */
export const CHALLENGE_IDS = Object.keys(CHALLENGES) as ChallengeId[];

export const isChallengeId = (value: unknown): value is ChallengeId =>
  (CHALLENGE_IDS as readonly unknown[]).includes(value);
