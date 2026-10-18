import {
  DifficultyDescription,
  Language,
  ModeDescription,
  TRANSLATIONS,
  TranslationSchema,
} from '@/i18n/translations';
import { DifficultyLevel } from '@/match/difficulty';
import { ModeId } from '@/match/modes';

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

  public getDifficultyInfo(level: DifficultyLevel): DifficultyDescription {
    return TRANSLATIONS[this.currentLanguage].d[level];
  }

  public getModeInfo(mode: ModeId): ModeDescription {
    return TRANSLATIONS[this.currentLanguage].modes[mode];
  }
}
