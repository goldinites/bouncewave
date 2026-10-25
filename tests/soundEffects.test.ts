import { describe, expect, it } from 'vitest';
import { MINOR_TRIAD } from '@/audio/music/theory';
import { getClimbingRallyNote } from '@/audio/sfx/harmony';
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
  it('holds the ball’s air in the dark on one looping source, steered, then fades it out', () => {
    const { sfx, calls } = setup();
    const sources = () => calls.filter((c) => c.method === 'createBufferSource').length;
    const ball = { x: -0.5, height: 0.5, nearness: 0.8, speed: 0.5 };

    sfx.setBallAir(ball);
    sfx.setBallAir({ ...ball, nearness: 1 });
    expect(sources()).toBe(1);
    const levels = () =>
      calls.filter((c) => c.method === 'setTargetAtTime').map((c) => c.args[0] as number);
    const loud = levels().length;
    sfx.setBallAir(null);
    expect(levels().slice(loud)).toContain(0);
  });

  it('holds nothing where action sounds are not heard', () => {
    const { sfx, calls } = setup({ audible: false });
    sfx.setBallAir({ x: 0, height: 0.5, nearness: 1, speed: 1 });
    sfx.setSkateGlide(1);
    expect(calls.filter((c) => c.method === 'createBufferSource')).toHaveLength(0);
  });

  it('plays a hit on the note of the chord the music is on', () => {
    const { sfx, calls, harmony } = setup();

    sfx.playPaddleHit(3);
    // It snaps onto the note from a little above
    const target = calls.find((c) => c.method === 'exponentialRampToValueAtTime')!;
    expect(target.args[0]).toBeCloseTo(midiToFrequency(getClimbingRallyNote(harmony, 3)));
    expect(frequencies(calls)[0]).toBeGreaterThan(target.args[0] as number);
  });

  it('flicks the channels past as a relay and static, then chimes the root and fifth', () => {
    const { sfx, calls, harmony } = setup();

    sfx.playChannelSurf();
    // A relay's thud and a breath of static for each channel, no notes among them
    expect(calls.filter((c) => c.method === 'createBufferSource')).toHaveLength(5);
    // The static's low-pass aside, every frequency set is a relay's or the chime's
    const tones = frequencies(calls).filter((frequency) => frequency !== 3000);
    const chime = tones.slice(-2);
    expect(chime[0]).toBeCloseTo(midiToFrequency(harmony.root + 48));
    expect(chime[1]).toBeCloseTo(midiToFrequency(harmony.root + 48 + 7));
    expect(tones.slice(0, -2).every((frequency) => frequency < 300)).toBe(true);
  });

  it('stays silent with sound effects off', () => {
    const { sfx, oscillators } = setup({ muted: true });

    sfx.playPaddleHit(1);
    sfx.playVictory();
    sfx.playMenuSelect();
    sfx.playChannelSurf();
    expect(oscillators()).toBe(0);
  });

  it('keeps gameplay sounds out of the menus, but not its own clicks or fireworks', () => {
    const { sfx, oscillators } = setup({ audible: false });

    sfx.playWallBounce();
    sfx.playPaddleHit(1);
    sfx.playHeartbeat();
    expect(oscillators()).toBe(0);

    sfx.playMenuBack();
    sfx.playFireworkPop();
    expect(oscillators()).toBeGreaterThanOrEqual(2);
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

  it('plays 5.7c’s sounds, and keeps them out of the menus but the menus’ own', () => {
    const play = (sfx: SoundEffects) => {
      sfx.playSpin(0.5);
      sfx.playScan();
      sfx.playTimeWarp();
      sfx.playWindTurn(1);
      sfx.playPostRise();
      sfx.playPostBounce();
      sfx.playBrickBreak();
      sfx.playShrink(0.7);
      sfx.playSkatePush(0.5);
      sfx.playSkateStop(0.5);
      sfx.playIceTink();
      sfx.playClockTick();
      sfx.playPaddleHit(1, false, 0, { size: 1.5 });
    };
    {
      const { sfx, calls } = setup();
      play(sfx);
      const sounds = calls.filter(
        (c) => c.method === 'createOscillator' || c.method === 'createBufferSource',
      );
      expect(sounds.length).toBeGreaterThan(15);
    }

    const { sfx, oscillators } = setup({ audible: false });
    play(sfx);
    expect(oscillators()).toBe(0);
    sfx.playMenuMove();
    expect(oscillators()).toBe(1);
  });

  it('plays one menu sound at a time: a press already answered stays quiet', () => {
    const { sfx, oscillators } = setup();

    sfx.playMenuBack();
    const back = oscillators();
    sfx.playMenuSelect();
    expect(oscillators()).toBe(back);
  });

  it('builds the victory echo once and reuses it', () => {
    const { sfx, calls } = setup();
    const delays = () => calls.filter((c) => c.method === 'createDelay').length;

    sfx.playVictory();
    sfx.playVictory();
    expect(delays()).toBe(1);
  });
});
