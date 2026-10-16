import { describe, expect, it } from 'vitest';
import { Conductor, SONG_BARS } from '@/audio/music/Conductor';
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

  it('builds up to the chorus and lets the build finish', () => {
    const conductor = new Conductor(SONGS, 0, 'groove');
    expect(play(conductor, 'high', 5)).toEqual(['verse', 'verse', 'build', 'build', 'chorus']);
  });

  it('holds the chorus for a while even if the rally cools at once', () => {
    const conductor = new Conductor(SONGS, 0, 'high');
    expect(play(conductor, 'groove', 5)).toEqual([...Array(4).fill('chorus'), 'verse']);
  });

  it('flags the last bar before a new section, for the fill', () => {
    const conductor = new Conductor(SONGS, 0, 'groove');
    const fills = Array.from({ length: 8 }, () => {
      conductor.plan('groove');
      const isLast = conductor.isLastBar;
      conductor.advance();
      return isLast;
    });
    expect(fills).toEqual([false, false, false, false, false, false, false, true]);
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
});
