import { batch, Signal, signal } from '@preact/signals-core';
import { SETTINGS, UserSettings } from '@/settings/UserSettings';

/** Where settings are kept between visits: the profile's settings (ProfileStore.settings). */
export interface SettingsPersistence {
  load(): UserSettings;
  save(settings: UserSettings): void;
}

type SettingsListener = (settings: Readonly<UserSettings>) => void;

/**
 * The player's settings, held in one place: read `current`, change them with `update`,
 * which saves them and notifies subscribers (e.g. so the UI language follows). `current` is a
 * signal's value, so a screen drawn in an effect (`MenuController`) is drawn again by itself
 * when a setting it shows changes.
 */
export class SettingsStore {
  private readonly settings: Signal<Readonly<UserSettings>>;
  private readonly persistence: SettingsPersistence;
  private readonly listeners = new Set<SettingsListener>();

  constructor(persistence: SettingsPersistence) {
    this.persistence = persistence;
    this.settings = signal<Readonly<UserSettings>>(persistence.load());
  }

  public get current(): Readonly<UserSettings> {
    return this.settings.value;
  }

  public update(patch: Partial<UserSettings>): void {
    const settings = { ...this.settings.value, ...patch };
    this.persistence.save(settings);
    // The subscribers hear of it before the effects run, so a screen drawn again in a new
    // language finds the game's texts already switched to it
    batch(() => {
      this.settings.value = settings;
      this.listeners.forEach((listener) => listener(settings));
    });
  }

  /**
   * Switches a setting to its next value, as picking it in the menu does, or with `step` -1 back
   * to its previous one.
   */
  public cycle<K extends keyof UserSettings>(key: K, step: 1 | -1 = 1): void {
    const definition = SETTINGS[key];
    const value = this.settings.value[key];
    const next = step === 1 ? definition.next(value) : definition.previous(value);
    this.update({ [key]: next } as Pick<UserSettings, K>);
  }

  /** @returns a function that unsubscribes */
  public subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
