import { Harmony } from '@/audio/music/HarmonyTimeline';
import { MINOR_TRIAD } from '@/audio/music/theory';
// Paddle and wall sounds are drawn from the chord the music is playing
// (chord roots sit at MIDI 28–39, so offsets lift them into melody / mid registers)
const DEFAULT_HARMONY: Harmony = { root: 33, chord: MINOR_TRIAD }; // A minor, before music starts
// The rally's notes keep to one octave, E4 up to D#5 (the user, 24.10.2026: hits two and a half
// octaves apart sounded like different sounds)
export const MELODY_LOW = 64;
const WALL_NOTE_OCTAVE_OFFSET = 12;

/**
 * Note for the n-th hit of a rally: walks up the current chord's tones within one octave from
 * `MELODY_LOW`, then starts again from the lowest, so a rally steps through the chord the music
 * is on while every hit stays the same sound.
 */
export function getRallyNote(harmony: Harmony | null, rally: number): number {
  const { root, chord } = harmony ?? DEFAULT_HARMONY;
  const tones = chord
    .map((step) => MELODY_LOW + ((((root + step - MELODY_LOW) % 12) + 12) % 12))
    .sort((a, b) => a - b);
  return tones[Math.max(0, rally - 1) % tones.length];
}

/** Wall bounces sit on the chord's fifth, low and soft, under the melody. */
export function getWallNote(harmony: Harmony | null): number {
  const { root, chord } = harmony ?? DEFAULT_HARMONY;
  return root + WALL_NOTE_OCTAVE_OFFSET + chord[chord.length - 1];
}
