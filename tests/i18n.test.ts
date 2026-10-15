import { describe, expect, it } from 'vitest';
import { I18nManager } from '@/i18n/I18nManager';
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

  it('toggles language between en and ru', () => {
    const i18n = new I18nManager('en');
    expect(i18n.toggleLanguage()).toBe('ru');
    expect(i18n.language).toBe('ru');
    expect(i18n.toggleLanguage()).toBe('en');
    expect(i18n.language).toBe('en');
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
