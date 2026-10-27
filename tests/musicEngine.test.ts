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

  describe('at the end of a match', () => {
    it("plays a defeat's hook, stops the tape on it, and picks the music up on recover", () => {
      const { engine, notes, play } = track(setup());
      play(1);

      engine.playFinale('loss');
      play(1.2); // the hook's first bar, until the tape stops
      expect(engine.isPlayingFinale).toBe(true);
      const stopped = notes();
      play(2);
      expect(notes()).toBe(stopped);

      engine.recover();
      expect(engine.isPlayingFinale).toBe(false);
      play(1);
      expect(notes()).toBeGreaterThan(stopped);
    });

    it("lets a win's sting play out on the screen after the match, then goes on", () => {
      const { engine, notes, play } = track(setup());
      play(1);

      engine.playFinale('win');
      play(1);
      engine.recover(); // the finale ends while the sting still plays
      expect(engine.isPlayingFinale).toBe(true);
      play(15); // the longest sting, the slowest song: three bars and the ring-out
      expect(engine.isPlayingFinale).toBe(false);

      const after = notes();
      play(2);
      expect(notes()).toBeGreaterThan(after);
    });

    it('holds the music after a sting until the finale lets it go', () => {
      const { engine, notes, play } = track(setup());
      engine.playFinale('win');
      play(15);
      expect(engine.isPlayingFinale).toBe(true);
      const ringing = notes();
      play(2);
      expect(notes()).toBe(ringing);
    });

    it('gives a sting up at once when the next match starts', () => {
      const { engine, play } = track(setup());
      engine.playFinale('allPassed');
      play(1);
      engine.cutFinale();
      expect(engine.isPlayingFinale).toBe(false);
    });
  });

  describe('as a match starts', () => {
    it('brings the match’s song in when the picture does, off the bar grid, on its intro', () => {
      const { engine, play } = track(setup());
      engine.enterPlace('menu');
      play(4); // the menus' song
      engine.setState({ ...INITIAL_MUSIC_STATE, gameState: 'play', serveTime: 1.5 });
      engine.enterPlace(null);
      engine.enterScene('neonCity');
      engine.openMatch(0.68);
      // Shown at once; still the menus' song until the picture is in
      expect(engine.getSongTitle()).toBe('Kabukicho Rain');
      expect(engine.getPosition().songId).toBe('standby');
      // Its chord rings the chime: the city's F minor, not the menus' F lydian
      expect(engine.getUpcomingHarmony()?.chord).toEqual([0, 3, 7]);

      play(0.8);
      expect(engine.getPosition()).toMatchObject({ songId: 'kabukicho-rain', part: 'intro' });
    });

    it('keeps the intro until the ball is in play, then goes into the groove', () => {
      const { engine, play } = track(setup());
      engine.enterPlace('menu');
      play(4);
      engine.setState({ ...INITIAL_MUSIC_STATE, gameState: 'play', serveTime: 1.5 });
      engine.enterPlace(null);
      engine.enterScene('neonCity');
      engine.openMatch(0);
      play(8); // the serve holds on: the intro plays on past its phrase boundary
      expect(engine.getPosition().part).toBe('intro');

      engine.setState({ ...INITIAL_MUSIC_STATE, gameState: 'play', serveTime: 0 });
      play(4); // at most a phrase, two bars at 140
      expect(engine.getPosition().part).toBe('verse');
    });

    it('changes nothing when the song plays on into the match', () => {
      const { engine, play } = track(setup());
      play(2);
      const { songId } = engine.getPosition();
      engine.openMatch(0.68);
      play(1);
      expect(engine.getPosition().songId).toBe(songId);
    });
  });

  it("opens with the backdrop's own song when it has one", () => {
    const engine = new MusicEngine();
    engine.enterScene('lasers');
    expect(engine.getSongTitle()).toBe('Neon Cathedral');
  });

  it('switches to another song when skipped', () => {
    const { engine } = track(setup());
    const before = engine.getSongTitle();

    engine.skipSong();
    expect(engine.getSongTitle()).not.toBe(before);
    expect(SONGS.map((song) => song.title)).toContain(engine.getSongTitle());
  });

  describe('on the listening stand', () => {
    it('holds the music to a song and a part, named as in a link', () => {
      const { engine, play } = track(setup());

      expect(engine.audition('sunset-strip', 'chorus')).toBe(true);
      play(20);
      expect(engine.getPosition()).toMatchObject({ songId: 'sunset-strip', part: 'chorus' });
    });

    it('changes nothing for a song or part there is not', () => {
      const { engine } = track(setup());
      const before = engine.getPosition();

      expect(engine.audition('no-such-song')).toBe(false);
      expect(engine.audition('neon-cathedral', 'drop')).toBe(false);
      expect(engine.getPosition()).toEqual(before);
    });

    it('stays on the song when the backdrop changes or the player skips', () => {
      const { engine, play } = track(setup());
      engine.audition('neon-cathedral');
      engine.enterScene('fuji');
      engine.skipSong();
      play(30);

      expect(engine.getPosition().songId).toBe('neon-cathedral');
    });

    it('plays silenced layers no more', () => {
      const { engine, notes, play } = track(setup());
      engine.audition('neon-cathedral', 'chorus');
      play(1);
      for (const layer of ['drums', 'bass', 'pads', 'arp', 'lead', 'counter', 'fx'] as const) {
        engine.setLayerMuted(layer, true);
      }
      play(0.3); // what was scheduled ahead plays out
      const before = notes();

      play(3);
      expect(notes()).toBe(before);
    });
  });
});

describe('SONGS', () => {
  it('have ids for links, from their titles, each its own', () => {
    const ids = SONGS.map((song) => song.id);
    expect(ids).toContain('neon-cathedral');
    expect(ids.every((id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
