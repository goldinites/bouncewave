import { isLanguage, Language, LANGUAGES } from '@/i18n/translations';
import { DIFFICULTY_LEVELS, DifficultyLevel, isDifficultyLevel } from '@/match/difficulty';
import { DEFAULT_MATCH_POINTS, isMatchPoints, MATCH_POINTS, MatchPoints } from '@/match/modes';
import { stepThrough } from '@/shared/math';
import { BACKGROUND_CHOICES, BackgroundChoice, isBackgroundChoice } from '@/shared/scenes';
import { isVolume, stepVolume, Volume, VOLUME } from '@/shared/volume';

/**
 * Everything the player chose that outlasts a visit: the settings proper, and the quick match
 * as last set up (its difficulty, length and backdrop).
 */
export interface UserSettings {
  difficulty: DifficultyLevel;
  matchPoints: MatchPoints;
  matchBackground: BackgroundChoice;
  /** The action and menu sounds' volume, 0 for none (shared/volume.ts). */
  soundVolume: Volume;
  musicVolume: Volume;
  language: Language;
}

/** Everything the game needs to know about one setting, apart from how the menu shows it. */
export interface SettingDefinition<T> {
  defaultValue: T;
  /** Whether a saved value can be used as is; anything else falls back to the default. */
  isValid(value: unknown): value is T;
  /** The value the setting switches to when the player picks it, or steps it on, in the menu. */
  next(value: T): T;
  /** The value the setting steps back to (the back arrow on the quick match's choices). */
  previous(value: T): T;
}

// A volume steps by tens and stops at the ends: from full, one more step up is not silence
const volumeSteps = {
  next: (value: Volume) => stepVolume(value, 1),
  previous: (value: Volume) => stepVolume(value, -1),
};

/** Steps through `list` either way, wrapping around at both ends. */
const through = <T>(list: readonly T[]) => ({
  next: (value: T) => stepThrough(list, value, 1),
  previous: (value: T) => stepThrough(list, value, -1),
});

/**
 * Every setting, described once. To add one, add a field to UserSettings and an entry here
 * (the compiler insists on both); saving, loading (profile/), checking a saved value and
 * cycling then work on their own.
 */
export const SETTINGS: { [K in keyof UserSettings]: SettingDefinition<UserSettings[K]> } = {
  difficulty: {
    // A newcomer's first match is at the easiest (step 4.7): won, its end offers the next level
    defaultValue: DifficultyLevel.EASY,
    isValid: isDifficultyLevel,
    ...through(DIFFICULTY_LEVELS),
  },
  matchPoints: {
    defaultValue: DEFAULT_MATCH_POINTS,
    isValid: isMatchPoints,
    ...through(MATCH_POINTS),
  },
  matchBackground: {
    defaultValue: 'random',
    isValid: isBackgroundChoice,
    ...through(BACKGROUND_CHOICES),
  },
  soundVolume: { defaultValue: VOLUME.MAX, isValid: isVolume, ...volumeSteps },
  musicVolume: { defaultValue: VOLUME.MAX, isValid: isVolume, ...volumeSteps },
  language: { defaultValue: 'en', isValid: isLanguage, ...through(LANGUAGES) },
};

export const SETTING_KEYS = Object.keys(SETTINGS) as (keyof UserSettings)[];

export function getDefaultSettings(): UserSettings {
  return Object.fromEntries(
    SETTING_KEYS.map((key) => [key, SETTINGS[key].defaultValue]),
  ) as unknown as UserSettings;
}
