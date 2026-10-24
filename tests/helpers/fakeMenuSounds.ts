import { vi } from 'vitest';
import { SoundEffects } from '@/audio/sfx/SoundEffects';

/** The sounds the menus play, each a spy: a menu's sound effects without any audio. */
export const fakeMenuSounds = (): SoundEffects =>
  ({
    playSettingsClick: vi.fn(),
    playMenuMove: vi.fn(),
    playMenuSelect: vi.fn(),
    playMenuBack: vi.fn(),
  }) as unknown as SoundEffects;
