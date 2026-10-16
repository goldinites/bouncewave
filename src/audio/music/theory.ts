/** Semitones above C of each natural note name. */
const NATURALS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTALS: Record<string, number> = { '': 0, '#': 1, b: -1 };

/**
 * Chord qualities by the suffix written after the root ("Am9" → "m9"), as intervals above the
 * root. Every one starts root, third (or suspension), fifth, so its first three are the triad.
 */
const CHORD_QUALITIES: Record<string, readonly number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '6': [0, 4, 7, 9],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '7sus4': [0, 5, 7, 10],
};

export const MINOR_TRIAD: readonly number[] = CHORD_QUALITIES.m;

export interface Chord {
  symbol: string;
  /** Pitch class of the root, 0 = C. */
  root: number;
  /** Every chord tone as semitones above the root, extensions included. */
  intervals: readonly number[];
  /** Root, third (or suspension) and fifth only. */
  triad: readonly number[];
}

// Pad voicings stay inside this range (E3–C5), close to the middle of it
const VOICING_LOW = 52;
const VOICING_HIGH = 72;
const VOICING_CENTER = 62;
const VOICING_SIZE = 4;

const pitchClass = (note: number) => ((note % 12) + 12) % 12;

/** MIDI note number of a name such as "A4", "C#5" or "Bb3" (A4 = 69). */
export function parseNote(name: string): number {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!match) throw new Error(`Not a note: "${name}"`);
  const [, letter, accidental, octave] = match;
  return (Number(octave) + 1) * 12 + NATURALS[letter] + ACCIDENTALS[accidental];
}

/** A chord from its symbol, such as "Am9", "Fmaj7", "Esus4" or "Bb". */
export function parseChord(symbol: string): Chord {
  const match = /^([A-G])([#b]?)(.*)$/.exec(symbol);
  const intervals = match && CHORD_QUALITIES[match[3]];
  if (!match || !intervals) throw new Error(`Not a chord: "${symbol}"`);

  const root = pitchClass(NATURALS[match[1]] + ACCIDENTALS[match[2]]);
  return { symbol, root, intervals, triad: intervals.slice(0, 3) };
}

/** The lowest note at or above `low` with the given pitch class. */
export function placeAbove(pitch: number, low: number): number {
  return low + pitchClass(pitch - low);
}

/** Whether `note` is one of the chord's tones, extensions included, in any octave. */
export function isChordTone(chord: Chord, note: number): boolean {
  return chord.intervals.some((interval) => pitchClass(chord.root + interval) === pitchClass(note));
}

/**
 * Up to four notes of the chord for the pad, moving as little as possible from the previous
 * voicing so chord changes glide instead of jumping. Five-note chords drop their fifth.
 */
export function voiceChord(chord: Chord, previous: readonly number[] | null): number[] {
  let intervals = chord.intervals;
  if (intervals.length > VOICING_SIZE) intervals = intervals.filter((i) => i !== 7);
  const pitches = [...new Set(intervals.map((i) => pitchClass(chord.root + i)))].sort(
    (a, b) => a - b,
  );

  let best: number[] = [];
  let bestCost = Infinity;
  // Every inversion, starting from every bottom note the range allows
  for (let bottom = VOICING_LOW; bottom < VOICING_LOW + 12; bottom++) {
    if (!pitches.includes(pitchClass(bottom))) continue;
    const voicing = [bottom];
    while (voicing.length < pitches.length) {
      const last = voicing[voicing.length - 1];
      voicing.push(last + 1 + pitchClass(nextPitch(pitches, last) - last - 1));
    }
    if (voicing[voicing.length - 1] > VOICING_HIGH) continue;

    const cost = previous?.length
      ? voicing.reduce(
          (sum, note, i) => sum + Math.abs(note - previous[Math.min(i, previous.length - 1)]),
          0,
        )
      : Math.abs(voicing.reduce((a, b) => a + b, 0) / voicing.length - VOICING_CENTER);
    if (cost < bestCost) {
      bestCost = cost;
      best = voicing;
    }
  }
  return best;
}

/** The chord's next pitch class above `note`. */
function nextPitch(pitches: readonly number[], note: number): number {
  const from = pitchClass(note);
  return pitches.find((p) => p > from) ?? pitches[0] + 12;
}
