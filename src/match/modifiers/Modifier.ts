import { Ball } from '@/match/Ball';
import { CourtConditions } from '@/match/court';
import { Paddle } from '@/match/Paddle';
import { SkillHit } from '@/match/skills/Skill';

/**
 * Every modifier a match can be played with (docs/CHALLENGES.md): a rule of the match that
 * changes the ball, the paddles or what can be seen. The challenges 10-18 are built on them;
 * developers try them in a quick match (?mods=wind,darkness, or the debug overlay).
 */
export const MODIFIER_IDS = [
  'wind',
  'darkness',
  'twoOpponents',
  'turbo',
  'shrinkingPaddle',
  'bumpers',
  'invisibleBand',
  'ice',
] as const;
export type ModifierId = (typeof MODIFIER_IDS)[number];

export const isModifierId = (value: string): value is ModifierId =>
  (MODIFIER_IDS as readonly string[]).includes(value);

/** What a modifier may read and change of the match. */
export interface ModifierHost {
  readonly paddles: readonly Paddle[];
  readonly balls: readonly Ball[];
  /** What the court does to the balls over it. */
  readonly court: CourtConditions;
  /** Whether a person plays paddle `index` (a modifier may be the player's burden alone). */
  isPlayerPaddle(index: number): boolean;
  /** The match's own randomness, so a seed still replays it. */
  random(): number;
}

/**
 * One modifier of the match being played: the hooks it plays it through, inside the fixed step,
 * as skills do (match/skills/). Some only change what is drawn (Darkness, the invisible band)
 * and need none; their layers read the match's rules.
 */
export interface Modifier {
  readonly id: ModifierId;
  /** The match starts: set the court and the paddles up. */
  start?(): void;
  /** Once a step while the ball is in play, before anything moves. */
  beforeStep?(dt: number): void;
  /** A paddle has just hit a ball. */
  afterHit?(hit: SkillHit): void;
  /** A point is about to be served. */
  onServe?(): void;
  /** The match is over (or left): put back what it changed. */
  end?(): void;
}
