import { afterEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_MUSIC_STATE } from '@/audio/music/intensity';
import { MusicEngine } from '@/audio/music/MusicEngine';
import { SONGS } from '@/audio/music/songs';
import { fakeAudioContext } from './helpers/fakeAudioContext';

const setup = ({ muted = false, state = 'running' } = {}) => {
  vi.useFakeTimers();
  const { ctx, calls } = fakeAudioContext(0);
  (ctx as unknown as { state: string }).state = state;

  const engine = new MusicEngine();
  engine.init(ctx);
  engine.setState({ ...INITIAL_MUSIC_STATE, isMuted: muted });

  const notes = () => calls.filter((c) => c.method === 'createOscillator').length;
  /** Lets the audio clock run for `seconds`, the scheduler waking as it would. */
  const play = (seconds: number) => {
    for (let t = 0; t < seconds; t += 0.025) {
      ctx.currentTime += 0.025;
      vi.advanceTimersByTime(25);
    }
  };
  return { engine, notes, play };
};

describe('MusicEngine', () => {
  const engines: MusicEngine[] = [];
  const track = <T extends { engine: MusicEngine }>(result: T) => {
    engines.push(result.engine);
    return result;
  };

  afterEach(() => {
    engines.splice(0).forEach((engine) => engine.dispose());
    vi.useRealTimers();
  });

  it('plays once the audio context is running', () => {
    const { notes, play } = track(setup());
    const atStart = notes();

    play(2);
    expect(notes()).toBeGreaterThan(atStart);
  });

  it('waits while the context is suspended', () => {
    const { notes, play } = track(setup({ state: 'suspended' }));
    const atStart = notes();

    play(2);
    expect(notes()).toBe(atStart);
  });

  it('keeps time while muted, so hits stay in tune, but plays no notes', () => {
    const { engine, notes, play } = track(setup({ muted: true }));
    const atStart = notes();

    play(2);
    expect(notes()).toBe(atStart);
    expect(engine.getHarmony()).not.toBeNull();
  });

  it('stops the sequencer during a tape stop and picks it up again on recover', () => {
    const { engine, notes, play } = track(setup());
    play(1);

    engine.tapeStop();
    const stopped = notes();
    play(2);
    expect(notes()).toBe(stopped);

    engine.recover();
    play(1);
    expect(notes()).toBeGreaterThan(stopped);
  });

  it("opens with the backdrop's own song when it has one", () => {
    const engine = new MusicEngine();
    engine.enterScene('neonCity');
    expect(engine.getSongTitle()).toBe('Shinjuku Rain');
  });

  it('switches to another song when skipped', () => {
    const { engine } = track(setup());
    const before = engine.getSongTitle();

    engine.skipSong();
    expect(engine.getSongTitle()).not.toBe(before);
    expect(SONGS.map((song) => song.title)).toContain(engine.getSongTitle());
  });
});
