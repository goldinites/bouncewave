import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '@/audio/AudioEngine';
import { fakeAudioContext } from './helpers/fakeAudioContext';

/** Installs a fake AudioContext class; `created` counts the contexts made with it. */
const stubAudioContext = (state: string) => {
  const { ctx, calls } = fakeAudioContext(0);
  (ctx as unknown as { state: string }).state = state;
  let created = 0;
  vi.stubGlobal(
    'AudioContext',
    class {
      constructor() {
        created++;
        return ctx;
      }
    },
  );
  const count = (method: string) => calls.filter((c) => c.method === method).length;
  return { ctx, calls, count, created: () => created };
};

describe('AudioEngine', () => {
  const engines: AudioEngine[] = [];
  const makeEngine = () => {
    const engine = new AudioEngine(
      () => false,
      () => true,
    );
    engines.push(engine);
    return engine;
  };

  afterEach(() => {
    engines.splice(0).forEach((engine) => engine.dispose());
    vi.unstubAllGlobals();
  });

  it("sets the player's volumes on the mixer's buses, once it exists, and only when they change", () => {
    const { calls } = stubAudioContext('running');
    const engine = makeEngine();
    engine.setVolumes(0, 50); // before the first gesture: kept for the mixer
    engine.unlock();
    const targets = () => calls.filter((c) => c.method === 'setTargetAtTime').map((c) => c.args[0]);

    // The music silent, the action and menu sounds five steps down
    const half = 10 ** (-15 / 20);
    expect(targets()).toContain(0);
    expect(targets().filter((level) => Math.abs((level as number) - half) < 1e-9)).toHaveLength(2);

    const before = targets().length;
    engine.setVolumes(0, 50);
    expect(targets()).toHaveLength(before);
  });

  it('creates the audio context on the first gesture, and only once', () => {
    const { created } = stubAudioContext('running');
    const engine = makeEngine();
    expect(created()).toBe(0);

    engine.unlock();
    engine.unlock();
    expect(created()).toBe(1);
  });

  // iOS starts a home-screen app's context 'interrupted', not 'suspended'
  it.each(['suspended', 'interrupted'])(
    'resumes a %s context and starts a silent sound to wake it up',
    (state) => {
      const { count } = stubAudioContext(state);
      makeEngine().unlock();

      expect(count('resume')).toBe(1);
      expect(count('createBufferSource')).toBe(1);
    },
  );

  it('leaves a running context alone', () => {
    const { count } = stubAudioContext('running');
    makeEngine().unlock();

    expect(count('resume')).toBe(0);
    expect(count('createBufferSource')).toBe(0);
  });

  it('silences everything while the page is hidden', () => {
    const { count } = stubAudioContext('running');
    makeEngine().unlock();
    const setHidden = (hidden: boolean) => {
      Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    };

    setHidden(true);
    expect(count('suspend')).toBe(1);
    setHidden(false);
    expect(count('resume')).toBe(1);
  });

  it('survives a browser without Web Audio', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => makeEngine().unlock()).not.toThrow();
  });

  it('closes the context when disposed', () => {
    const { count } = stubAudioContext('running');
    const engine = makeEngine();
    engine.unlock();

    engine.dispose();
    expect(count('close')).toBe(1);
  });
});
