import { describe, expect, it } from 'vitest';
import { I18nManager } from '@/i18n/I18nManager';
import { isLanguage, LANGUAGES, nextLanguage } from '@/i18n/translations';
import { DifficultyLevel } from '@/match/difficulty';

describe('I18nManager', () => {
  it('initializes with default language', () => {
    const i18n = new I18nManager('en');
    expect(i18n.language).toBe('en');
    expect(i18n.t('play')).toBe('PLAY');
  });

  it('translates Russian strings correctly', () => {
    const i18n = new I18nManager('ru');
    expect(i18n.language).toBe('ru');
    expect(i18n.t('play')).toBe('ИГРАТЬ');
    expect(i18n.t('pause')).toBe('ПАУЗА');
  });

  it('cycles through the languages there are dictionaries for', () => {
    expect(LANGUAGES).toEqual(['en', 'ru']);
    expect(nextLanguage('en')).toBe('ru');
    expect(nextLanguage('ru')).toBe('en');
    expect(isLanguage('ru')).toBe(true);
    expect(isLanguage('de')).toBe(false);
  });

  it('switches language and marks the document with it, from the start', () => {
    const i18n = new I18nManager('ru');
    expect(document.documentElement.lang).toBe('ru');

    i18n.language = 'en';
    expect(i18n.t('play')).toBe('PLAY');
    expect(document.documentElement.lang).toBe('en');
  });

  it('returns difficulty description tuples for all levels', () => {
    const i18n = new I18nManager('en');
    const easyInfo = i18n.getDifficultyInfo(DifficultyLevel.EASY);
    expect(easyInfo[0]).toBe('EASY');
    expect(easyInfo[1]).toContain('slow');

    const insaneInfo = i18n.getDifficultyInfo(DifficultyLevel.INSANE);
    expect(insaneInfo[0]).toBe('INSANE');
  });
});
