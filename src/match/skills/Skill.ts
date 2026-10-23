import { Ball, Point } from '@/match/Ball';
import { DifficultyConfig } from '@/match/difficulty';
import { Overdrive } from '@/match/Overdrive';
import { Paddle } from '@/match/Paddle';

/**
 * Every skill the match can play (docs/PROGRESSION.md): so far the prototypes, mastery's first
 * and the implants' first two, which only developers turn on (?skills=arc,analyzer,reflex, or
 * the debug overlay). The rest join with stage 9.
 */
export const SKILL_IDS = ['arc', 'analyzer', 'reflex'] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export const isSkillId = (value: string): value is SkillId =>
  (SKILL_IDS as readonly string[]).includes(value);

/** The implants: they run on the meter's energy, so their owner's meter has a core. */
export const IMPLANTS: readonly SkillId[] = ['analyzer', 'reflex'];

/** Something a skill did that the match reports (`skill` in MatchEvent). */
export interface SkillUse {
  skill: SkillId;
  /** Which of the match's paddles used it. */
  paddleIndex: number;
  x: number;
  y: number;
  /** How strongly, in [0, 1]. */
  strength: number;
}

/** Whether `ball` is flying at the goal `paddle` guards. */
export const isComingAt = (paddle: Paddle, ball: Ball): boolean =>
  paddle.side === 0 ? ball.vx < 0 : ball.vx > 0;

/** The line `ball`'s center crosses when it meets `paddle`'s face. */
export const faceLine = (paddle: Paddle, ball: Ball): number =>
  paddle.side === 0 ? paddle.x + paddle.spec.width + ball.radius : paddle.x - ball.radius;

/** A shot read ahead for its owner (Analyzer): where it will fly and arrive. */
export interface ShotRead {
  /** The paddle that reads it, an index into the match's. */
  paddleIndex: number;
  /** The points it will fly through, the arrival last. */
  path: readonly Point[];
  /** Seconds of the owner's time since it was read. */
  age: number;
}

/** What a skill may read and change of the match: everything as its owner's paddle sees it. */
export interface SkillHost {
  /** The paddle that has the skill, an index into `paddles`. */
  readonly owner: number;
  readonly paddles: readonly Paddle[];
  readonly balls: readonly Ball[];
  /** The owner's Overdrive meter, or null when the match gives it none. */
  meter(): Overdrive | null;
  /** The level the ball plays to right now. */
  physics(): DifficultyConfig;
  /** px/s its owner can move their paddle at: a person's the keyboard's, a CPU's its level's. */
  topSpeed(): number;
  report(use: Omit<SkillUse, 'paddleIndex'>): void;
}

/** A paddle hit a ball, as Physics left it. */
export interface SkillHit {
  /** Which of the match's paddles hit it. */
  paddleIndex: number;
  ball: Ball;
  isPerfect: boolean;
  isPowerShot: boolean;
}

/**
 * One skill of one paddle: the hooks it plays the match through (docs/PROGRESSION.md, "What the
 * effects need"). Each is called inside the match's fixed step and may only use the match's
 * state and its own, so a seed and inputs still replay a match with skills. A skill changes the
 * ball and the paddles, not the match's rules or score.
 */
export interface Skill {
  readonly id: SkillId;
  /** Once a step, before anything moves; `dt` is the owner's time. */
  beforeStep?(dt: number): void;
  /** A paddle (the owner's or another) has just hit a ball. */
  afterHit?(hit: SkillHit): void;
  /**
   * How fast time runs this step for a paddle (an index) or for the balls, 1 being normal.
   * Every skill's scales multiply.
   */
  timeScale?(target: number | 'balls'): number;
  /** A point is about to be served (and a match is starting): what lasts a rally starts over. */
  onServe?(): void;
  /** The shot it is reading for its owner now, to show them; null when none. */
  readonly read?: ShotRead | null;
}
