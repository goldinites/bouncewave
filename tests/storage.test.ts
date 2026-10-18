import { beforeEach, describe, expect, it } from 'vitest';
import { DifficultyLevel } from '@/match/difficulty';
import { LOCAL_STORAGE_KEY, SettingsStorage } from '@/settings/SettingsStorage';

class MemoryStorage implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

describe('SettingsStorage', () => {
  let mockStorage: MemoryStorage;

  beforeEach(() => {
    mockStorage = new MemoryStorage();
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  it('loads default settings when localStorage is empty', () => {
    const settings = SettingsStorage.load();
    expect(settings).toEqual({
      difficulty: DifficultyLevel.NORMAL,
      matchPoints: 5,
      matchBackground: 'random',
      soundMuted: false,
      musicMuted: false,
      language: 'en',
    });
  });

  it('saves and reloads settings correctly', () => {
    SettingsStorage.save({
      difficulty: DifficultyLevel.HARD,
      matchPoints: 7,
      matchBackground: 'fuji',
      soundMuted: true,
      musicMuted: true,
      language: 'ru',
    });

    const loaded = SettingsStorage.load();
    expect(loaded).toEqual({
      difficulty: DifficultyLevel.HARD,
      matchPoints: 7,
      matchBackground: 'fuji',
      soundMuted: true,
      musicMuted: true,
      language: 'ru',
    });
  });

  it('handles invalid or corrupt JSON safely by returning defaults', () => {
    mockStorage.setItem(LOCAL_STORAGE_KEY, '{invalid json');
    const loaded = SettingsStorage.load();
    expect(loaded.difficulty).toBe(DifficultyLevel.NORMAL);
  });

  it('moves players who had picked the removed Easy level to the default', () => {
    mockStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ d: 0 }));
    expect(SettingsStorage.load().difficulty).toBe(DifficultyLevel.NORMAL);
  });

  it('handles out of range difficulty numbers by falling back to default', () => {
    mockStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ d: 99 }));
    const loaded = SettingsStorage.load();
    expect(loaded.difficulty).toBe(DifficultyLevel.NORMAL);
  });

  it('keeps the saved format, so settings from older versions still load', () => {
    SettingsStorage.save({
      difficulty: DifficultyLevel.HARD,
      matchPoints: 7,
      matchBackground: 'fuji',
      soundMuted: true,
      musicMuted: false,
      language: 'ru',
    });
    expect(JSON.parse(mockStorage.getItem(LOCAL_STORAGE_KEY)!)).toEqual({
      d: 2,
      p: 7,
      b: 'fuji',
      m: true,
      u: false,
      l: 'ru',
    });
  });

  it('falls back per setting: one bad value does not reset the others', () => {
    mockStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ d: 'x', m: true, l: 'ru' }));
    expect(SettingsStorage.load()).toEqual({
      difficulty: DifficultyLevel.NORMAL,
      matchPoints: 5,
      matchBackground: 'random',
      soundMuted: true,
      musicMuted: false,
      language: 'ru',
    });
  });

  it('sets up the quick match as before for players whose settings predate it', () => {
    mockStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ d: 2, m: false, u: true, l: 'ru' }));
    expect(SettingsStorage.load()).toMatchObject({ matchPoints: 5, matchBackground: 'random' });
  });

  it('rejects a quick match length or backdrop that does not exist', () => {
    mockStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ p: 10, b: 'moon' }));
    expect(SettingsStorage.load()).toMatchObject({ matchPoints: 5, matchBackground: 'random' });
  });

  it('rejects a stored difficulty that is in range but not a level', () => {
    mockStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ d: 1.5 }));
    expect(SettingsStorage.load().difficulty).toBe(DifficultyLevel.NORMAL);
  });
});
