import { describe, expect, it } from 'vitest';
import { MINOR_TRIAD } from '@/audio/music/theory';
import { getRallyNote } from '@/audio/sfx/harmony';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { midiToFrequency } from '@/shared/math';
import { AudioCall, fakeAudioContext } from './helpers/fakeAudioContext';

const setup = ({ muted = false, audible = true } = {}) => {
  const { ctx, calls } = fakeAudioContext(1);
  const harmony = { root: 33, chord: MINOR_TRIAD };
  const sfx = new SoundEffects(
    () => ctx,
    () => muted,
    () => audible,
    () => harmony,
  );
  const oscillators = () => calls.filter((c) => c.method === 'createOscillator').length;
  return { sfx, calls, harmony, oscillators };
};

/** The frequencies the oscillators were set to, in order. */
const frequencies = (calls: AudioCall[]) =>
  calls
    .filter((c) => c.method === 'setValueAtTime')
    .map((c) => c.args[0] as number)
    .filter((value) => value > 20);

describe('SoundEffects', () => {
  it('plays a hit on the note of the chord the music is on', () => {
    const { sfx, calls, harmony } = setup();

    sfx.playPaddleHit(3);
    expect(frequencies(calls)[0]).toBeCloseTo(midiToFrequency(getRallyNote(harmony, 3)));
  });

  it('stays silent with sound effects off', () => {
    const { sfx, oscillators } = setup({ muted: true });

    sfx.playPaddleHit(1);
    sfx.playVictory();
    sfx.playSettingsClick();
    expect(oscillators()).toBe(0);
  });

  it('keeps gameplay sounds out of the menus, but not its own clicks or fireworks', () => {
    const { sfx, oscillators } = setup({ audible: false });

    sfx.playWallBounce();
    sfx.playPaddleHit(1);
    sfx.playHeartbeat();
    expect(oscillators()).toBe(0);

    sfx.playSettingsClick();
    sfx.playFireworkPop();
    expect(oscillators()).toBe(2);
  });

  it('plays nothing before the audio is unlocked', () => {
    const sfx = new SoundEffects(
      () => null,
      () => false,
      () => true,
    );

    expect(() => {
      sfx.playPaddleHit(1);
      sfx.playVictory();
      sfx.playDefeat();
    }).not.toThrow();
  });

  it('builds the victory echo once and reuses it', () => {
    const { sfx, calls } = setup();
    const delays = () => calls.filter((c) => c.method === 'createDelay').length;

    sfx.playVictory();
    sfx.playVictory();
    expect(delays()).toBe(1);
  });
});
