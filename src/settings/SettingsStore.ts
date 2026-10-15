import { SettingsStorage } from '@/settings/SettingsStorage';
import { SETTINGS, UserSettings } from '@/settings/UserSettings';

/** Where settings are kept between visits. */
export interface SettingsPersistence {
  load(): UserSettings;
  save(settings: UserSettings): void;
}

type SettingsListener = (settings: Readonly<UserSettings>) => void;

/**
 * The player's settings, held in one place: read `current`, change them with `update`,
 * which saves them and notifies subscribers (e.g. so the UI language follows).
 */
export class SettingsStore {
  private settings: UserSettings;
  private readonly persistence: SettingsPersistence;
  private readonly listeners = new Set<SettingsListener>();

  constructor(persistence: SettingsPersistence = SettingsStorage) {
    this.persistence = persistence;
    this.settings = persistence.load();
  }

  public get current(): Readonly<UserSettings> {
    return this.settings;
  }

  public update(patch: Partial<UserSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.persistence.save(this.settings);
    this.listeners.forEach((listener) => listener(this.settings));
  }

  /** Switches a setting to its next value, as picking it in the menu does. */
  public cycle<K extends keyof UserSettings>(key: K): void {
    const next = SETTINGS[key].next(this.settings[key]);
    this.update({ [key]: next } as Pick<UserSettings, K>);
  }

  /** @returns a function that unsubscribes */
  public subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
