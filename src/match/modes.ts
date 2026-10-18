import { MatchRules, STANDARD_RULES } from '@/match/rules';

/** What a game mode brings to a match. Its name and description live in the translations. */
export interface GameMode {
  /** The rules every match of the mode is played by. */
  readonly rules: MatchRules;
}

/**
 * Every mode the player can pick, in the order the mode screen lists them. A new mode is an
 * entry here and its texts in both languages; the compiler insists on the texts.
 */
export const MODES = {
  standard: { rules: STANDARD_RULES },
} as const satisfies Record<string, GameMode>;

export type ModeId = keyof typeof MODES;

export const MODE_IDS = Object.keys(MODES) as ModeId[];

/** The mode a match starts in when nothing else was picked: the game as it has always been. */
export const DEFAULT_MODE: ModeId = 'standard';
