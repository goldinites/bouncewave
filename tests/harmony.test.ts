import { describe, expect, it } from 'vitest';
import { Harmony } from '@/audio/music/HarmonyTimeline';
import { CHORD_TYPES, MUSIC_TRACKS } from '@/audio/music/tracks';
import { getRallyNote, getWallNote, MELODY_MAX_NOTE } from '@/audio/sfx/harmony';

const A_MINOR: Harmony = { root: 33, chord: CHORD_TYPES[0] };
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

  it('never gets shrill on any bar of any track', () => {
    for (const track of MUSIC_TRACKS) {
      track.rootNotes.forEach((root, bar) => {
        const harmony = { root, chord: CHORD_TYPES[track.chordTypes[bar]] };
        for (let rally = 0; rally < 30; rally++) {
          expect(getRallyNote(harmony, rally)).toBeLessThanOrEqual(MELODY_MAX_NOTE);
        }
      });
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
