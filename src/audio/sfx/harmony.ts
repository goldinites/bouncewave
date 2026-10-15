import {
  DEFAULT_HARMONY,
  MELODY_MAX_NOTE,
  MELODY_OCTAVE_OFFSET,
  MELODY_OCTAVES,
  WALL_NOTE_OCTAVE_OFFSET,
} from '@/constants/audio.constants';
import { Harmony } from '@/types/audio.types';

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
