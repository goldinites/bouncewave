import { Harmony } from '@/audio/music/HarmonyTimeline';
import { MINOR_TRIAD } from '@/audio/music/theory';
// Paddle and wall sounds are drawn from the chord the music is playing
// (chord roots sit at MIDI 28–39, so offsets lift them into melody / mid registers)
const DEFAULT_HARMONY: Harmony = { root: 33, chord: MINOR_TRIAD }; // A minor, before music starts
const MELODY_OCTAVE_OFFSET = 24;
const MELODY_OCTAVES = 2; // the rally melody climbs this many octaves, then stays on top
export const MELODY_MAX_NOTE = 84; // C6; higher notes fold down an octave
const WALL_NOTE_OCTAVE_OFFSET = 12;

/**
 * Note for the n-th hit of a rally: walks up the current chord's tones
 * (root, third, fifth, then the next octave), so a long rally climbs as a melody.
 * Past the top it keeps cycling through the highest octave.
 */
export function getRallyNote(harmony: Harmony | null, rally: number): number {
  const { root, chord } = harmony ?? DEFAULT_HARMONY;
  const index = Math.max(0, rally - 1);

  const octave = Math.min(Math.floor(index / chord.length), MELODY_OCTAVES - 1);
  let note = root + MELODY_OCTAVE_OFFSET + chord[index % chord.length] + 12 * octave;

  // Bass roots vary per bar; fold anything too shrill back down an octave
  while (note > MELODY_MAX_NOTE) {
    note -= 12;
  }
  return note;
}

/** Wall bounces sit on the chord's fifth, low and soft, under the melody. */
export function getWallNote(harmony: Harmony | null): number {
  const { root, chord } = harmony ?? DEFAULT_HARMONY;
  return root + WALL_NOTE_OCTAVE_OFFSET + chord[chord.length - 1];
}
