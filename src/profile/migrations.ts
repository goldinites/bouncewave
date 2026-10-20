import * as v from 'valibot';
import { getDefaultProfile, Profile, PROFILE_VERSION, profileSchema } from '@/profile/Profile';
import { getEmptyChallengeProgress } from '@/profile/ChallengeProgress';
import { getEmptyStatistics } from '@/profile/Statistics';
import { UserSettings } from '@/settings/UserSettings';

/** Where the game kept its settings before there was a profile (up to 1.2): version 0. */
export const LEGACY_SETTINGS_KEY = 'bouncewave_settings';

/** The short keys version 0 saved each setting under. */
export const LEGACY_KEYS: Record<keyof UserSettings, string> = {
  difficulty: 'd',
  matchPoints: 'p',
  matchBackground: 'b',
  soundMuted: 'm',
  musicMuted: 'u',
  language: 'l',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Steps from each version to the next, by the version they start from. They see the raw saved
 * data and only reshape it; checking every value is the schema's job after the last step.
 */
const MIGRATIONS: ((saved: Record<string, unknown>) => Record<string, unknown>)[] = [
  // 0 → 1: the bare settings under short keys become a profile's settings, under their names
  (saved) => ({
    version: 1,
    settings: Object.fromEntries(
      Object.entries(LEGACY_KEYS).map(([name, short]) => [name, saved[short]]),
    ),
  }),
  // 1 → 2: statistics begin, from nothing
  (saved) => ({ ...saved, version: 2, stats: getEmptyStatistics() }),
  // 2 → 3: the challenges begin, none passed
  (saved) => ({ ...saved, version: 3, challenges: getEmptyChallengeProgress() }),
  // 3 → 4: the tutorial begins; someone who has played a match already knows the game, and isn't
  // offered it (it stays on the PLAY menu)
  (saved) => ({ ...saved, version: 4, tutorial: hasPlayed(saved) ? 'skipped' : null }),
];

/** Whether a saved profile records a finished match. */
const hasPlayed = (saved: Record<string, unknown>): boolean =>
  isRecord(saved.stats) && typeof saved.stats.played === 'number' && saved.stats.played > 0;

/** The saved data's version: whatever lacks one predates profiles. */
const versionOf = (saved: Record<string, unknown>): number =>
  typeof saved.version === 'number' && Number.isInteger(saved.version) ? saved.version : 0;

/**
 * A saved profile of any version, brought up to the current one and checked. Never throws:
 * data that isn't a profile at all gives the defaults, a bad value its own default. A profile
 * from a newer build than this one is read for what this build knows of it.
 */
export function loadProfile(saved: unknown): Profile {
  if (!isRecord(saved)) return getDefaultProfile();

  let data = saved;
  for (let version = versionOf(data); version < PROFILE_VERSION; version++) {
    data = MIGRATIONS[version](data);
  }
  const result = v.safeParse(profileSchema, { ...data, version: PROFILE_VERSION });
  return result.success ? result.output : getDefaultProfile();
}
