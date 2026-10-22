import { Feel, STEPS_PER_BAR } from '@/audio/music/score';
import { seededRandom } from '@/shared/random';

/**
 * How a part plays differently each time it comes back (5.5b): the first pass as written, then
 * ghost notes, fills at the end of phrases, bass jumping an octave, the arpeggio shifted — more
 * of it with every pass. Seeded by the song, the part, the pass and the bar, so a repeat is
 * never the same as the one before, yet the same bar of the same pass always sounds alike.
 */
export interface BarVariation {
  /** Steps where a quiet ghost snare fills an empty step. */
  ghostSnares: ReadonlySet<number>;
  /** Steps where the bass's root jumps up an octave. */
  bassOctaves: ReadonlySet<number>;
  /** Steps the arpeggio's pattern is read ahead by. */
  arpShift: number;
  /** Whether this bar ends its phrase with a short snare fill. */
  phraseFill: boolean;
}

// How much each pass varies: the first as written, the second lightly, the third on more
const VARIATION = {
  GHOST_SNARE: [0, 0.1, 0.18], // chance per empty off-beat step
  BASS_OCTAVE: [0, 0.12, 0.22], // chance per root
  ARP_SHIFT: [0, 2, 4], // steps, on every second bar
  PHRASE_BARS: 4, // a phrase fill ends every this many bars
} as const;

const NO_VARIATION: BarVariation = {
  ghostSnares: new Set(),
  bassOctaves: new Set(),
  arpShift: 0,
  phraseFill: false,
};

/** A string's hash, for the seed. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** What changes in `bar` of a part on its `pass` (0 the first time it plays). */
export function barVariation(
  songId: string,
  part: string,
  pass: number,
  bar: number,
): BarVariation {
  if (pass <= 0) return NO_VARIATION;
  const level = Math.min(pass, VARIATION.GHOST_SNARE.length - 1);
  const random = seededRandom(hash(`${songId}:${part}:${pass}:${bar}`));
  const pick = (chance: number, steps: (s: number) => boolean) =>
    new Set(
      Array.from({ length: STEPS_PER_BAR }, (_, s) => s).filter(
        (s) => steps(s) && random() < chance,
      ),
    );
  return {
    ghostSnares: pick(VARIATION.GHOST_SNARE[level], (s) => s % 2 === 1),
    bassOctaves: pick(VARIATION.BASS_OCTAVE[level], () => true),
    arpShift: bar % 2 === 1 ? VARIATION.ARP_SHIFT[level] : 0,
    phraseFill: bar % VARIATION.PHRASE_BARS === VARIATION.PHRASE_BARS - 1,
  };
}

/**
 * Which step of a one-bar drum pattern sounds on step `s` of `bar`, for the drums that carry
 * the feel (kick, snare, clap, taiko, metal); the hats keep the written time, which is what
 * makes half-time feel slow and heavy rather than just slow. Null when nothing sounds there.
 */
export function feelStep(feel: Feel | undefined, s: number, bar: number): number | null {
  switch (feel) {
    case 'half':
      return s % 2 === 0 ? (bar % 2) * (STEPS_PER_BAR / 2) + s / 2 : null;
    case 'double':
      return (s * 2) % STEPS_PER_BAR;
    default:
      return s;
  }
}
