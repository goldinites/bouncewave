import { describe, expect, it, vi } from 'vitest';
import { DifficultyLevel } from '@/match/difficulty';
import { MatchEvent } from '@/match/MatchFlow';
import { LEGACY_KEYS, LEGACY_SETTINGS_KEY, loadProfile } from '@/profile/migrations';
import { getEmptyChallengeProgress } from '@/profile/ChallengeProgress';
import { getDefaultProfile, PROFILE_VERSION } from '@/profile/Profile';
import { getEmptyStatistics } from '@/profile/Statistics';
import { PROFILE_KEY, ProfileStore } from '@/profile/ProfileStore';
import { StoragePersistence } from '@/profile/StoragePersistence';
import { SettingsStore } from '@/settings/SettingsStore';
import { getDefaultSettings } from '@/settings/UserSettings';
import { EventBus } from '@/shared/EventBus';

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

/** Storage holding `entries`, each saved as JSON (a string as it is). */
const storageWith = (entries: Record<string, unknown> = {}) => {
  const storage = new MemoryStorage();
  for (const [key, value] of Object.entries(entries)) {
    storage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  return storage;
};

const DEFAULTS = getDefaultSettings();

describe('the profile', () => {
  it('starts from the defaults when nothing is saved', () => {
    expect(new ProfileStore(storageWith()).current).toEqual(getDefaultProfile());
    expect(getDefaultProfile()).toEqual({
      version: PROFILE_VERSION,
      settings: DEFAULTS,
      stats: getEmptyStatistics(),
      challenges: getEmptyChallengeProgress(),
    });
  });

  it('saves itself whole, with its version, and loads back as it was', () => {
    const storage = storageWith();
    const settings = { ...DEFAULTS, difficulty: DifficultyLevel.HARD, language: 'ru' as const };
    new ProfileStore(storage).update({ settings });

    expect(JSON.parse(storage.getItem(PROFILE_KEY)!)).toEqual({
      version: 3,
      settings,
      stats: getEmptyStatistics(),
      challenges: { passed: [] },
    });
    expect(new ProfileStore(storage).current.settings).toEqual(settings);
  });

  it('keeps the settings through the SettingsStore', () => {
    const storage = storageWith();
    new SettingsStore(new ProfileStore(storage).settings).cycle('matchPoints');

    expect(new ProfileStore(storage).current.settings.matchPoints).toBe(7);
  });

  it('falls back per setting: one bad value does not reset the others', () => {
    const storage = storageWith({
      [PROFILE_KEY]: { version: 3, settings: { ...DEFAULTS, difficulty: 'x', language: 'ru' } },
    });
    expect(new ProfileStore(storage).current.settings).toEqual({ ...DEFAULTS, language: 'ru' });
  });

  it('starts from the defaults when what is saved is no profile at all', () => {
    for (const saved of ['{broken json', '42', '"text"', '[1, 2]', 'null']) {
      const storage = storageWith({ [PROFILE_KEY]: saved });
      expect(new ProfileStore(storage).current).toEqual(getDefaultProfile());
    }
    expect(
      loadProfile({ version: 3, settings: 'none', stats: 'none', challenges: 'none' }),
    ).toEqual(getDefaultProfile());
  });

  it('reads a profile from a newer build for what it knows of it', () => {
    const saved = { version: 9, settings: { ...DEFAULTS, matchPoints: 3 }, trophies: [1] };
    expect(loadProfile(saved)).toEqual({
      ...getDefaultProfile(),
      settings: { ...DEFAULTS, matchPoints: 3 },
    });
  });

  it("leaves a newer build's profile alone at start", () => {
    const saved = JSON.stringify({ version: 9, settings: DEFAULTS, trophies: [1] });
    const storage = storageWith({ [PROFILE_KEY]: saved });
    new ProfileStore(storage);
    expect(storage.getItem(PROFILE_KEY)).toBe(saved);
  });

  it('plays on when the storage fails or is missing', () => {
    const storage = storageWith();
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const store = new ProfileStore(storage);
    store.update({ settings: { ...DEFAULTS, musicMuted: true } });
    expect(store.current.settings.musicMuted).toBe(true);

    const nowhere = new ProfileStore(null);
    nowhere.update({ settings: { ...DEFAULTS, soundMuted: true } });
    expect(nowhere.current.settings.soundMuted).toBe(true);
  });
});

describe('a profile saved by 1.4 (version 1)', () => {
  it('comes up with its settings, statistics from nothing and no challenge passed', () => {
    const settings = { ...DEFAULTS, language: 'ru' as const, matchPoints: 7 as const };
    const storage = storageWith({ [PROFILE_KEY]: { version: 1, settings } });

    expect(new ProfileStore(storage).current).toEqual({
      version: 3,
      settings,
      stats: getEmptyStatistics(),
      challenges: getEmptyChallengeProgress(),
    });
    expect(JSON.parse(storage.getItem(PROFILE_KEY)!).version).toBe(3);
  });
});

describe('a profile saved by 1.5 (version 2)', () => {
  it('comes up with its settings and statistics, and no challenge passed', () => {
    const settings = { ...DEFAULTS, language: 'ru' as const };
    const stats = { ...getEmptyStatistics(), played: 4, won: 3 };
    const storage = storageWith({ [PROFILE_KEY]: { version: 2, settings, stats } });

    expect(new ProfileStore(storage).current).toEqual({
      version: 3,
      settings,
      stats,
      challenges: { passed: [] },
    });
    expect(JSON.parse(storage.getItem(PROFILE_KEY)!).version).toBe(3);
  });
});

describe('settings saved before the profile (version 0)', () => {
  const legacy = (saved: unknown) =>
    new ProfileStore(storageWith({ [LEGACY_SETTINGS_KEY]: saved })).current.settings;

  it('come into the profile under their names', () => {
    expect(legacy({ d: 2, p: 7, b: 'fuji', m: true, u: false, l: 'ru' })).toEqual({
      difficulty: DifficultyLevel.NORMAL,
      matchPoints: 7,
      matchBackground: 'fuji',
      soundMuted: true,
      musicMuted: false,
      language: 'ru',
    });
  });

  it('are saved as a profile at once, so they are brought up only the once', () => {
    const storage = storageWith({ [LEGACY_SETTINGS_KEY]: { l: 'ru', p: 3 } });
    new ProfileStore(storage);

    expect(JSON.parse(storage.getItem(PROFILE_KEY)!)).toEqual({
      version: 3,
      settings: { ...DEFAULTS, language: 'ru', matchPoints: 3 },
      stats: getEmptyStatistics(),
      challenges: getEmptyChallengeProgress(),
    });
  });

  it('leave a profile of this version as it was saved, and nothing saved as nothing', () => {
    const saved = JSON.stringify({ version: 3, settings: DEFAULTS, extra: true });
    const storage = storageWith({ [PROFILE_KEY]: saved });
    new ProfileStore(storage);
    expect(storage.getItem(PROFILE_KEY)).toBe(saved);

    const empty = storageWith();
    new ProfileStore(empty);
    expect(empty.length).toBe(0);
  });

  it('are left where they were, and the profile is read first once it exists', () => {
    const storage = storageWith({ [LEGACY_SETTINGS_KEY]: { l: 'ru' } });
    new ProfileStore(storage).update({ settings: { ...DEFAULTS, language: 'en' } });

    expect(storage.getItem(LEGACY_SETTINGS_KEY)).toBe('{"l":"ru"}');
    expect(new ProfileStore(storage).current.settings.language).toBe('en');
  });

  it('fall back per setting, and get the quick match setup they predate at its defaults', () => {
    expect(legacy({ d: 'x', m: true, l: 'ru' })).toEqual({
      ...DEFAULTS,
      soundMuted: true,
      language: 'ru',
    });
  });

  it('move a removed level (the Easy of 1.1), an out of range one or a fraction to the default', () => {
    for (const d of [0, 99, 1.5]) {
      expect(legacy({ d }).difficulty).toBe(DifficultyLevel.EASY);
    }
  });

  it('reject a quick match length or backdrop that does not exist', () => {
    expect(legacy({ p: 10, b: 'moon' })).toMatchObject({
      matchPoints: 5,
      matchBackground: 'random',
    });
  });

  it('give way to the defaults when unreadable', () => {
    expect(legacy('{invalid json')).toEqual(DEFAULTS);
  });

  it('had a short key of its own for every setting', () => {
    const keys = Object.values(LEGACY_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('asking the browser to keep the storage', () => {
  const fakeStorage = (persisted = false) => ({
    persisted: vi.fn(async () => persisted),
    persist: vi.fn(async () => true),
  });
  const matchOver: MatchEvent = { type: 'gameOver', winnerIndex: 0, scores: [5, 2] };

  it('asks once a match is over, and only once', async () => {
    const storage = fakeStorage();
    const events = new EventBus<MatchEvent>();
    const persistence = new StoragePersistence(storage as unknown as StorageManager);
    persistence.listenTo(events);

    events.emit({ type: 'matchStart' });
    expect(storage.persist).not.toHaveBeenCalled();
    events.emit(matchOver);
    events.emit(matchOver);
    await vi.waitFor(() => expect(storage.persist).toHaveBeenCalledOnce());
  });

  it('does not ask when the storage is kept already', async () => {
    const storage = fakeStorage(true);
    await new StoragePersistence(storage as unknown as StorageManager).request();
    expect(storage.persist).not.toHaveBeenCalled();
  });

  it('takes a refusal, or a browser without the API, in its stride', async () => {
    const refusing = { persisted: async () => false, persist: () => Promise.reject(new Error()) };
    await expect(
      new StoragePersistence(refusing as unknown as StorageManager).request(),
    ).resolves.toBeUndefined();
    await expect(new StoragePersistence(null).request()).resolves.toBeUndefined();
  });
});
