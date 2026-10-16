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
  return { ctx, count, created: () => created };
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
