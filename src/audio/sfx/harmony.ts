import { Harmony } from '@/audio/music/HarmonyTimeline';
import { MINOR_TRIAD } from '@/audio/music/theory';
// Paddle and wall sounds are drawn from the chord the music is playing
// (chord roots sit at MIDI 28–39, so offsets lift them into melody / mid registers)
const DEFAULT_HARMONY: Harmony = { root: 33, chord: MINOR_TRIAD }; // A minor, before music starts
// The layered sounds' notes (the Overdrive, its chime) keep to one octave, E4 up to D#5, where
// their bodies are rendered and every one sounds alike
export const MELODY_LOW = 64;
const WALL_NOTE_OCTAVE_OFFSET = 12;

/**
 * Note for the n-th step of a rally within one octave from `MELODY_LOW`: up the current chord's
 * tones, then again from the lowest — for the layered sounds, which change if pitched further.
 */
export function getRallyNote(harmony: Harmony | null, rally: number): number {
  const { root, chord } = harmony ?? DEFAULT_HARMONY;
  const tones = chord
    .map((step) => MELODY_LOW + ((((root + step - MELODY_LOW) % 12) + 12) % 12))
    .sort((a, b) => a - b);
  return tones[Math.max(0, rally - 1) % tones.length];
}

// The paddle hits climb two octaves of the chord from two octaves over its root, as the old beeps
// did (the user, 24.10.2026), the top folded under C6
const CLIMB = { OFFSET: 24, OCTAVES: 2, MAX_NOTE: 84 } as const;

/**
 * Note for the n-th paddle hit of a rally: up the chord's tones (root, third, fifth, then the next
 * octave), so a long rally climbs as a melody, cycling through the top octave once there.
 */
export function getClimbingRallyNote(harmony: Harmony | null, rally: number): number {
  const { root, chord } = harmony ?? DEFAULT_HARMONY;
  const index = Math.max(0, rally - 1);
  const octave = Math.min(Math.floor(index / chord.length), CLIMB.OCTAVES - 1);
  let note = root + CLIMB.OFFSET + chord[index % chord.length] + 12 * octave;
  while (note > CLIMB.MAX_NOTE) note -= 12;
  return note;
}

/** Wall bounces sit on the chord's fifth, low and soft, under the melody. */
export function getWallNote(harmony: Harmony | null): number {
  const { root, chord } = harmony ?? DEFAULT_HARMONY;
  return root + WALL_NOTE_OCTAVE_OFFSET + chord[chord.length - 1];
}
