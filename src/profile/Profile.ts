import * as v from 'valibot';
import { challengeProgressSchema, getEmptyChallengeProgress } from '@/profile/ChallengeProgress';
import { getEmptyStatistics, statisticsSchema } from '@/profile/Statistics';
import { getDefaultSettings, SETTING_KEYS, SETTINGS, UserSettings } from '@/settings/UserSettings';

/**
 * The version of the saved profile this build writes. Raise it with every change to what is
 * saved, and add the step from the version before to MIGRATIONS (profile/migrations.ts).
 */
export const PROFILE_VERSION = 4;

/**
 * Each setting as a saved one is checked: whatever is missing or invalid falls back to its
 * default on its own, so one bad value never costs the player the rest. Built from SETTINGS, so
 * a new setting is checked with no change here.
 */
const settingsSchema = v.object(
  Object.fromEntries(
    SETTING_KEYS.map((key) => {
      const { isValid, defaultValue } = SETTINGS[key];
      return [key, v.fallback(v.custom(isValid), defaultValue)];
    }),
  ),
) as unknown as v.GenericSchema<unknown, UserSettings>;

/**
 * How the tutorial (step 4.8) stands for the player: gone through, turned down (NO when offered),
 * or neither yet (null): offered on PLAY until one or the other.
 */
export const tutorialStateSchema = v.fallback(v.nullable(v.picklist(['done', 'skipped'])), null);

export type TutorialState = v.InferOutput<typeof tutorialStateSchema>;

/** Everything saved between visits, at the current version. */
export const profileSchema = v.object({
  version: v.literal(PROFILE_VERSION),
  // Not an object at all: every setting at its default
  settings: v.fallback(settingsSchema, getDefaultSettings),
  // From version 2
  stats: statisticsSchema,
  // From version 3
  challenges: challengeProgressSchema,
  // From version 4
  tutorial: tutorialStateSchema,
});

export type Profile = v.InferOutput<typeof profileSchema>;

export function getDefaultProfile(): Profile {
  return {
    version: PROFILE_VERSION,
    settings: getDefaultSettings(),
    stats: getEmptyStatistics(),
    challenges: getEmptyChallengeProgress(),
    tutorial: null,
  };
}
