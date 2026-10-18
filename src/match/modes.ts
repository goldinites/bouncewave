import { MatchRules, STANDARD_RULES } from '@/match/rules';

/** What a game mode is, as the PLAY menu lists it. Its name lives in the translations. */
export interface GameMode {
  /** Whether it can be played yet; the others are shown, but can't be picked. */
  readonly isPlayable: boolean;
}

/**
 * Every mode, in the order the PLAY menu lists them. A new mode is an entry here and its name in
 * both languages; the compiler insists on the name. The story (stage 7) and the challenges (stage 2)
 * are on the menu before they are playable.
 */
export const MODES = {
  story: { isPlayable: false },
  quick: { isPlayable: true },
  challenges: { isPlayable: false },
} as const satisfies Record<string, GameMode>;

export type ModeId = keyof typeof MODES;

export const MODE_IDS = Object.keys(MODES) as ModeId[];

/** The lengths a quick match can be set to, in points that win it. */
export const MATCH_POINTS = [3, 5, 7] as const;

export type MatchPoints = (typeof MATCH_POINTS)[number];

export const DEFAULT_MATCH_POINTS: MatchPoints = 5;

export const isMatchPoints = (value: unknown): value is MatchPoints =>
  (MATCH_POINTS as readonly unknown[]).includes(value);

/** A quick match: everything as in the standard rules but its length, which the player sets. */
export function quickMatchRules(points: MatchPoints): MatchRules {
  return { ...STANDARD_RULES, winningScore: points };
}
