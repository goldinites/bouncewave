import { afterEach, describe, expect, it, vi } from 'vitest';
import { PitchedRecipe, SampleBank, SampleRecipe } from '@/audio/samples/SampleBank';

/** An offline context that renders a short click, counting the graphs built. */
const stubOfflineContext = () => {
  const built = { count: 0 };
  vi.stubGlobal(
    'OfflineAudioContext',
    class {
      public startRendering() {
        const data = Float32Array.from([0.5, -0.25, 0]);
        return Promise.resolve({
          length: data.length,
          numberOfChannels: 1,
          getChannelData: () => data,
        });
      }
    },
  );
  return built;
};

const recipe = (built: { count: number }): SampleRecipe => ({
  duration: 0.1,
  variants: 2,
  build: () => {
    built.count++;
  },
});

describe('SampleBank, sharing the main thread', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('builds no sound in the task that asks for them all, but each in a task of its own', async () => {
    const built = stubOfflineContext();
    const bank = new SampleBank();
    const rendering = bank.render(48000, { a: recipe(built), b: recipe(built), c: recipe(built) });
    // Nothing built yet: the frame that asked keeps its time
    expect(built.count).toBe(0);
    await rendering;
    expect(built.count).toBe(6);
    expect(bank.ids.sort()).toEqual(['a', 'b', 'c']);
  });

  it('renders what must come first, its pitched sounds too, then what is asked for later', async () => {
    const built = stubOfflineContext();
    const bank = new SampleBank();
    const tone: PitchedRecipe = { roots: [60, 67], duration: 0.1, build: () => built.count++ };
    const first = bank.renderFirst(48000, { hit: recipe(built) }, { tone });
    const later = bank.render(48000, { song: recipe(built) });
    // Within a moment, not waiting on one another: everything is rendered
    const settled = await Promise.race([
      Promise.all([first, later]).then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 200)),
    ]);
    expect(settled).toBe(true);
    expect(bank.ids.sort()).toEqual(['hit', 'song', 'tone']);
  });

  it('holds what is asked for later until what must come first is done', async () => {
    const built = stubOfflineContext();
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const bank = new SampleBank();
    const slow: SampleRecipe = { ...recipe(built), build: () => {} };
    vi.stubGlobal(
      'OfflineAudioContext',
      class {
        public startRendering() {
          const data = Float32Array.from([0.5]);
          const buffer = { length: 1, numberOfChannels: 1, getChannelData: () => data };
          return held.then(() => buffer);
        }
      },
    );
    const first = bank.renderFirst(48000, { hit: slow }, {});
    const rendering = bank.render(48000, { song: recipe(built) });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(built.count).toBe(0);
    expect(bank.pick('song')).toBeNull();

    release();
    await Promise.all([first, rendering]);
    expect(bank.pick('song')).not.toBeNull();
  });

  it('renders on even if what came first failed', async () => {
    const built = stubOfflineContext();
    const bank = new SampleBank();
    const broken: SampleRecipe = {
      ...recipe(built),
      build: () => {
        throw new Error('no actions');
      },
    };
    await bank.renderFirst(48000, { hit: broken }, {});
    await bank.render(48000, { song: recipe(built) });
    expect(bank.pick('song')).not.toBeNull();
  });
});
