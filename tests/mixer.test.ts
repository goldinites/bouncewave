import { describe, expect, it, vi } from 'vitest';
import { createReverbImpulse, dbToGain, gainToDb, softClipCurve } from '@/audio/curves';
import { Mixer } from '@/audio/Mixer';
import { Instruments } from '@/audio/music/Instruments';
import { MusicGraph } from '@/audio/music/MusicGraph';
import { MINOR_TRIAD } from '@/audio/music/theory';
import { SampleBank } from '@/audio/samples/SampleBank';
import { getClimbingRallyNote } from '@/audio/sfx/harmony';
import { heatLevel, SoundEffects } from '@/audio/sfx/SoundEffects';
import { midiToFrequency } from '@/shared/math';
import { AudioCall, fakeAudioContext } from './helpers/fakeAudioContext';

const callsOf = (calls: AudioCall[], method: string) => calls.filter((c) => c.method === method);

describe('curves', () => {
  it('converts between decibels and gain', () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
    expect(gainToDb(dbToGain(-13.5))).toBeCloseTo(-13.5);
  });

  it('soft-clips: quiet levels pass at unity, loud ones bend toward the knee and never past it', () => {
    const range = 4;
    const curve = softClipCurve(0.5, range);
    // The input is scaled down by the range before the curve, so its slope at 0 is the range
    const step = (2 * range) / (curve.length - 1);
    const middle = curve.length / 2;
    expect((curve[middle] - curve[middle - 1]) / step).toBeCloseTo(1, 2);

    expect(Math.max(...curve)).toBeLessThan(0.5);
    expect(Math.max(...curve)).toBeGreaterThan(0.49);
    expect(curve[0]).toBeCloseTo(-curve[curve.length - 1]);
    for (let i = 1; i < curve.length; i++) expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1]);
  });

  it('builds a reverb tail that dies away to silence, each side its own', () => {
    const rate = 8000;
    const channels: Float32Array[] = [];
    const ac = {
      sampleRate: rate,
      createBuffer: (count: number, length: number) => {
        for (let i = 0; i < count; i++) channels.push(new Float32Array(length));
        return { getChannelData: (i: number) => channels[i] };
      },
    } as unknown as BaseAudioContext;

    createReverbImpulse(ac, 1, 0.01);
    const [left, right] = channels;
    expect(left.length).toBe(Math.ceil(1.01 * rate));
    expect(left.slice(0, 80).every((v) => v === 0)).toBe(true); // the pre-delay
    const energy = (from: number, to: number) =>
      left.slice(from, to).reduce((sum, v) => sum + v * v, 0);
    expect(energy(80, 880)).toBeGreaterThan(energy(7280, 8080) * 100);
    expect(left).not.toEqual(right);
  });
});

describe('Mixer', () => {
  it('dips the music under a strong hit and brings it back', () => {
    const { ctx, calls } = fakeAudioContext(5);
    const mixer = new Mixer(ctx);

    mixer.duckMusic(1);
    const [dip, back] = callsOf(calls, 'setTargetAtTime').slice(-2);
    expect(dip.args[0]).toBeCloseTo(dbToGain(-4));
    expect(dip.args[1]).toBe(5);
    expect(back.args[0]).toBe(1);
    expect(back.args[1]).toBeGreaterThan(5);
    // A dip still running is cut short, never stacked behind
    expect(callsOf(calls, 'cancelScheduledValues').at(-1)!.args).toEqual([5]);

    mixer.duckMusic(0.5);
    expect(callsOf(calls, 'setTargetAtTime').at(-2)!.args[0]).toBeCloseTo(dbToGain(-2));
  });

  it('meters the master in dBFS', () => {
    const { ctx } = fakeAudioContext();
    const mixer = new Mixer(ctx);
    const wave = [0.5, -0.5, 0.5, -0.5];
    Object.assign(mixer as unknown as { meter: unknown }, {
      meter: { fftSize: 4, getFloatTimeDomainData: (data: Float32Array) => data.set(wave) },
    });

    const levels = mixer.getLevels();
    expect(levels.rms).toBeCloseTo(-6.02, 1);
    expect(levels.peak).toBeCloseTo(-6.02, 1);
  });
});

describe('the music’s stems', () => {
  it('breathe under every kick: bass and pads dip on its beat, deeper the harder it hits', () => {
    const { ctx, calls } = fakeAudioContext();
    const graph = new MusicGraph(ctx);
    const play = new Instruments(graph);
    const dips = () =>
      callsOf(calls, 'setTargetAtTime')
        .filter((c) => (c.args[0] as number) < 1)
        .slice(-2)
        .map((c) => c.args);

    play.kick(2, 0.75);
    const hard = dips();
    expect(hard.map(([, time]) => time)).toEqual([2, 2]);
    play.kick(3, 0.3);
    const soft = dips();
    expect(soft[0][0]).toBeGreaterThan(hard[0][0] as number);
  });

  it('pump as deep as the song asks: a band that breathes by its own playing not at all', () => {
    const { ctx, calls } = fakeAudioContext();
    const graph = new MusicGraph(ctx);
    const play = new Instruments(graph);
    const dip = () => callsOf(calls, 'setTargetAtTime').at(-2)!.args[0] as number;

    play.kick(2, 0.75);
    const full = dip();
    graph.setSongSpace('night', 0.5, 3);
    play.kick(4, 0.75);
    expect(1 - dip()).toBeCloseTo((1 - full) / 2);

    graph.setSongSpace('studio', 0, 5);
    const before = callsOf(calls, 'setTargetAtTime').length;
    play.kick(6, 0.75);
    expect(callsOf(calls, 'setTargetAtTime').length).toBe(before);
  });

  it('evens the songs out only when the level changes', () => {
    const { ctx, calls } = fakeAudioContext();
    const graph = new MusicGraph(ctx);
    const before = callsOf(calls, 'setTargetAtTime').length;

    for (let i = 0; i < 50; i++) graph.setSongLevel(-1.5, i);
    graph.setSongLevel(2, 60);
    const set = callsOf(calls, 'setTargetAtTime').slice(before);
    expect(set.map((c) => c.args[0])).toEqual([dbToGain(-1.5), dbToGain(2)]);
  });

  it('lifts a part’s pads and melody against the beat only when the part changes them', () => {
    const { ctx, calls } = fakeAudioContext(0);
    const graph = new MusicGraph(ctx);
    const before = callsOf(calls, 'setTargetAtTime').length;

    for (let i = 0; i < 50; i++) graph.setPartMix({}, i);
    for (let i = 50; i < 100; i++) graph.setPartMix({ pads: 6, melody: 4 }, i);
    graph.setPartMix({}, 100);
    const set = callsOf(calls, 'setTargetAtTime').slice(before);
    expect(set.map((c) => c.args[0])).toEqual([dbToGain(6), dbToGain(4), 1, 1]);
  });
});

describe('SoundEffects on the mixer', () => {
  const setup = ({ muted = false } = {}) => {
    const { ctx, calls } = fakeAudioContext(1);
    const mixer = new Mixer(ctx);
    const ducks: number[] = [];
    mixer.duckMusic = (strength) => void ducks.push(strength);
    const sfx = new SoundEffects(
      () => ctx,
      () => muted,
      () => true,
      () => ({ root: 33, chord: MINOR_TRIAD }),
      () => mixer,
    );
    const connectedTo = (node: AudioNode) => calls.some((c) => c.args[0] === node);
    return { sfx, mixer, ducks, connectedTo };
  };

  it('plays on the sound-effects bus, and menu sounds on the menu bus', () => {
    const { sfx, mixer, connectedTo } = setup();

    sfx.playWallBounce();
    expect(connectedTo(mixer.sfx)).toBe(true);
    expect(connectedTo(mixer.menu)).toBe(false);
    sfx.playMenuSelect();
    expect(connectedTo(mixer.menu)).toBe(true);
  });

  it('dips the music under strong hits only', () => {
    const { sfx, ducks } = setup();

    sfx.playPaddleHit(3);
    sfx.playWallBounce();
    expect(ducks).toEqual([]);
    sfx.playPaddleHit(3, true);
    sfx.playPowerShot(3);
    expect(ducks).toEqual([0.6, 1]);
  });

  it('leaves the music alone when the hit is not heard', () => {
    const { sfx, ducks } = setup({ muted: true });

    sfx.playPowerShot(3);
    expect(ducks).toEqual([]);
  });
});

describe('the paddle hits and the layered sounds', () => {
  // The sounds a layered sound picked, each once, sorted: the check that they are rendered aside
  const layersOf = (picked: string[]) => [...new Set(picked.slice(1))].sort();

  const setup = ({ rendered = true } = {}) => {
    const { ctx, calls } = fakeAudioContext(1);
    const mixer = new Mixer(ctx);
    const carves: number[] = [];
    const ducks: number[] = [];
    mixer.carveForHit = (strength) => void carves.push(strength);
    mixer.duckMusic = (strength) => void ducks.push(strength);
    const picked: string[] = [];
    const buffer = {} as AudioBuffer;
    const samples = {
      pick: (id: string) => (rendered ? (picked.push(id), buffer) : null),
      pickNote: (id: string) =>
        rendered ? (picked.push(id), { buffer, rate: 1, loop: null }) : null,
    } as unknown as SampleBank;
    const sfx = new SoundEffects(
      () => ctx,
      () => false,
      () => true,
      () => ({ root: 33, chord: MINOR_TRIAD }),
      () => mixer,
      () => samples,
    );
    return { sfx, calls, carves, ducks, picked };
  };

  it('beeps a hit, snapping onto its note, brighter and carving deeper the harder', () => {
    const { sfx, calls, picked, carves } = setup();
    // The mixer's own filters aside
    const filters = callsOf(calls, 'createBiquadFilter').length;

    sfx.playPaddleHit(1, false, 0, { force: 0 });
    sfx.playPaddleHit(1, false, 1, { force: 1 });
    expect(picked).toEqual([]);
    expect(callsOf(calls, 'createOscillator')).toHaveLength(2);
    // Each tone starts above its note and drops onto it
    const note = midiToFrequency(getClimbingRallyNote({ root: 33, chord: MINOR_TRIAD }, 1));
    const ramps = callsOf(calls, 'exponentialRampToValueAtTime').map((c) => c.args[0]);
    expect(ramps.filter((value) => value === note)).toHaveLength(2);
    expect(callsOf(calls, 'createBiquadFilter')).toHaveLength(filters + 2);
    expect(carves).toEqual([0.5, 1]);
  });

  it('rings out a perfect hit with a punch under it, the music dipping', () => {
    const { sfx, calls, ducks, picked } = setup();

    sfx.playPaddleHit(3, true, 0);
    // The sine, its octave and a glint, and the punch's 8-bit kick; its noise channel's crack
    expect(callsOf(calls, 'createOscillator')).toHaveLength(4);
    expect(callsOf(calls, 'createBufferSource')).toHaveLength(1);
    expect(ducks).toEqual([0.6]);
    expect(picked).toEqual([]);
    sfx.playPaddleHit(3, true, 0);
    // Its noise is rendered once
    expect(callsOf(calls, 'createBuffer')).toHaveLength(1);
  });

  it('climbs a rally two octaves as the old beeps did', () => {
    const { sfx, calls } = setup();
    const harmony = { root: 33, chord: MINOR_TRIAD };

    sfx.playPaddleHit(5);
    const ramps = callsOf(calls, 'exponentialRampToValueAtTime').map((c) => c.args[0]);
    expect(ramps).toContain(midiToFrequency(getClimbingRallyNote(harmony, 5)));
  });

  it('knocks a wall in its own muted voice, well under a hit', () => {
    const { sfx, picked } = setup();

    sfx.playWallBounce(0.5);
    expect(layersOf(picked)).toEqual(['thump', 'wall']);
  });

  it('fires an Overdrive as a crack, a blast, a laser shot, an arc and a neon tube', () => {
    const { sfx, picked, ducks, carves } = setup();

    sfx.playPowerShot(4);
    expect(picked).toEqual(
      expect.arrayContaining(['click.steel', 'body.neon', 'crack', 'blast', 'pew', 'arc', 'tube']),
    );
    expect(ducks).toEqual([1]);
    expect(carves).toEqual([1]);
  });

  it('locks on and lights the chord in neon when the Overdrive meter fills', () => {
    const { sfx, picked } = setup();

    sfx.playOverdriveReady();
    expect(picked).toEqual(expect.arrayContaining(['arc', 'spark']));
    // Three tubes up the chord, the last one an octave higher too
    expect(picked.filter((id) => id === 'tube')).toHaveLength(4);
    expect(picked.filter((id) => id === 'beam')).toHaveLength(2);
  });

  it('plays the live synth until the layers are rendered', () => {
    const { sfx, calls } = setup({ rendered: false });

    sfx.playWallBounce();
    expect(callsOf(calls, 'createOscillator').length).toBeGreaterThan(0);
    expect(callsOf(calls, 'createBufferSource')).toEqual([]);
  });
});

describe('the music dipped under an Overdrive', () => {
  it('holds the dip longer and lets it back slowly, its tail ringing in it', () => {
    const times = (isLong: boolean) => {
      const { ctx, calls } = fakeAudioContext(1);
      const mixer = new Mixer(ctx);
      const before = callsOf(calls, 'setTargetAtTime').length;
      mixer.duckMusic(1, isLong);
      const [, back] = callsOf(calls, 'setTargetAtTime').slice(before);
      return back.args as number[];
    };

    const [, shortFrom, shortRelease] = times(false);
    const [, longFrom, longRelease] = times(true);
    expect(longFrom).toBeGreaterThan(shortFrom);
    expect(longRelease).toBeGreaterThan(shortRelease);
  });
});

describe('the music carved for a hit', () => {
  it('dips the hits’ band out of the music and brings it back', () => {
    const { ctx, calls } = fakeAudioContext(1);
    const mixer = new Mixer(ctx);
    const before = callsOf(calls, 'setTargetAtTime').length;

    mixer.carveForHit(1);
    const [dip, back] = callsOf(calls, 'setTargetAtTime').slice(before);
    expect(dip.args[0]).toBeLessThan(0);
    expect(back.args[0]).toBe(0);
  });
});

describe('action sounds with the music’s heat', () => {
  it('play soft on the serve, as written in a rally, louder at the peak, and evenly between', () => {
    expect(heatLevel(0)).toBe(-3);
    expect(heatLevel(0.25)).toBe(-3);
    expect(heatLevel(0.45)).toBe(0);
    expect(heatLevel(0.65)).toBeCloseTo(2);
    expect(heatLevel(1)).toBe(4);
  });

  it('play a layered sound louder when the music is hotter', () => {
    const hitGain = (heat: number) => {
      const { ctx } = fakeAudioContext(1);
      const buffer = {} as AudioBuffer;
      const samples = {
        pick: () => buffer,
        pickNote: () => ({ buffer, rate: 1, loop: null }),
      } as unknown as SampleBank;
      // Every gain's level as it is set: the layers' are the loudest
      const gains: number[] = [];
      const real = ctx.createGain.bind(ctx);
      ctx.createGain = () => {
        const gain = real();
        gains.push(0);
        const index = gains.length - 1;
        return new Proxy(gain, {
          get: (target, key) =>
            key === 'gain'
              ? new Proxy(target.gain, {
                  set: (param, prop, value) => {
                    if (prop === 'value') gains[index] = value as number;
                    return Reflect.set(param, prop, value);
                  },
                })
              : Reflect.get(target, key),
        });
      };
      const sfx = new SoundEffects(
        () => ctx,
        () => false,
        () => true,
        () => ({ root: 33, chord: MINOR_TRIAD }),
        () => null,
        () => samples,
        () => heat,
      );
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      sfx.playWallBounce();
      vi.restoreAllMocks();
      return Math.max(...gains);
    };

    expect(hitGain(1) / hitGain(0)).toBeCloseTo(dbToGain(7), 2);
  });

  it('play a paddle hit louder when the music is hotter', () => {
    const hitVolume = (heat: number) => {
      const { ctx, calls } = fakeAudioContext(1);
      const sfx = new SoundEffects(
        () => ctx,
        () => false,
        () => true,
        () => ({ root: 33, chord: MINOR_TRIAD }),
        () => null,
        () => null,
        () => heat,
      );
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      sfx.playPaddleHit(1);
      vi.restoreAllMocks();
      // The levels the tone is struck at, under the frequencies it is set to
      return Math.max(
        ...callsOf(calls, 'setValueAtTime')
          .map((c) => c.args[0] as number)
          .filter((value) => value < 1),
      );
    };

    expect(hitVolume(1) / hitVolume(0)).toBeCloseTo(dbToGain(7), 2);
  });
});

describe('Mixer output', () => {
  it('shuts everything at once when the game is hidden, and opens it again over a moment', () => {
    const { ctx, calls } = fakeAudioContext();
    const mixer = new Mixer(ctx);
    const before = calls.length;

    mixer.silence(true);
    const shut = calls.slice(before);
    // At once, not eased: nothing already on its way out may still be heard
    expect(callsOf(shut, 'setValueAtTime').map((c) => c.args[0])).toEqual([0]);
    expect(callsOf(shut, 'setTargetAtTime')).toHaveLength(0);

    const opened = calls.length;
    mixer.silence(false);
    expect(callsOf(calls.slice(opened), 'setTargetAtTime').map((c) => c.args[0])).toEqual([1]);
  });
});
