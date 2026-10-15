import { getDefaultSettings, SETTING_KEYS, SETTINGS, UserSettings } from '@/settings/UserSettings';

export const LOCAL_STORAGE_KEY = 'neonpong';

/** Saves settings to LocalStorage under the short keys from SETTINGS. */
export class SettingsStorage {
  private static getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
    return null;
  }

  /** Saved settings; each missing or invalid one falls back to its default on its own. */
  public static load(): UserSettings {
    const settings = getDefaultSettings();

    try {
      const raw = this.getStorage()?.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return settings;

      const stored: unknown = JSON.parse(raw);
      if (typeof stored !== 'object' || stored === null) return settings;

      for (const key of SETTING_KEYS) {
        const value = (stored as Record<string, unknown>)[SETTINGS[key].storageKey];
        if (SETTINGS[key].isValid(value)) {
          (settings as unknown as Record<string, unknown>)[key] = value;
        }
      }
      return settings;
    } catch {
      return getDefaultSettings();
    }
  }

  public static save(settings: UserSettings): void {
    try {
      const storage = this.getStorage();
      if (!storage) return;

      const payload = Object.fromEntries(
        SETTING_KEYS.map((key) => [SETTINGS[key].storageKey, settings[key]]),
      );
      storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore write errors (e.g., storage quota exceeded or disabled cookies)
    }
  }
}
