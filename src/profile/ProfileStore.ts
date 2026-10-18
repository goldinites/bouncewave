import { LEGACY_SETTINGS_KEY, loadProfile } from '@/profile/migrations';
import { Profile, PROFILE_VERSION } from '@/profile/Profile';
import { SettingsPersistence } from '@/settings/SettingsStore';

/** Where the profile is kept in localStorage. */
export const PROFILE_KEY = 'bouncewave_profile';

/** The page's localStorage, or null where there is none or it can't be reached. */
function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Some browsers throw on merely touching it with storage blocked
    return null;
  }
}

/**
 * The player's profile: read once at start (migrated from whatever version it was saved in),
 * held in memory, and written whole on every change. Storage that fails, full or blocked, never
 * stops the game: it plays on with the profile in memory.
 */
export class ProfileStore {
  private profile: Profile;
  private readonly storage: Storage | null;

  constructor(storage: Storage | null = browserStorage()) {
    this.storage = storage;
    const { profile, isCurrent } = this.read();
    this.profile = profile;
    // Brought up from an older version (or the settings before profiles): saved at once in this
    // one, so the migration runs only the once
    if (!isCurrent) this.write();
  }

  public get current(): Readonly<Profile> {
    return this.profile;
  }

  /** Replaces parts of the profile and saves it. */
  public update(patch: Partial<Omit<Profile, 'version'>>): void {
    this.profile = { ...this.profile, ...patch };
    this.write();
  }

  private write(): void {
    try {
      this.storage?.setItem(PROFILE_KEY, JSON.stringify(this.profile));
    } catch {
      // Full or blocked: the change holds until the page is closed
    }
  }

  /** The settings' part of it, for the SettingsStore. */
  public get settings(): SettingsPersistence {
    return {
      load: () => this.profile.settings,
      save: (settings) => this.update({ settings }),
    };
  }

  /**
   * The saved profile, or the settings saved before profiles existed, or nothing; and whether
   * it needs no bringing up (nothing saved, or saved by this version or a newer one).
   */
  private read(): { profile: Profile; isCurrent: boolean } {
    let saved: unknown = null;
    let isCurrent = true;
    try {
      const profile = this.storage?.getItem(PROFILE_KEY) ?? null;
      const raw = profile ?? this.storage?.getItem(LEGACY_SETTINGS_KEY) ?? null;
      saved = raw === null ? null : JSON.parse(raw);
      const version = (saved as { version?: unknown } | null)?.version;
      // A newer build's profile (a deploy rolled back) is left alone until the player changes something
      isCurrent =
        raw === null ||
        (profile !== null && typeof version === 'number' && version >= PROFILE_VERSION);
    } catch {
      // Unreadable: start from the defaults, which the next change saves over it
    }
    return { profile: loadProfile(saved), isCurrent };
  }
}
