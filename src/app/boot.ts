import { ProfileStore } from '@/profile/ProfileStore';

/**
 * Everything the game needs before its first frame. For now the player's profile, read from
 * this browser's storage; a portal's SDK (ROADMAP 8.7) starts here first, since a portal's
 * account and saves come asynchronously, and the profile is then read from where it says.
 */
export async function boot(): Promise<{ profile: ProfileStore }> {
  return { profile: new ProfileStore() };
}
