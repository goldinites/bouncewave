import { isLanguage, Language } from '@/i18n/translations';
import { DifficultyLevel, isDifficultyLevel } from '@/match/difficulty';
export const LOCAL_STORAGE_KEY = 'neonpong';

export interface UserSettings {
  difficulty: DifficultyLevel;
  soundMuted: boolean;
  musicMuted: boolean;
  language: Language;
}

interface StoredData {
  d?: number;
  m?: boolean;
  u?: boolean;
  l?: string;
}

export class SettingsStorage {
  private static readonly DEFAULT_SETTINGS: UserSettings = {
    difficulty: DifficultyLevel.NORMAL,
    soundMuted: false,
    musicMuted: false,
    language: 'en',
  };

  private static getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
    return null;
  }

  public static load(): UserSettings {
    try {
      const storage = this.getStorage();
      if (!storage) {
        return { ...this.DEFAULT_SETTINGS };
      }

      const raw = storage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) {
        return { ...this.DEFAULT_SETTINGS };
      }

      const parsed: StoredData = JSON.parse(raw);
      const difficulty = isDifficultyLevel(parsed.d) ? parsed.d : this.DEFAULT_SETTINGS.difficulty;

      const language = isLanguage(parsed.l) ? parsed.l : this.DEFAULT_SETTINGS.language;

      return {
        difficulty,
        soundMuted: Boolean(parsed.m),
        musicMuted: Boolean(parsed.u),
        language,
      };
    } catch {
      return { ...this.DEFAULT_SETTINGS };
    }
  }

  public static save(settings: UserSettings): void {
    try {
      const storage = this.getStorage();
      if (!storage) return;

      const payload: StoredData = {
        d: settings.difficulty,
        m: settings.soundMuted,
        u: settings.musicMuted,
        l: settings.language,
      };
      storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore write errors (e.g., storage quota exceeded or disabled cookies)
    }
  }
}
