import { DifficultyLevel } from '@/types/difficulty.types';
import { DifficultyDescription, Language, TranslationSchema } from '@/types/i18n.types';
import { TRANSLATIONS } from '@/i18n/translations';

export class I18nManager {
  private currentLanguage: Language;

  constructor(initialLanguage: Language = 'en') {
    this.currentLanguage = initialLanguage;
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

  public toggleLanguage(): Language {
    this.language = this.currentLanguage === 'en' ? 'ru' : 'en';
    return this.currentLanguage;
  }

  public t<K extends keyof TranslationSchema>(key: K): TranslationSchema[K] {
    return TRANSLATIONS[this.currentLanguage][key];
  }

  public getDifficultyInfo(level: DifficultyLevel): DifficultyDescription {
    return TRANSLATIONS[this.currentLanguage].d[level];
  }
}
