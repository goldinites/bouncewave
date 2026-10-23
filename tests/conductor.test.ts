import { describe, expect, it } from 'vitest';
import { Conductor, PEAK_COOLDOWN_BARS, SONG_BARS, WHOLE_FORM } from '@/audio/music/Conductor';
import { compileSong, SongDef, Tier } from '@/audio/music/score';

const section = (name: string, tier: Tier, bars: number) => ({
  name,
  tier,
  chords: Array(bars).fill('Am').join(' | '),
  bass: 'long' as const,
  drums: 'four' as const,
  pad: 'hold' as const,
});

const def = (title: string): SongDef => ({
  title,
  bpm: 100,
  swing: 0,
  voices: { lead: 'saw', counter: 'bell', arp: 'square', bass: 'sawtooth' },
  sections: [
    section('intro', 'calm', 4),
    section('verse', 'groove', 8),
    section('build', 'rise', 2),
    section('chorus', 'high', 8),
    section('breakdown', 'calm', 4),
  ],
});

const SONGS = [compileSong(def('One')), compileSong(def('Two'))];
const THREE = [...SONGS, compileSong(def('Three'))];
// Two shared songs, then the city's and the lasers' own (quick match), and the warehouse's
// (a challenge)
const WITH_SCENES = [
  ...SONGS,
  compileSong({ ...def('City'), scene: 'neonCity' }),
  compileSong({ ...def('Lasers'), scene: 'lasers' }),
  compileSong({ ...def('Floor'), scene: 'warehouse' }),
];

/** Plays `bars` bars wanting `tier`; returns the section name of every bar played. */
const play = (conductor: Conductor, tier: Tier, bars: number): string[] =>
  Array.from({ length: bars }, () => {
    const name = conductor.section.name;
    conductor.plan(tier);
    conductor.advance();
    return name;
  });

describe('Conductor', () => {
  it('starts calm and takes turns between the calm sections', () => {
    const conductor = new Conductor(SONGS, 0);
    expect(play(conductor, 'calm', 8)).toEqual([
      ...Array(4).fill('intro'),
      ...Array(4).fill('breakdown'),
    ]);
  });

  it('leaves early only on a phrase boundary', () => {
    const conductor = new Conductor(SONGS, 0);
    play(conductor, 'calm', 1);
    expect(play(conductor, 'groove', 3)).toEqual(['intro', 'verse', 'verse']);
  });

  it('builds up to the chorus on a hot rally and lets the build finish', () => {
    const conductor = new Conductor(SONGS, 0, 'groove');
    expect(play(conductor, 'high', 5)).toEqual(['intro', 'intro', 'build', 'build', 'chorus']);
  });

  it('holds the chorus for a while even if the rally cools at once, then goes on with the form', () => {
    const conductor = new Conductor(SONGS, 0, 'high');
    expect(play(conductor, 'groove', 5)).toEqual([...Array(4).fill('chorus'), 'breakdown']);
  });

  it('flags the last bar before a new section, for the fill', () => {
    const conductor = new Conductor(SONGS, 0, 'groove');
    const fills = Array.from({ length: 8 }, () => {
      conductor.plan('groove');
      const isLast = conductor.isLastBar;
      conductor.advance();
      return isLast;
    });
    // The song starts at its start: four bars of intro, then the verse
    expect(fills).toEqual([false, false, false, true, false, false, false, false]);
  });

  it('moves on to the next song after a while, never mid-chorus', () => {
    const conductor = new Conductor(SONGS, 0, 'high');
    play(conductor, 'high', SONG_BARS + 8);
    expect(conductor.song.title).toBe('One');

    play(conductor, 'groove', 16);
    expect(conductor.song.title).toBe('Two');
  });

  it('switches songs at the next phrase boundary on request', () => {
    const conductor = new Conductor(SONGS, 0, 'groove');
    conductor.requestNewSong();
    play(conductor, 'calm', 2);
    expect(conductor.song.title).toBe('Two');
    expect(conductor.section.tier).toBe('calm');
  });

  it('skips to another song at the very next bar line, even mid-chorus', () => {
    const conductor = new Conductor(SONGS, 0, 'high');
    play(conductor, 'high', 1);

    conductor.skip('high');
    expect(conductor.upcomingSong.title).toBe('Two'); // shown at once
    expect(conductor.isLastBar).toBe(true); // a fill leads into it

    conductor.plan('high'); // the regular mid-bar plan doesn't undo the skip
    conductor.advance();
    expect(conductor.song.title).toBe('Two');
    expect(conductor.section.name).toBe('chorus');
  });

  it('picks the next song at random, never the one playing', () => {
    const picks = [0, 0.99].map((roll) => {
      const conductor = new Conductor(THREE, 0, 'groove', () => roll);
      conductor.skip('groove');
      conductor.advance();
      return conductor.song.title;
    });
    expect(picks).toEqual(['Two', 'Three']);
  });

  it('never skips back to the song a skip is already heading for', () => {
    const conductor = new Conductor(THREE, 0, 'groove', () => 0);
    conductor.skip('groove');
    conductor.skip('groove');
    expect(conductor.upcomingSong.title).toBe('Three');
  });

  describe('with songs that belong to a backdrop', () => {
    it("plays the backdrop's own song first, at the next phrase boundary", () => {
      const conductor = new Conductor(WITH_SCENES, 0, 'groove');
      expect(conductor.enterScene('neonCity')).toBe(true);
      play(conductor, 'calm', 2);
      expect(conductor.song.title).toBe('City');
    });

    it('keeps the backdrop’s own song if it is already playing', () => {
      const conductor = new Conductor(WITH_SCENES, 2, 'groove');
      expect(conductor.enterScene('neonCity')).toBe(false);
      play(conductor, 'calm', 4);
      expect(conductor.song.title).toBe('City');
    });

    it('lets another quick-match backdrop’s song follow, at random or on a skip', () => {
      const titles = new Set<string>();
      for (const roll of [0, 0.3, 0.6, 0.99]) {
        const conductor = new Conductor(WITH_SCENES, 2, 'groove', () => roll);
        conductor.enterScene('outrun');
        play(conductor, 'calm', 2);
        titles.add(conductor.song.title);
        conductor.skip('groove');
        conductor.advance();
        titles.add(conductor.song.title);
      }
      // The shared songs and the other quick-match backdrops' own, never a challenge's
      expect(titles).toEqual(new Set(['One', 'Two', 'City', 'Lasers']));
    });

    it('moves on from the backdrop’s own song to the other quick-match songs', () => {
      const titles = new Set<string>();
      for (const roll of [0, 0.5, 0.99]) {
        const conductor = new Conductor(WITH_SCENES, 0, 'groove', () => roll);
        conductor.enterScene('neonCity');
        conductor.skip('groove'); // takes the music to the city's own song
        conductor.advance();
        conductor.skip('groove');
        conductor.advance();
        titles.add(conductor.song.title);
      }
      expect(titles).toEqual(new Set(['One', 'Two', 'Lasers']));
    });

    it('keeps a challenge’s backdrop on its own song', () => {
      for (const roll of [0, 0.5, 0.99]) {
        const conductor = new Conductor(WITH_SCENES, 0, 'groove', () => roll);
        conductor.enterScene('warehouse');
        conductor.skip('groove'); // to the warehouse's own song
        conductor.advance();
        expect(conductor.song.title).toBe('Floor');
        conductor.skip('groove');
        conductor.advance();
        expect(conductor.song.title).toBe('Floor');
      }
    });
  });

  describe('on the listening stand', () => {
    it('loops the pinned part from the next bar line, whatever the game wants', () => {
      const conductor = new Conductor(SONGS, 0);
      conductor.plan('calm');
      conductor.pinTo(1, 3);
      conductor.advance();

      expect(conductor.song.title).toBe('Two');
      expect(play(conductor, 'calm', 20)).toEqual(Array(20).fill('chorus'));
    });

    it('fills into the pinned part each time it loops', () => {
      const conductor = new Conductor(SONGS, 0);
      conductor.pinTo(0, 2); // the 2-bar build
      conductor.advance();

      const lastBars = Array.from({ length: 4 }, () => {
        conductor.plan('groove');
        const isLast = conductor.isLastBar;
        conductor.advance();
        return isLast;
      });
      expect(lastBars).toEqual([false, true, false, true]);
    });

    it('keeps the pinned song with any part, never moving on to another', () => {
      const conductor = new Conductor(SONGS, 0);
      conductor.pinTo(1);
      conductor.advance();
      conductor.requestNewSong();
      conductor.enterScene('fuji');

      play(conductor, 'calm', SONG_BARS * 2);
      expect(conductor.song.title).toBe('Two');
      // ...but still follows the game from section to section
      expect(play(conductor, 'groove', 4)).toContain('verse');
    });

    it('plays the whole form in order from the start, peaks and all, whatever the heat', () => {
      const conductor = new Conductor(SONGS, 0);
      play(conductor, 'groove', 3);
      // From the start of its form, though another song was mid-way through its intro
      conductor.pinTo(1, WHOLE_FORM);
      conductor.advance();

      expect(conductor.song.title).toBe('Two');
      expect(play(conductor, 'calm', 30)).toEqual([
        ...Array(4).fill('intro'),
        ...Array(8).fill('verse'),
        ...Array(2).fill('build'),
        ...Array(8).fill('chorus'),
        ...Array(4).fill('breakdown'),
        // Round again, never to another song
        ...Array(4).fill('intro'),
      ]);
    });

    it('replays the way in: the end of the section before, then the pinned part', () => {
      const conductor = new Conductor(SONGS, 0);
      conductor.pinTo(0, 1); // the 8-bar verse, after the 4-bar intro
      conductor.advance();
      play(conductor, 'groove', 3);

      conductor.replayTransition();
      expect(play(conductor, 'groove', 6)).toEqual(['verse', ...Array(4).fill('intro'), 'verse']);

      // A longer section before: only its last four bars
      conductor.pinTo(0, 2); // the build, after the 8-bar verse
      conductor.advance();
      conductor.replayTransition();
      play(conductor, 'groove', 1);
      expect(conductor.section.name).toBe('verse');
      expect(conductor.bar).toBe(4);
    });

    it('lets the game lead again, back to the backdrop’s own song', () => {
      const conductor = new Conductor(WITH_SCENES, 0);
      conductor.enterScene('neonCity');
      conductor.pinTo(1, 0);
      conductor.advance();
      play(conductor, 'calm', 4);
      expect(conductor.song.title).toBe('Two');

      conductor.pinTo(null);
      play(conductor, 'calm', 8);
      expect(conductor.song.title).toBe('City');
    });
  });

  describe('walking the form', () => {
    const formSong = (form: string[]) => compileSong({ ...def('Form'), form });

    it('plays the form in order, passing its peaks by while the match is not hot', () => {
      const conductor = new Conductor(SONGS, 0, 'groove');
      expect(play(conductor, 'groove', 16)).toEqual([
        ...Array(4).fill('intro'),
        ...Array(8).fill('verse'),
        ...Array(4).fill('breakdown'),
      ]);
    });

    it('follows a written form, parts coming more than once', () => {
      const song = formSong(['intro', 'verse', 'breakdown', 'verse']);
      const conductor = new Conductor([song], 0, 'groove');
      const parts = play(conductor, 'groove', 24).filter((name, i, all) => name !== all[i - 1]);
      expect(parts).toEqual(['intro', 'verse', 'breakdown', 'verse']);
    });

    it('rejects a form naming a section the song doesn’t have', () => {
      expect(() => formSong(['intro', 'bridge'])).toThrow(/bridge/);
    });

    it('comes back to the part it left after a peak it jumped to', () => {
      const conductor = new Conductor(SONGS, 0, 'groove');
      play(conductor, 'groove', 6); // into the verse
      expect(conductor.section.name).toBe('verse');

      const heard = [...play(conductor, 'high', 4), ...play(conductor, 'groove', 6)];
      expect(heard).toEqual([
        'verse',
        'verse',
        'build',
        'build',
        ...Array(4).fill('chorus'),
        'verse',
        'verse',
      ]);
    });

    it('rests the peaks for a while after one, however hot the rallies', () => {
      const conductor = new Conductor(SONGS, 0, 'groove');
      play(conductor, 'high', 12); // intro, build, chorus and out
      const after = play(conductor, 'high', PEAK_COOLDOWN_BARS - 2);
      expect(after.some((name) => name === 'build' || name === 'chorus')).toBe(false);
      expect(play(conductor, 'high', 10)).toContain('chorus');
    });

    it('plays only the calm parts in the menus', () => {
      const conductor = new Conductor(SONGS, 0);
      const parts = new Set(play(conductor, 'calm', 40));
      expect(parts).toEqual(new Set(['intro', 'breakdown']));
    });

    it('leaves a menu’s calm part soon once play starts', () => {
      const conductor = new Conductor(SONGS, 0);
      play(conductor, 'calm', 4); // into the breakdown, for the menu
      expect(play(conductor, 'groove', 3)).toEqual(['breakdown', 'breakdown', 'intro']);
    });

    it('moves on to another song only when its form comes round, after a while', () => {
      const conductor = new Conductor(SONGS, 0, 'groove');
      // One time round the form in play is 16 bars: it plays again until SONG_BARS
      play(conductor, 'groove', SONG_BARS - 1);
      expect(conductor.song.title).toBe('One');
      play(conductor, 'groove', 17);
      expect(conductor.song.title).toBe('Two');
      expect(conductor.section.name).toBe('intro');
    });

    it('tells where in its form the song is', () => {
      const conductor = new Conductor(SONGS, 0, 'groove');
      play(conductor, 'groove', 5);
      expect(conductor.formStep).toEqual({ step: 1, steps: 5 });
    });
  });
});
