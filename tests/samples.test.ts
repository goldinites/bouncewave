import { afterEach, describe, expect, it, vi } from 'vitest';
import { Instruments } from '@/audio/music/Instruments';
import { KITS } from '@/audio/music/kits';
import { MusicGraph } from '@/audio/music/MusicGraph';
import { DRUM_SAMPLES } from '@/audio/samples/drums';
import { PITCHED_SAMPLES } from '@/audio/samples/pitched';
import { PitchedRecipe, SampleBank, SampleRecipe } from '@/audio/samples/SampleBank';
import { midiToFrequency } from '@/shared/math';
import { seededRandom } from '@/shared/random';
import { fakeAudioContext } from './helpers/fakeAudioContext';

/** A buffer holding `values`, enough of an AudioBuffer for the bank. */
const buffer = (values: number[]) => {
  const data = Float32Array.from(values);
  return {
    length: data.length,
    numberOfChannels: 1,
    getChannelData: () => data,
  } as unknown as AudioBuffer;
};

/**
 * Installs an offline context whose render is a buffer of the first numbers the recipe drew
 * from its random, so tests can see which seed each variant got.
 */
const stubOfflineContext = () => {
  vi.stubGlobal(
    'OfflineAudioContext',
    class {
      public drawn: number[] = [];
      public startRendering() {
        return Promise.resolve(buffer(this.drawn));
      }
    },
  );
};

const recipe = (variants: number, level = 0): SampleRecipe => ({
  duration: 0.1,
  variants,
  level,
  build: (ctx, random) => {
    (ctx as unknown as { drawn: number[] }).drawn = [random() - 0.5, random() - 0.5];
  },
});

describe('seededRandom', () => {
  it('repeats its sequence for a seed, and differs between seeds', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    const c = seededRandom(8);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect(c()).not.toBe(first[0]);
    expect(first.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe('SampleBank', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('has nothing to give before rendering, so instruments fall back to their live synths', () => {
    expect(new SampleBank().pick('kickPunch')).toBeNull();
  });

  it('renders each variant with a seed of its own, the same on every render', async () => {
    stubOfflineContext();
    const first = new SampleBank();
    const second = new SampleBank();
    await first.render(48000, { thump: recipe(3) });
    await second.render(48000, { thump: recipe(3) });

    const variants = [0, 1, 2].map(() => Array.from(first.pick('thump')!.getChannelData(0)));
    expect(new Set(variants.map(String)).size).toBe(3);
    expect(Array.from(second.pick('thump')!.getChannelData(0))).toEqual(variants[0]);
  });

  it('hands the variants out in turn', async () => {
    stubOfflineContext();
    const bank = new SampleBank();
    await bank.render(48000, { thump: recipe(2) });

    const [a, b, c] = [bank.pick('thump'), bank.pick('thump'), bank.pick('thump')];
    expect(a).not.toBe(b);
    expect(c).toBe(a);
  });

  it('normalises each sound’s peak to its level', async () => {
    stubOfflineContext();
    const bank = new SampleBank();
    await bank.render(48000, { loud: recipe(1), soft: recipe(1, -6) });

    const peak = (id: string) => Math.max(...bank.pick(id)!.getChannelData(0).map(Math.abs));
    expect(peak('loud')).toBeCloseTo(1);
    expect(peak('soft')).toBeCloseTo(10 ** (-6 / 20));
    expect(bank.bytes).toBe(2 * 2 * 4);
    expect(bank.ids).toEqual(['loud', 'soft']);
  });

  it('renders nothing where the browser can’t render offline', async () => {
    vi.stubGlobal('OfflineAudioContext', undefined);
    const bank = new SampleBank();
    await bank.render(48000, { thump: recipe(1) });
    expect(bank.ids).toEqual([]);
  });
});

describe('the drum recipes', () => {
  it('each build a graph without error', () => {
    for (const [id, drum] of Object.entries(DRUM_SAMPLES)) {
      const { ctx } = fakeAudioContext();
      expect(
        () => drum.build(ctx as unknown as OfflineAudioContext, seededRandom(1)),
        id,
      ).not.toThrow();
    }
  });

  it('give every kit a sound for every role', () => {
    for (const kit of Object.values(KITS)) {
      for (const id of Object.values(kit)) expect(DRUM_SAMPLES).toHaveProperty(id);
    }
  });
});

describe('Instruments.drum', () => {
  const setup = (rendered: string[]) => {
    const { ctx, calls } = fakeAudioContext();
    const graph = new MusicGraph(ctx);
    const bank = new SampleBank();
    vi.spyOn(bank, 'pick').mockImplementation((id) =>
      rendered.includes(id) ? buffer([0.5]) : null,
    );
    const pump = vi.spyOn(graph, 'pump');
    const play = new Instruments(graph, bank);
    const count = (method: string) => calls.filter((c) => c.method === method).length;
    return { play, graph, calls, pump, count };
  };

  it('plays the kit’s rendered sound on the drums stem, a kick making the music breathe', () => {
    const { play, graph, calls, pump, count } = setup(['kickPunch']);

    play.drum(KITS.synthwave, 'kick', 1, 0.7);
    expect(count('createBufferSource')).toBe(1);
    expect(count('createOscillator')).toBe(0);
    expect(calls.some((c) => c.method === 'connect' && c.args[0] === graph.drums)).toBe(true);
    expect(pump).toHaveBeenCalledWith(1, 0.7);
  });

  it('plays the live synth until the sound is rendered', () => {
    const { play, pump, count } = setup([]);

    play.drum(KITS.synthwave, 'kick', 1, 0.7);
    expect(count('createOscillator')).toBe(1);
    expect(pump).toHaveBeenCalledTimes(1); // the live kick breathes too
  });

  it('humanizes every hit a little, and plays a fill’s toms at their pitch', () => {
    const { play } = setup(['hat', 'tom']);
    const sample = vi.spyOn(play, 'sample');

    for (let i = 0; i < 20; i++) play.drum(KITS.synthwave, 'hat', 1, 0.1);
    const volumes = sample.mock.calls.map(([, , volume]) => volume);
    const rates = sample.mock.calls.map(([, , , rate]) => rate);
    expect(new Set(volumes).size).toBeGreaterThan(1);
    expect(Math.min(...volumes)).toBeGreaterThan(0.1 * 0.92);
    expect(Math.max(...volumes)).toBeLessThan(0.1 * 1.08);
    // Within ±35 cents
    expect(Math.min(...rates)).toBeGreaterThan(2 ** (-36 / 1200));
    expect(Math.max(...rates)).toBeLessThan(2 ** (36 / 1200));

    sample.mockClear();
    play.drum(KITS.synthwave, 'tom', 1, 0.35, 1.3);
    expect(sample.mock.calls[0][3]).toBeGreaterThan(1.25);
  });

  it('keeps metal silent until it is rendered: it has no live synth', () => {
    const { play, count } = setup([]);

    play.drum(KITS.dark, 'metal', 1, 0.2);
    expect(count('createOscillator') + count('createBufferSource')).toBe(0);
  });

  it('hits the drop with the kit’s impact, if it has one', () => {
    const { play, count } = setup(['impact']);

    play.impact(KITS.synthwave, 1, 0.8);
    expect(count('createBufferSource')).toBe(0);
    play.impact(KITS.dark, 1, 0.8);
    expect(count('createBufferSource')).toBe(1);
  });
});

describe('pitched instruments', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** A pitched recipe that records the frequencies it was asked to build at. */
  const pitched = (loop?: PitchedRecipe['loop']) => {
    const built: { frequency: number; detuned: number }[] = [];
    const recipe: PitchedRecipe = {
      roots: [40, 47, 54],
      duration: 1.3,
      loop,
      build: (ctx, _random, frequency, tune) => {
        built.push({ frequency, detuned: tune(frequency * 1.01) });
        (ctx as unknown as { drawn: number[] }).drawn = [0.5];
      },
    };
    return { recipe, built };
  };

  it('plays a note from its nearest root, at the speed that brings it to pitch', async () => {
    stubOfflineContext();
    const bank = new SampleBank();
    const { recipe } = pitched();
    await bank.renderPitched(48000, { keys: recipe });

    const note = bank.pickNote('keys', 49)!;
    expect(note.rate).toBeCloseTo(midiToFrequency(49) / midiToFrequency(47));
    expect(bank.pickNote('keys', 52)!.rate).toBeCloseTo(midiToFrequency(52) / midiToFrequency(54));
    expect(note.loop).toBeNull();
    expect(bank.pickNote('nothing', 49)).toBeNull();
  });

  it('tunes a looped sound to whole cycles of its loop, and corrects its pitch by speed', async () => {
    stubOfflineContext();
    const bank = new SampleBank();
    const { recipe, built } = pitched({ start: 0.25, length: 1 });
    await bank.renderPitched(48000, { keys: recipe });

    for (const { frequency, detuned } of built) {
      expect(Number.isInteger(frequency)).toBe(true);
      expect(Number.isInteger(detuned)).toBe(true);
    }
    // The root sounds at its whole-cycle frequency; played at speed it is exactly in tune
    const note = bank.pickNote('keys', 40)!;
    expect(note.rate * built[0].frequency).toBeCloseTo(midiToFrequency(40));
    expect(note.loop).toEqual({ start: 0.25, end: 1.25 });
  });

  it('covers each instrument’s range with roots a few semitones apart', () => {
    for (const [id, recipe] of Object.entries(PITCHED_SAMPLES)) {
      for (let i = 1; i < recipe.roots.length; i++) {
        expect(recipe.roots[i] - recipe.roots[i - 1], id).toBeLessThanOrEqual(7);
      }
      if ('loop' in recipe) {
        // Rendered a little past the loop, so the seam can be checked (e2e/samples.spec.ts)
        expect(recipe.duration, id).toBeGreaterThan(recipe.loop.start + recipe.loop.length);
      }
    }
  });

  it('each build a graph without error', () => {
    for (const [id, recipe] of Object.entries(PITCHED_SAMPLES)) {
      const { ctx } = fakeAudioContext();
      const build = () =>
        recipe.build(ctx as unknown as OfflineAudioContext, seededRandom(1), 110, (hz) => hz);
      expect(build, id).not.toThrow();
    }
  });
});

describe('Instruments with rendered notes', () => {
  const setup = (rendered: boolean) => {
    const { ctx, calls } = fakeAudioContext();
    const graph = new MusicGraph(ctx);
    const bank = new SampleBank();
    const pickNote = vi
      .spyOn(bank, 'pickNote')
      .mockImplementation(() =>
        rendered ? { buffer: buffer([0.5]), rate: 1, loop: { start: 0.25, end: 1.25 } } : null,
      );
    const play = new Instruments(graph, bank);
    const count = (method: string) => calls.filter((c) => c.method === method).length;
    return { play, graph, pickNote, count };
  };

  it('plays the song’s bass, arpeggio, lead, pad and stab from the rendered instruments', () => {
    const { play, graph, pickNote, count } = setup(true);

    play.bass('bassReese', 40, 0, 0.5, 0.2, graph.bass, 900);
    play.arp('arpPulse', 64, 0, 0.2, 0.05, graph.melody, 3000);
    play.lead('saw', 72, 0, 1, 0.08, graph.melody, 3000);
    play.pad([57, 60, 64], 0, 2, 0.03, 2000, true);
    play.stab([57, 60, 64], 0, 0.3, 0.05);

    expect(pickNote.mock.calls.map(([id]) => id)).toEqual([
      'bassReese',
      'arpPulse',
      'supersaw',
      'pad',
      'pad',
      'pad',
      'brass',
      'brass',
      'brass',
    ]);
    // Only the held lead's vibrato is an oscillator; everything else is a rendered note
    expect(count('createOscillator')).toBe(1);
    expect(count('createBufferSource')).toBe(9);
  });

  it('falls back to the live synths until the instruments are rendered', () => {
    const { play, graph, count } = setup(false);

    play.bass('bassFm', 40, 0, 0.5, 0.2, graph.bass, 900);
    play.lead('square', 72, 0, 0.3, 0.08, graph.melody, 3000);
    expect(count('createBufferSource')).toBe(0);
    expect(count('createOscillator')).toBe(2);
  });

  it('keeps the voices with no rendered instrument live', () => {
    const { play, graph, pickNote } = setup(true);

    play.bass('sawtooth', 40, 0, 0.5, 0.2, graph.bass, 900);
    play.arp('triangle', 64, 0, 0.2, 0.05, graph.melody, 3000);
    play.lead('bell', 72, 0, 0.3, 0.08, graph.melody, 3000);
    expect(pickNote).not.toHaveBeenCalled();
  });
});

describe('SampleBank render time', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stays as it was when asked again for what is already rendered', async () => {
    stubOfflineContext();
    const bank = new SampleBank();
    await bank.render(48000, { thump: recipe(1) });
    const took = bank.renderTime;
    await new Promise((resolve) => setTimeout(resolve, 5));
    await bank.render(48000, { thump: recipe(1) });
    expect(bank.renderTime).toBe(took);
  });
});
