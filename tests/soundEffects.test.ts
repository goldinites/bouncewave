import { describe, expect, it } from 'vitest';
import { MINOR_TRIAD } from '@/audio/music/theory';
import { getClimbingRallyNote, getRallyNote } from '@/audio/sfx/harmony';
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
    // It snaps onto the note from a little above
    const target = calls.find((c) => c.method === 'exponentialRampToValueAtTime')!;
    expect(target.args[0]).toBeCloseTo(midiToFrequency(getClimbingRallyNote(harmony, 3)));
    expect(frequencies(calls)[0]).toBeGreaterThan(target.args[0] as number);
  });

  it('climbs the chord the music is on as the channels flick past', () => {
    const { sfx, calls, harmony } = setup();

    sfx.playChannelSurf();
    // Each blip follows its button click; the blips walk up the chord like a rally does
    const blips = frequencies(calls).filter((frequency) => frequency !== 2400);
    for (let i = 0; i < 4; i++) {
      expect(blips[i]).toBeCloseTo(midiToFrequency(getRallyNote(harmony, i + 1)));
    }
  });

  it('stays silent with sound effects off', () => {
    const { sfx, oscillators } = setup({ muted: true });

    sfx.playPaddleHit(1);
    sfx.playVictory();
    sfx.playSettingsClick();
    sfx.playChannelSurf();
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

  it('plays the point’s sounds, up the chord on a point won', () => {
    const { sfx, calls, harmony, oscillators } = setup();

    sfx.playServeTick();
    sfx.playServeGo();
    sfx.playPointWon(1);
    sfx.playPointLost(-1);
    sfx.playDeciderSting();
    // A tick, the go's two notes, three and the octave and its glint, two, the sting's chord
    expect(oscillators()).toBe(1 + 2 + 5 + 2 + 3);
    // The point won climbs the chord the music is on
    const won = midiToFrequency(harmony.root + 36 + harmony.chord[2]);
    expect(frequencies(calls)).toContainEqual(won);
  });

  it('keeps the point’s sounds out of the menus', () => {
    const { sfx, oscillators } = setup({ audible: false });

    sfx.playServeTick();
    sfx.playServeGo();
    sfx.playPointWon();
    sfx.playPointLost();
    sfx.playDeciderSting();
    expect(oscillators()).toBe(0);
  });

  it('builds the victory echo once and reuses it', () => {
    const { sfx, calls } = setup();
    const delays = () => calls.filter((c) => c.method === 'createDelay').length;

    sfx.playVictory();
    sfx.playVictory();
    expect(delays()).toBe(1);
  });
});
