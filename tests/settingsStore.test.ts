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
  soundVolume: 100,
  musicVolume: 100,
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

    store.update({ musicVolume: 0 });

    expect(store.current).toEqual({ ...DEFAULTS, musicVolume: 0 });
    expect(saved).toEqual([{ ...DEFAULTS, musicVolume: 0 }]);
    expect(listener).toHaveBeenCalledWith(store.current);
  });

  it('stops notifying after unsubscribe', () => {
    const store = new SettingsStore(memory(DEFAULTS).persistence);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.update({ soundVolume: 0 });

    expect(listener).not.toHaveBeenCalled();
  });

  it('cycles a setting to its next value and saves it', () => {
    const { persistence, saved } = memory(DEFAULTS);
    const store = new SettingsStore(persistence);

    store.cycle('difficulty');
    store.cycle('soundVolume', -1);

    expect(store.current.difficulty).toBe(DifficultyLevel.HARD);
    expect(store.current.soundVolume).toBe(90);
    expect(saved).toHaveLength(2);
  });

  it('steps a volume by tens and holds it at the ends', () => {
    const store = new SettingsStore(memory({ ...DEFAULTS, musicVolume: 10 }).persistence);

    store.cycle('musicVolume', -1);
    store.cycle('musicVolume', -1);
    expect(store.current.musicVolume).toBe(0);

    store.update({ musicVolume: 100 });
    store.cycle('musicVolume');
    expect(store.current.musicVolume).toBe(100);
  });
});
