import { isLanguage, Language, nextLanguage } from '@/i18n/translations';
import { DifficultyLevel, isDifficultyLevel, nextDifficulty } from '@/match/difficulty';

export interface UserSettings {
  difficulty: DifficultyLevel;
  soundMuted: boolean;
  musicMuted: boolean;
  language: Language;
}

/** Everything the game needs to know about one setting, apart from how the menu shows it. */
export interface SettingDefinition<T> {
  /** Key in the saved data; kept short and never renamed, so saved settings survive updates. */
  storageKey: string;
  defaultValue: T;
  /** Whether a saved value can be used as is; anything else falls back to the default. */
  isValid(value: unknown): value is T;
  /** The value the setting switches to when the player picks it in the menu. */
  next(value: T): T;
}

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const toggle = (value: boolean): boolean => !value;

/**
 * Every setting, described once. To add one, add a field to UserSettings and an entry here
 * (the compiler insists on both); saving, loading and cycling then work on their own.
 */
export const SETTINGS: { [K in keyof UserSettings]: SettingDefinition<UserSettings[K]> } = {
  difficulty: {
    storageKey: 'd',
    defaultValue: DifficultyLevel.NORMAL,
    isValid: isDifficultyLevel,
    next: nextDifficulty,
  },
  soundMuted: { storageKey: 'm', defaultValue: false, isValid: isBoolean, next: toggle },
  musicMuted: { storageKey: 'u', defaultValue: false, isValid: isBoolean, next: toggle },
  language: { storageKey: 'l', defaultValue: 'en', isValid: isLanguage, next: nextLanguage },
};

export const SETTING_KEYS = Object.keys(SETTINGS) as (keyof UserSettings)[];

export function getDefaultSettings(): UserSettings {
  return Object.fromEntries(
    SETTING_KEYS.map((key) => [key, SETTINGS[key].defaultValue]),
  ) as unknown as UserSettings;
}
