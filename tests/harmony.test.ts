import { describe, expect, it } from 'vitest';
import { Harmony } from '@/audio/music/HarmonyTimeline';
import { BASS_LOW } from '@/audio/music/Arrangement';
import { SONGS } from '@/audio/music/songs';
import { MINOR_TRIAD, placeAbove } from '@/audio/music/theory';
import { getRallyNote, getWallNote, MELODY_MAX_NOTE } from '@/audio/sfx/harmony';

const A_MINOR: Harmony = { root: 33, chord: MINOR_TRIAD };
const pitchClass = (note: number) => ((note % 12) + 12) % 12;

describe('getRallyNote', () => {
  it('climbs the chord tones as the rally grows', () => {
    const notes = [1, 2, 3, 4, 5, 6].map((rally) => getRallyNote(A_MINOR, rally));

    // A minor: A C E, then the same an octave up
    expect(notes).toEqual([57, 60, 64, 69, 72, 76]);
  });

  it('stays on the top octave once the melody has climbed', () => {
    const top = getRallyNote(A_MINOR, 6);
    const later = Array.from({ length: 20 }, (_, i) => getRallyNote(A_MINOR, 7 + i));

    expect(Math.max(...later)).toBe(top);
  });

  it('only ever plays tones of the current chord', () => {
    const allowed = new Set(A_MINOR.chord.map((step) => pitchClass(A_MINOR.root + step)));

    for (let rally = 0; rally < 40; rally++) {
      expect(allowed.has(pitchClass(getRallyNote(A_MINOR, rally)))).toBe(true);
    }
  });

  it('never gets shrill on any chord of any song', () => {
    const chords = SONGS.flatMap((song) => song.sections.flatMap((section) => section.chords));
    for (const chord of chords) {
      const harmony = { root: placeAbove(chord.root, BASS_LOW), chord: chord.triad };
      for (let rally = 0; rally < 30; rally++) {
        expect(getRallyNote(harmony, rally)).toBeLessThanOrEqual(MELODY_MAX_NOTE);
      }
    }
  });

  it('falls back to a default key before the music starts', () => {
    expect(getRallyNote(null, 1)).toBe(getRallyNote(A_MINOR, 1));
  });
});

describe('getWallNote', () => {
  it('plays the chord fifth below the melody', () => {
    const wall = getWallNote(A_MINOR);

    expect(pitchClass(wall)).toBe(pitchClass(A_MINOR.root + 7));
    expect(wall).toBeLessThan(getRallyNote(A_MINOR, 1));
  });
});
