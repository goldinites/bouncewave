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
      soundMuted: false,
      musicMuted: false,
      language: 'en',
    });
  });

  it('saves and reloads settings correctly', () => {
    SettingsStorage.save({
      difficulty: DifficultyLevel.HARD,
      soundMuted: true,
      musicMuted: true,
      language: 'ru',
    });

    const loaded = SettingsStorage.load();
    expect(loaded).toEqual({
      difficulty: DifficultyLevel.HARD,
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

  it('handles out of range difficulty numbers by falling back to default', () => {
    mockStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ d: 99 }));
    const loaded = SettingsStorage.load();
    expect(loaded.difficulty).toBe(DifficultyLevel.NORMAL);
  });

  it('rejects a stored difficulty that is in range but not a level', () => {
    mockStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ d: 1.5 }));
    expect(SettingsStorage.load().difficulty).toBe(DifficultyLevel.NORMAL);
  });
});
