import { describe, expect, it, vi } from 'vitest';
import { DifficultyLevel } from '@/match/difficulty';
import { UserSettings } from '@/settings/UserSettings';
import { SettingsPersistence, SettingsStore } from '@/settings/SettingsStore';

const memory = (initial: UserSettings) => {
  const saved: UserSettings[] = [];
  const persistence: SettingsPersistence = {
    load: () => ({ ...initial }),
    save: (settings) => saved.push({ ...settings }),
  };
  return { persistence, saved };
};

const DEFAULTS: UserSettings = {
  difficulty: DifficultyLevel.NORMAL,
  matchPoints: 5,
  matchBackground: 'random',
  soundMuted: false,
  musicMuted: false,
  language: 'en',
};

describe('SettingsStore', () => {
  it('starts from what was saved', () => {
    const { persistence } = memory({ ...DEFAULTS, language: 'ru' });
    expect(new SettingsStore(persistence).current.language).toBe('ru');
  });

  it('merges an update, saves it and tells subscribers', () => {
    const { persistence, saved } = memory(DEFAULTS);
    const store = new SettingsStore(persistence);
    const listener = vi.fn();
    store.subscribe(listener);

    store.update({ musicMuted: true });

    expect(store.current).toEqual({ ...DEFAULTS, musicMuted: true });
    expect(saved).toEqual([{ ...DEFAULTS, musicMuted: true }]);
    expect(listener).toHaveBeenCalledWith(store.current);
  });

  it('stops notifying after unsubscribe', () => {
    const store = new SettingsStore(memory(DEFAULTS).persistence);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.update({ soundMuted: true });

    expect(listener).not.toHaveBeenCalled();
  });

  it('cycles a setting to its next value and saves it', () => {
    const { persistence, saved } = memory(DEFAULTS);
    const store = new SettingsStore(persistence);

    store.cycle('difficulty');
    store.cycle('soundMuted');

    expect(store.current.difficulty).toBe(DifficultyLevel.HARD);
    expect(store.current.soundMuted).toBe(true);
    expect(saved).toHaveLength(2);
  });
});
