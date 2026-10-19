import {
  ChallengeDescription,
  DifficultyDescription,
  Language,
  TRANSLATIONS,
  TranslationSchema,
} from '@/i18n/translations';
import { ChallengeId } from '@/match/challenges';
import { DifficultyLevel } from '@/match/difficulty';
import { ModeId } from '@/match/modes';
import { BackgroundChoice } from '@/shared/scenes';

/** The translations that are a single text (not a table of them). */
export type TextKey = {
  [K in keyof TranslationSchema]: TranslationSchema[K] extends string ? K : never;
}[keyof TranslationSchema];

export class I18nManager {
  private currentLanguage: Language = 'en';

  constructor(initialLanguage: Language = 'en') {
    this.language = initialLanguage;
  }

  public get language(): Language {
    return this.currentLanguage;
  }

  public set language(lang: Language) {
    this.currentLanguage = lang;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }

  public t<K extends keyof TranslationSchema>(key: K): TranslationSchema[K] {
    return TRANSLATIONS[this.currentLanguage][key];
  }

  /**
   * A text with its `{placeholders}` filled in: `format('ruleBalls', { n: 2 })` → "2 balls".
   * Numbers are written as the language writes them (1.5, 1,5).
   */
  public format(key: TextKey, values: Record<string, string | number>): string {
    return this.t(key).replace(/\{(\w+)\}/g, (placeholder, name: string) => {
      const value = values[name];
      if (value === undefined) return placeholder;
      return typeof value === 'number' ? value.toLocaleString(this.currentLanguage) : value;
    });
  }

  public getDifficultyInfo(level: DifficultyLevel): DifficultyDescription {
    return TRANSLATIONS[this.currentLanguage].d[level];
  }

  public getChallengeInfo(challenge: ChallengeId): ChallengeDescription {
    return TRANSLATIONS[this.currentLanguage].challenges[challenge];
  }

  public getModeName(mode: ModeId): string {
    return TRANSLATIONS[this.currentLanguage].modes[mode];
  }

  public getBackgroundName(choice: BackgroundChoice): string {
    return TRANSLATIONS[this.currentLanguage].backgrounds[choice];
  }
}
