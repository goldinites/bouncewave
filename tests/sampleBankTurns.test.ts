import { afterEach, describe, expect, it, vi } from 'vitest';
import { SampleBank, SampleRecipe } from '@/audio/samples/SampleBank';

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

  it('holds what is asked for later until what must come first is done', async () => {
    const built = stubOfflineContext();
    const bank = new SampleBank();
    let release!: () => void;
    bank.holdUntil(new Promise<void>((resolve) => (release = resolve)));
    const rendering = bank.render(48000, { song: recipe(built) });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(built.count).toBe(0);
    expect(bank.pick('song')).toBeNull();

    release();
    await rendering;
    expect(bank.pick('song')).not.toBeNull();
  });

  it('renders on even if what came first failed', async () => {
    const built = stubOfflineContext();
    const bank = new SampleBank();
    bank.holdUntil(Promise.reject(new Error('no actions')));
    await bank.render(48000, { song: recipe(built) });
    expect(bank.pick('song')).not.toBeNull();
  });
});
