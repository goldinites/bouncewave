import { cycle, euclid, Stretch, transpose } from '@/audio/music/compose';
import { compileSong, Song, SongDef, STEPS_PER_BAR } from '@/audio/music/score';

/*
 * The quick match's three tracks (5.6a, docs/AUDIO.md "Как делаем трек"), each built on a process
 * (audio/music/compose.ts) the user chose on the stand, and each with a melodic gesture and a
 * register of its own, so they don't sound like one tune on different sounds. Melodies are bars
 * of 8 tokens (eighths) or 16 (sixteenths).
 */

// ——— Shared ———

/** Arpeggio rhythms by heat: quarters, eighths, and sparse Euclidean spreads for the verses. */
const ARP_RHYTHM = {
  quarters: euclid(4, 16),
  eighths: euclid(8, 16),
  seven: euclid(7, 16),
  nine: euclid(9, 16),
  eleven: euclid(11, 16),
};

/** Two bars of a line, then two of rest: a hook's head teased before it comes in full. */
const tease = (line: string) =>
  [...line.split('|').slice(0, 2), ' . . . . . . . . ', ' . . . . . . . . '].join('|');

/** Cells an octave up, so a low melody plays beneath the arpeggio rather than inside it. */
const octaveUp = (cells: readonly Stretch[]): Stretch[] =>
  cells.map(({ cell, bars }) => ({ cell: cell.map((note) => transpose(note, 12)), bars }));

// ——— Neon Cathedral (lasers): darksynth in E minor. Hammered repeated notes, octave leaps and
// chromatic falls, low (D4–G5), under arpeggios an octave up ———

/** Five-note cells over Em, C, Am and B, two bars each: they turn across the four beats. */
const HYPNOTIC_CELLS: Stretch[] = [
  { cell: ['E4', 'G4', 'B4', 'E5', 'B4'], bars: 2 },
  { cell: ['E4', 'G4', 'C5', 'E5', 'C5'], bars: 2 },
  { cell: ['E4', 'A4', 'C5', 'E5', 'C5'], bars: 2 },
  { cell: ['D#4', 'F#4', 'B4', 'D#5', 'B4'], bars: 2 },
];

/** The verses' pulsing bass under the five-note cells. */
const HYPNOTIC_BASS = `E1 . E1 . E2 . E1 . E1 . E1 . E2 . D2 . | E1 . E1 . E2 . E1 . E1 . E1 . E2 . G1 .
                 | C2 . C2 . C2 . G1 . C2 . C2 . G1 . B1 . | C2 . C2 . C2 . G1 . C2 . C2 . E2 . G1 .
                 | A1 . A1 . A2 . A1 . A1 . A1 . A2 . G1 . | A1 . A1 . A2 . A1 . A1 . A1 . E2 . A1 .
                 | B1 . B1 . B1 . F#1 . B1 . B1 . D#2 . F#2 . | B1 . B1 . B1 . F#1 . B1 . B1 . A1 . F#1 .`;

/** Six-note cells over Em, C, G and D, two bars each. */
const CATHEDRAL_CELLS: Stretch[] = [
  { cell: ['E4', 'G4', 'B4', 'E5', 'B4', 'G4'], bars: 2 },
  { cell: ['E4', 'G4', 'C5', 'E5', 'C5', 'G4'], bars: 2 },
  { cell: ['D4', 'G4', 'B4', 'D5', 'B4', 'G4'], bars: 2 },
  { cell: ['D4', 'F#4', 'A4', 'D5', 'A4', 'F#4'], bars: 2 },
];

/**
 * The bridge's cells (Em Cmaj7 Fmaj7 Fmaj7 Am7 G D D): the chorus's chords left for the Phrygian
 * second, F over E, the cathedral's oldest colour.
 */
const CRYPT_CELLS: Stretch[] = [
  { cell: ['E4', 'G4', 'B4', 'E5', 'B4', 'G4'], bars: 1 },
  { cell: ['E4', 'G4', 'C5', 'E5', 'B4', 'G4'], bars: 1 },
  { cell: ['E4', 'A4', 'C5', 'F5', 'C5', 'A4'], bars: 2 },
  { cell: ['E4', 'A4', 'C5', 'E5', 'C5', 'G4'], bars: 1 },
  { cell: ['D4', 'G4', 'B4', 'D5', 'B4', 'G4'], bars: 1 },
  { cell: ['D4', 'F#4', 'A4', 'D5', 'A4', 'F#4'], bars: 2 },
];

/** K1, the verse (Em Em C C Am Am B B): a hammered low note leaping its octave. */
const K1 = `E4 . E4 . E5 . E4 . D5 - - - B4 - - - | . . E4 . G4 - - - F#4 - - - E4 - - -
          | E4 . E4 . E5 . E4 . C5 - - - G4 - - - | . . G4 . B4 - - - A4 - - - G4 - - -
          | A4 - - - G#4 - A4 - C5 - - - B4 - A4 - | E4 - - - - - - - . . . . . . . .
          | B4 . B4 . D#5 - - - A4 - - - F#4 - - - | D#4 - - - - - - - . . . . . . . .`;

/** K2, the second verse: a falling triad struck twice, a 3+3+4 push, a slow rise to close. */
const K2 = `B4 . G4 . E4 . . . B4 . G4 . E4 . F#4 . | G4 - - - - - - - . . E5 . D5 . B4 .
          | C5 . G4 . E4 . . . C5 . G4 . E4 . D4 . | E4 - - - - - - - . . G4 . F#4 . E4 .
          | A4 - - A4 - - A4 - - - G4 - - - E4 - | C5 - - C5 - - B4 - - - A4 - - - - -
          | F#4 - - - - - - - D#4 - - - - - - - | D#4 - - - F#4 - - - B4 - - - - - - -`;

/** K3, the chorus (Em Em C C G G D D): up the triad to the octave, a chromatic fall. */
const K3 = `E4 - E4 - E4 - G4 - . . B4 - . . E5 - | - - - - D#5 - - - D5 - - - C#5 - - -
          | C5 - - - - - - - B4 - - - A4 - G4 - | E4 - - - - - - - . . . . . . . .
          | G4 - G4 - G4 - B4 - . . D5 - . . G5 - | - - - - F#5 - - - E5 - - - D5 - - -
          | D5 - - - - - C5 - - - B4 - - - A4 - | F#4 - - - - - - - . . . . . . . .`;

/** Under K2, from its fifth bar: a supersaw holding one note a bar, under the pluck. */
const K2_HOLD = `. . . . . . . . | . . . . . . . . | . . . . . . . . | . . . . . . . .
                | E5 - - - - - - - | C5 - - - - - - - | D#5 - - - - - - - | F#5 - - - - - - -`;

/**
 * With K3: its first phrase answered in the rests, the call falling and the second voice
 * climbing back in the gap; its second sung in thirds over it, the peak in two voices.
 */
const K3_THIRDS = `. . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .
                 | . . . . . . . . . . . . . . . . | . . . . . . . . G5 - E5 - C5 - - -
                 | B4 - B4 - B4 - D5 - . . F#5 - . . B5 - | - - - - A5 - - - G5 - - - F#5 - - -
                 | F#5 - - - - - E5 - - - D5 - - - C5 - | A4 - - - - - - - A5 - F#5 - D5 - - -`;

/**
 * K4, the bridge (Em Cmaj7 Fmaj7 Fmaj7 Am7 G D D): long low notes, each leaning on its neighbour
 * a semitone off.
 */
const K4 = `B4 - - - C5 - - - B4 - - - - - - - | G4 - - - - - - - F#4 - - - E4 - - -
          | C5 - - - B4 - - - C5 - - - - - - - | G4 - - - - - - - . . . . . . . .
          | D5 - - - - - - - B4 - - - C5 - - - | B4 - - - A4 - - - G4 - - - - - - -
          | A4 - - - - - - - . . . . F#4 - - - | D4 - - - - - - - . . . . . . . .`;

// ——— Sunset Strip (no backdrop of its own, behind any of the quick match's): B flat major. Wide leaps and long notes sung down from the top
// (F5–D6) over a seven-note arpeggio; the chorus hook moves by step, the one line that does ———

/** Seven-note cells over Bb, F, Gm and Eb, two bars each: never landing the same way twice. */
const SUNSET_CELLS: Stretch[] = [
  { cell: ['Bb3', 'D4', 'F4', 'Bb4', 'D5', 'Bb4', 'F4'], bars: 2 },
  { cell: ['A3', 'C4', 'F4', 'A4', 'C5', 'A4', 'F4'], bars: 2 },
  { cell: ['Bb3', 'D4', 'G4', 'Bb4', 'D5', 'Bb4', 'G4'], bars: 2 },
  { cell: ['Bb3', 'Eb4', 'G4', 'Bb4', 'Eb5', 'Bb4', 'G4'], bars: 2 },
];

/** The verse's turnaround into the second pass (Cm7 F7sus4, a bar each), on the same seven notes. */
const SUNSET_TURN_CELLS: Stretch[] = [
  ...SUNSET_CELLS.slice(0, 3),
  { cell: ['Bb3', 'C4', 'G4', 'Bb4', 'Eb5', 'Bb4', 'G4'], bars: 1 },
  { cell: ['Bb3', 'C4', 'F4', 'Bb4', 'Eb5', 'Bb4', 'F4'], bars: 1 },
];

/**
 * The chorus's cells, a chord a bar (Bb Gm7 F Cm7 Ebmaj7 Gm7 Cm7 Fsus4): the harmony quickens,
 * and comes home round the circle of fifths.
 */
const SUNSET_SOAR_CELLS: Stretch[] = [
  { cell: ['Bb3', 'D4', 'F4', 'Bb4', 'D5', 'Bb4', 'F4'], bars: 1 },
  { cell: ['Bb3', 'D4', 'F4', 'G4', 'D5', 'Bb4', 'G4'], bars: 1 },
  { cell: ['A3', 'C4', 'F4', 'A4', 'C5', 'A4', 'F4'], bars: 1 },
  { cell: ['Bb3', 'C4', 'G4', 'Bb4', 'Eb5', 'Bb4', 'G4'], bars: 1 },
  { cell: ['Bb3', 'D4', 'G4', 'Bb4', 'Eb5', 'D5', 'G4'], bars: 1 },
  { cell: ['Bb3', 'D4', 'F4', 'G4', 'D5', 'Bb4', 'G4'], bars: 1 },
  { cell: ['Bb3', 'C4', 'G4', 'Bb4', 'Eb5', 'Bb4', 'G4'], bars: 1 },
  { cell: ['Bb3', 'C4', 'F4', 'Bb4', 'C5', 'Bb4', 'F4'], bars: 1 },
];

/**
 * The bridge's cells (Ebmaj7 Cm7 Cm7 Dm7 Gm7 Gm7 Dm7 D): off the main road, never touching home
 * or its dominant, and ending on D major, a turn of the wheel back to B flat.
 */
const SUNSET_DUSK_CELLS: Stretch[] = [
  { cell: ['Bb3', 'D4', 'G4', 'Bb4', 'Eb5', 'D5', 'G4'], bars: 1 },
  { cell: ['Bb3', 'C4', 'G4', 'Bb4', 'Eb5', 'Bb4', 'G4'], bars: 2 },
  { cell: ['A3', 'C4', 'F4', 'A4', 'D5', 'A4', 'F4'], bars: 1 },
  { cell: ['Bb3', 'D4', 'F4', 'G4', 'D5', 'Bb4', 'G4'], bars: 2 },
  { cell: ['A3', 'C4', 'F4', 'A4', 'D5', 'A4', 'F4'], bars: 1 },
  { cell: ['A3', 'D4', 'F#4', 'A4', 'D5', 'A4', 'F#4'], bars: 1 },
];

/**
 * W1, the verse (Bb Bb F F Gm Gm Eb Eb, the second time ending Cm7 F7sus4): wide
 * leaps down from the top, held.
 */
const W1 = `D6 - - - - - F5 - - - Bb5 - - - - - | A5 - - - - - - - F5 - - - - - - -
          | C6 - - - - - F5 - - - A5 - - - - - | G5 - - - - - - - C6 Bb5 A5 G5 A5 - - -
          | Bb5 - - Bb5 - - G5 - - - D6 - - - - - | - - - - C6 - - - Bb5 - - - G5 - - -
          | G5 - - - - - Bb5 - - - G5 - - - F5 - | F5 - - - - - - - . . D6 C6 Bb5 . F5 .`;

/**
 * The passenger's line under W1, from the verse's ninth bar: one or two long notes a bar, low,
 * moving against the melody — down where it climbs, up where it falls.
 */
const W1_UNDER = `F4 - - - D5 - - - | C5 - - - - - - - | A4 - - - C5 - - - | G4 - - - A4 - - -
                | Bb4 - - - D5 - - - | D5 - - - C5 - - - | Bb4 - - - G4 - - - | G4 - - - - - - -`;

/**
 * S3, the chorus hook (soar) over a chord a bar (Bb Gm7 F Cm7 Ebmaj7 Gm7 Cm7 Fsus4): by step from
 * D6, then tied over the bar and climbing, a 3+3+2.
 */
const S3 = `D6 - - - C6 - Bb5 - | A5 - - - Bb5 - - - | C6 - - - A5 - F5 - | G5 - - - - - - - G5 F5 G5 Bb5 G5 - - -
             | - - Bb5 - - - D6 - | - - - - C6 - Bb5 - | G5 - - Bb5 - - C6 - | Bb5 - - - - - G5 A5`;

/** S3's harmony below it. */
const S3_THIRDS = `Bb5 - - - A5 - G5 - | F5 - - - G5 - - - | A5 - - - F5 - D5 - | Eb5 - - - - - - -
                    | D5 - G5 - - - Bb5 - | - - - - A5 - G5 - | Eb5 - - G5 - - G5 - | G5 - - - - - Eb5 F5`;

/** W2, the bridge (Ebmaj7 Cm7 Cm7 Dm7 Gm7 Gm7 Dm7 D): falling fifths and sixths, held long. */
const W2 = `D6 - - - - - - - G5 - - - - - - - | Bb5 - - - A5 - - - G5 - - - - - - -
          | Bb5 - - - - - - - G5 - - - - - - - | F5 - - - - - - - D6 - - - - - - -
          | - - - - C6 - - - Bb5 - - - F5 - - - | D6 - - - - - - - . . . . . . . .
          | C6 - - - A5 - - - F5 - - - C6 - - - | A5 - - - - - - - . . . . . . . .`;

// ——— Sunset Strip's verses and build (5.10): the verse an octave down, so the chorus has
// somewhere to climb, its second eight bars answering off the beat; the second verse's own
// melody; a four-bar build teasing the hook ———

/** W1 an octave down (F4–D5): the verse sung low, so the chorus has somewhere to climb. */
const W1_LOW = transpose(W1, -12);

/** The verse's second eight bars (Bb Bb F F Gm Gm Cm7 F7sus4): pushed off the beat, falling and
 * climbing back, a run into the build. */
const W1_ANSWER_PUSH = `. . D5 - - - C5 - Bb4 - - - - - - - | F4 - - - - - - - G4 - Bb4 - - - - -
                      | . . C5 - - - A4 - F4 - - - - - - - | C5 - - - - - - - D5 - C5 - A4 - - -
                      | . . Bb4 - - - D5 - G4 - - - - - - - | D5 - - - - - - - F5 - D5 - Bb4 - - -
                      | Eb5 - - - - - G5 - C5 - - - - - - - | F5 - - - - - - - - - - - Eb5 D5 C5 -`;

/** The second verse's own melody on the vibraphone (Bb Bb F F Gm Gm Eb Eb): 3+3 pushes. */
const W3_PUSH = `F5 - - D5 - - Bb4 - - - - - - - - - | C5 - - - D5 - - - F5 - - - G5 - F5 -
               | A5 - - F5 - - C5 - - - - - - - - - | D5 - - - C5 - - - A4 - - - - - - -
               | G5 - - D5 - - Bb4 - - - - - - - - - | A4 - - - Bb4 - - - D5 - - - F5 - G5 -
               | Bb5 - - - - - G5 - Eb5 - - - - - - - | F5 - - - Eb5 D5 C5 - Bb4 - - - - - - -`;

/** The build's sax: the hook's head, then a bar's breath, twice (Eb F Eb F). */
const S3_TEASE = `D6 - - - C6 - Bb5 - | . . . . . . . . | D6 - - - C6 - Bb5 - | . . . . . . . .`;

// ——— Kabukicho Rain (neonCity): dark cyberpunk industrial on a witch-house half-time, F minor at
// 140, felt at 70 — after Cyberpunk 2077's Night City and its Japantown. Rain at night, neon
// smeared in the puddles, steel and steam: a cold march stepping through the Phrygian semitone
// over a gliding 808 driven until it tears and a chopped dark pad; a shamisen's riff leaping
// and gliding, the Japanese in-scale's dark semitone in it ———

/** The 808's line, a chord to two bars, sliding between its notes. */
const RAIN_808 = `F1 - - - - - - - - - F1 - F2 - - - | - - - - C2 - - - - - - - Eb2 - C2 -
                | Db2 - - - - - - - - - Db2 - Ab1 - - - | - - - - - - - - F1 - - - Ab1 - Db2 -
                | Bb1 - - - - - - - - - Bb1 - F2 - - - | - - - - Db2 - - - - - - - C2 - Bb1 -
                | C2 - - - - - - - - - C2 - G1 - - - | - - - - E2 - - - - - - - C2 - G1 -`;

/**
 * The 808 under the chorus (Fm Gbmaj7 Db Bbm7 Bbm Gbmaj7 C C): the Neapolitan G flat, the
 * in-scale's dark semitone, now in the harmony, a chord a bar.
 */
const NEON_808 = `F1 - - - - - - - - - F1 - F2 - - - | Gb1 - - - - - - - - - - - Db2 - Gb1 -
                | Db2 - - - - - - - - - Db2 - Ab1 - - - | Bb1 - - - - - - - - - - - F1 - Ab1 -
                | Bb1 - - - - - - - - - Bb1 - F2 - - - | Gb1 - - - - - - - - - - - Db2 - Gb1 -
                | C2 - - - - - - - - - C2 - G1 - - - | - - - - E2 - - - - - - - C2 - G1 -`;

/**
 * N1, the steel march (Fm Fm Db Db Bbm Bbm C C): even quarters stepping through the Phrygian
 * semitone, cold and level.
 */
const N1_MARCH = `F4 - - - Gb4 - - - F4 - - - C5 - - - | Ab4 - - - - - - - G4 - - - Ab4 - - -
                | F4 - - - Gb4 - - - F4 - - - Db5 - - - | C5 - - - - - - - Ab4 Ab4 Ab4 Ab4 C5 - Ab4 -
                | Db5 - - - C5 - - - Bb4 - - - F5 - - - | F5 - - - - - - - Eb5 - - - Db5 - - -
                | E5 - - - - - - - . . . . G4 - - - | C5 - - - - - - - C5 C5 Db5 C5 Bb4 - G4 -`;

/**
 * N2, the march in dialogue under the second verse (Fm Fm Db Db Bbm Bbm C C): it plays a bar and
 * holds, and the shamisen takes the next with the march's stutter of sixteenths — the two
 * trading bars, so the verse comes back developed rather than note for note.
 */
const N2_DIALOGUE = `F4 - - - C5 - - - Ab4 - - - Gb4 - - - | F4 - - - - - - - . . . . . . . .
                   | Ab4 - - - F5 - Eb5 - Db5 - - - C5 - - - | Db5 - - - - - C5 - . . . . . . . .
                   | Db5 - - - - - Bb4 - F5 - - - Gb5 - - - | F5 - - - Eb5 - - - . . . . . . . .
                   | G4 - - - C5 - - - E5 - - - Db5 - - - | C5 - - - - - - - . . . . . . . .`;

/** The shamisen's bars in the dialogue: the riff's calls are kept for the chorus. */
const N2_DIALOGUE_ANSWER = `. . . . . . . . . . . . . . . . | . . . . . . . . C5 C5 Db5 C5 Ab4 - F4 -
                          | . . . . . . . . . . . . . . . . | . . . . . . . . F5 F5 Gb5 F5 Db5 - Ab4 -
                          | . . . . . . . . . . . . . . . . | . . . . . . . . Bb4 Bb4 C5 Bb4 F4 - Db5 -
                          | . . . . . . . . . . . . . . . . | . . . . . . . . G4 G4 Ab4 G4 E4 - G4 -`;

/**
 * R2, the shamisen's riff (Fm Gbmaj7 Db Bbm7 Bbm Gbmaj7 C C), the Japanese quarter's voice in
 * the city's iron: a call jerking between the root and its octave in 3+3+2, answered every
 * other bar by a line gliding down by step on held notes.
 */
const R2_LEAP = `F4 - - F5 - - C5 - Ab4 - - Ab4 - - F4 - | Db5 - - - - - - - Bb4 - - - Ab4 - Gb4 -
               | Db5 - - Db5 - - Ab4 - F4 - - F5 Eb5 Db5 Eb5 - | Db5 - - - - - C5 - - - Bb4 - - - - -
               | Bb4 - - F5 - - Db5 - Bb4 - - F5 - - Db5 - | Gb5 - - - - - F5 - - - Db5 - - - - -
               | C5 - - C5 - - G4 - E4 G4 F4 E4 G4 - - - | G4 - - - - - - - C5 - - - - - - -`;

/**
 * The pulse under the chorus (Fm Gbmaj7 Db Bbm7 Bbm Gbmaj7 C C), after "The Rebel Path": the
 * chord thrumming low in nine sixteenths a bar, below the shamisen.
 */
const IRON_PULSE = cycle(
  [
    { cell: ['C4', 'Ab3', 'C4', 'Eb4'], bars: 1 },
    { cell: ['Bb3', 'Db4', 'Bb3', 'Db4'], bars: 1 },
    { cell: ['Ab3', 'Db4', 'Ab3', 'Db4'], bars: 1 },
    { cell: ['Bb3', 'Db4', 'Ab3', 'Db4'], bars: 1 },
    { cell: ['Bb3', 'Db4', 'Bb3', 'Db4'], bars: 1 },
    { cell: ['Bb3', 'Db4', 'Bb3', 'Db4'], bars: 1 },
    { cell: ['G3', 'C4', 'G3', 'E4'], bars: 2 },
  ],
  euclid(9, 16),
);

/**
 * The strings under the chorus (Fm Gbmaj7 Db Bbm7 Bbm Gbmaj7 C C): an inner voice sinking a
 * note a chord, held long under the shamisen's short ones, what the plucked riff can't sustain.
 */
const IRON_STRINGS = `C5 - - - - - - - | Bb4 - - - - - - - | Ab4 - - - - - - - | Ab4 - - - - - - -
                    | F4 - - - - - - - | F4 - - - - - - - | E4 - - - - - - - | G4 - - - - - - -`;

/**
 * The bridge's koto (Db Gbmaj7 Bbm Ebm7 Ab Fm C C): an in-scale phrase falling, plucked bare,
 * over the furthest the song strays — to A flat, the relative major, and back.
 */
const KOTO_RAIN = `Ab5 - - - F5 - Gb5 F5 | Db5 - - - - - - - | F5 - - - Db5 - Eb5 Db5 | Bb4 - - - - - - -
                 | C5 - - - - - Db5 C5 | Ab4 - - - G4 - F4 - | E5 - - - G5 - - - | C5 - - - - - - -`;

// ——— Above the Clouds (fuji): D, 96 BPM, Japan as its own music writes it rather than as a
// postcard (with the user, 25.10.2026: every token of Japan at once read as a tourist's). Dawn
// over the mountain, the clouds below: the verses on the shakuhachi in the yo scale (D E G A B,
// the folk songs' scale, no third), long notes each reached by a turn, its phrase ends falling,
// air between them, the koto answering in its rests; ma — six steps of silence — after the
// koto's glissando into the chorus; the chorus on Japan's pop "royal road" progression in
// yonanuki, the shakuhachi in unison with a flute tone over the odaiko's half-time; a valley in the shadow of
// the in-scale, the darker Japanese mode, with wind chimes and a temple bell ———

/**
 * The valley (Gsus2 Gsus2 Gm Gm Ebmaj7 Ebmaj7 Dsus4 Asus4): the chorus's opening two bars, then
 * an answer in the in-scale, falling to the E flat and sighing down its semitone onto D.
 */
const VALLEY_SHADOW = `D5 - - - - - A5 - - - - - F#5 - - - | E5 - - - - - D5 - - - - - . . . .
                     | . . . . Bb5 - - - - - A5 - - - - - | G5 - - - - - - - . . . . . . . .
                     | G5 - - - - - Eb5 - - - - - D5 - - - | Bb4 - - - - - - - . . . . . . . .
                     | . . . . A4 - - - - - G4 - - - - - | A4 - - - - - - - . . . . . . . .`;

/** V1 in the yo scale (D D Bm7 Bm7 G G Asus4 A): long notes, each reached by a turn; air between phrases. */
const V1_YO = `A5 - - - - - - - - - - - B5 A5 G5 - | E5 - - - - - - - - - - - . . . .
             | B5 - - - - - - - A5 - B5 - . . . . | E5 - - - - - - - - - - - D5 E5 D5 -
             | B4 - - - - - - - - - - - D5 B4 A4 - | G5 - - - - - - - . . . . . . . .
             | E5 - - - - - - - D5 - - - B4 - A4 - | A4 - - - - - - - . . . . . . . .`;

/** V2, the second verse: V1's question, then an answer that waits (ma) and falls low. */
const V2_LOW = `A5 - - - - - - - - - - - B5 A5 G5 - | E5 - - - - - - - - - - - . . . .
              | B5 - - - - - - - A5 - B5 - . . . . | E5 - - - - - - - - - - - D5 E5 D5 -
              | . . . . G5 - - - - - - - E5 - D5 - | B4 - - - - - - - . . . . A4 B4 D5 -
              | E5 - - - - - - - - - - - D5 - B4 - | A4 - - - - - - - - - - - . . . .`;

/**
 * The koto answering the shakuhachi (kakeai, the dialogue of Japan's chamber trio): silent while
 * it sings, a phrase of three to five notes in its rests and under its long notes: first V1's
 * question, then V2's answer.
 */
const KAKEAI_QUESTION = `. . . . . . D5 E5 A4 - . . . . . . | . . . . . . . . . . . . B4 A4 E4 -
                       | . . . . . . . . . . . . E5 - D5 B4 | . . . . A4 B4 D5 - . . . . . . . .`;
const KAKEAI_LOW = `${KAKEAI_QUESTION}
                  | B4 A4 G4 - . . . . . . . . . . . . | . . . . . . . . D5 E5 G5 - . . . .
                  | . . . . A4 B4 D5 - . . . . . . . . | . . . . . . . . . . . . E5 D5 B4 A4`;

/*
 * The chorus as Japan's pop writes one (no festival postcard): the "royal road" progression
 * (ōdō shinkō, IV V iii vi, the J-pop and anime chorus's own), its melody in yonanuki — the
 * pentatonic of Japanese popular song, with the third the folk scale leaves out — on the
 * shakuhachi doubled by a pure flute tone; the koto plucking now and then
 */
const DAWN_CHORDS = 'Gmaj7 | A | F#m7 | Bm7 | Gmaj7 | A | D | D';

/** The chorus (sabi): rising by steps to D6 in bar 4, then singing home, a ma before the cadence. */
const SABI_CLIMB = `D5 - E5 - F#5 - - - A5 - - - - - - - | B5 - - - A5 - - - F#5 - E5 - - - - -
                  | E5 - F#5 - A5 - - - B5 - - - - - - - | D6 - - - B5 - - - A5 - F#5 - - - - -
                  | B5 - - - - - - - A5 B5 A5 F#5 E5 - - - | E5 - - - - - - - . . . . . . . .
                  | F#5 - - - E5 - - - D5 - - - E5 - - - | D5 - - - - - - - - - - - - - - -`;

/** The koto under the chorus: a fifth or a third plucked on every other chord, a run into the cadence. */
const KOTO_SPARSE = `G4 D5 - - - - - - - - - - - - - - | . . . . . . . . . . . . . . . .
                   | F#4 A4 - - - - - - - - - - - - - - | . . . . . . . . . . . . . . . .
                   | G4 B4 - - - - - - - - - - - - - - | . . . . . . . . . . . . A4 B4 D5 E5
                   | D4 A4 - - - - - - - - - - - - - - | . . . . . . . . . . . . . . . .`;

/**
 * The build's koto: struck on the strong beats under the clappers, then a glissando up the yo
 * scale into the ma.
 */
const KOTO_GLISS = `G4 - - - . . . . D5 - - - . . . . | G4 - - - . . . . B4 - - - . . D5 -
                  | A4 - - - . . . . E5 - - - . . . . | . G4 A4 B4 D5 E5 G5 A5 B5 . . . . . . .`;

/** Wind chimes in the valley's shadow, in its in-scale (G A B flat D E flat). */
const FURIN_VALLEY = `. . . . . D6 - - - - - - - - - - | - - - A5 - - - - - - - - - - . .
                    | . . . . . . . . . . . Bb5 - - - - | - - - - - - - D6 - - - - - - - -
                    | . . . . . . G5 - - - - - - - - - | - - - - - - - - - - - Bb5 - - - -
                    | - - - - . . . . . . . . . A5 - - | - - - - - - - - . . . . . . . .`;

// ——— The warehouse's track (5.11): EBM after Front 242 and Nitzer Ebb, chosen of three bases —
// a bass sequenced in sixteenths marching in C minor, the factory's kit; a hocket on the broken
// digital lead, its notes off the beat as none of the other tracks starts them ———

/** EBM's sequenced bass: the root in a machine's sixteenths, the octave and the fifth kicking in. */
const CONVEYOR_BASS = cycle(
  [
    { cell: ['C2', 'C2', 'C3', 'C2', 'G1', 'C2', 'C2', 'Bb1'], bars: 4 },
    { cell: ['F1', 'F1', 'F2', 'F1', 'C2', 'F1', 'F1', 'Eb2'], bars: 2 },
    { cell: ['G1', 'G1', 'G2', 'G1', 'D2', 'G1', 'B1', 'D2'], bars: 2 },
  ],
  euclid(12, 16, 1),
);

/** The hocket, the melody: notes only on the sixteenths between the beat's, leaping like a machine's sparks. */
const CONVEYOR_HOCKET = `. C5 . . . G5 . . . C5 . . . Eb5 . . | . D5 . . . G5 . . . C6 . . Bb5 - - -
                       | . C5 . . . G5 . . . Eb5 . . . F5 . . | G5 - - - - - - - . . . . . . . .
                       | . F5 . . . C6 . . . Ab5 . . . G5 . . | . F5 . . . C6 . . . Eb5 . . D5 - - -
                       | . G5 . . D5 . . B4 . . D5 . . G5 . . | G5 - - - - - - - . . . . . . . .`;

/** Long notes answering the hocket from the second verse, one a bar, the chord's colour held. */
const CONVEYOR_HOLD = `G4 - - - - - - - - - - - - - - - | Eb4 - - - - - - - - - - - - - - -
                     | G4 - - - - - - - - - - - - - - - | F4 - - - - - - - - - - - - - - -
                     | Ab4 - - - - - - - - - - - - - - - | C5 - - - - - - - - - - - - - - -
                     | B4 - - - - - - - - - - - - - - - | D5 - - - - - - - - - - - - - - -`;

/**
 * The soundtrack. Every song has a calm part for the menus, parts to play over and a peak for
 * the hottest rallies, and the conductor moves between them as the match heats up and cools
 * down — but each track is built its own way: its form, the length of its parts, its intro, its
 * beat, its kit, how it climbs to its peak and how it marks its turns (5.6a: three tracks built
 * on one template sounded like one song). See SectionDef for the notation.
 */
const NEON_CATHEDRAL: SongDef = {
  // After Perturbator: a cinematic sixteen-bar intro of the arpeggios alone over a bass drone,
  // two verses on a broken beat, a four-bar riser into the four-on-the-floor the chorus earns,
  // with a drop, a breakdown that teases the hook on a bell, a half-time bridge; the melody low,
  // the arpeggios over it; a timpani for a kick, the cathedral's orchestra
  title: 'Neon Cathedral',
  bpm: 124,
  swing: 0,
  level: 1,
  scene: 'lasers',
  kit: 'cathedral',
  transitions: 'synth',
  // The cathedral's long stone tail on the strings and the beams; the bass and pads breathe under
  // the kick, half as deep as a darksynth machine pumps: the whole mix pounding on every beat
  // was what tired the ear
  room: 'cathedral',
  pump: 0.5,
  // The FM bass fed lightly into the saturation: a rubbery attack settling round, clean under
  // the strings and the beams
  grit: -6,
  // A string section holds the chords under the vault, as an orchestra would in a cathedral
  voices: { lead: 'brass', counter: 'saw', arp: 'arpPulse', bass: 'bassFm', pad: 'strings' },
  form: [
    'intro',
    'verse',
    'verse2',
    'build',
    'chorus',
    'breakdown',
    'bridge',
    'verse2',
    'build',
    'chorus',
  ],
  sections: [
    {
      // The lights come on one by one: a single beam (the arpeggio), the bass drone under it,
      // the haze of the pad, then a bell striking the verse's hammered note
      name: 'intro',
      tier: 'calm',
      chords: 'Em | Em | C | C | G | G | D | D | Em | Em | C | C | G | G | D | D',
      lead: tease(K1),
      leadVoice: 'bell',
      arpLine: cycle(octaveUp(CATHEDRAL_CELLS), ARP_RHYTHM.eighths),
      bass: 'long',
      drums: 'none',
      pad: 'swell',
      enter: { bass: 4, pads: 8, lead: 12 },
      sweep: { arp: [0.15, 1.3], pads: [0.5, 1] },
      // Its drone and swelling pad hold it up: a little further down, below the verses
      level: -1,
    },
    {
      name: 'verse',
      tier: 'groove',
      chords: 'Em | Em | C | C | Am | Am | B | B',
      lead: K1,
      leadVoice: 'pwm',
      arpLine: cycle(octaveUp(HYPNOTIC_CELLS), ARP_RHYTHM.seven),
      bassLine: HYPNOTIC_BASS,
      drums: 'darkbreak',
      fill: 'stop',
      pad: 'hold',
      layers: { lead: 0.3, drums: 0.3 },
      enter: { arp: 4 },
      sweep: { arp: [0.4, 1.5], pads: [0.7, 1.2] },
    },
    {
      name: 'verse2',
      tier: 'groove',
      chords: 'Em | Em | C | C | Am | Am | B | B',
      lead: K2,
      leadVoice: 'pluck',
      counter: K2_HOLD,
      arpLine: cycle(octaveUp(HYPNOTIC_CELLS), ARP_RHYTHM.eleven),
      bassLine: HYPNOTIC_BASS,
      drums: 'darkbreak2',
      fill: 'roll',
      pad: 'hold',
      layers: { lead: 0.3, counter: 0.3 },
      sweep: { arp: [0.6, 1.6] },
    },
    {
      // Four bars of noise rising, the bass in sixteenths, into the drop
      name: 'build',
      tier: 'rise',
      chords: 'Am | Am | B | B',
      arp: 'up',
      bass: 'pulse16',
      drums: 'drive',
      fill: 'roll',
      pad: 'hold',
      riser: true,
      sweep: { arp: [0.4, 2.2] },
    },
    {
      // The floor at last, opened on the offbeats; the bass gallops, and the saw sings the
      // second phrase in thirds over the brass
      name: 'chorus',
      tier: 'high',
      chords: 'Em | Em | C | C | G | G | D | D',
      lead: K3,
      counter: K3_THIRDS,
      arpLine: cycle(octaveUp(CATHEDRAL_CELLS)),
      bass: 'gallop',
      drums: 'darkpeak',
      fill: 'toms',
      pad: 'hold',
      stabs: 'push',
      drop: true,
    },
    {
      name: 'breakdown',
      tier: 'calm',
      chords: 'Em | Em | C | C | G | G | D | D',
      lead: tease(K3),
      leadVoice: 'bell',
      arpLine: cycle(octaveUp(CATHEDRAL_CELLS), ARP_RHYTHM.quarters),
      bass: 'long',
      drums: 'halftime',
      pad: 'swell',
      silence: 4,
      sweep: { arp: [1.2, 0.4] },
      level: -1,
    },
    {
      // The dark beat at half speed: heavy, the hats still running, and the harmony going down
      // into the crypt — the F a semitone over the home E
      name: 'bridge',
      tier: 'groove',
      chords: 'Em | Cmaj7 | Fmaj7 | Fmaj7 | Am7 | G | D | D',
      lead: K4,
      leadVoice: 'sync',
      // The arpeggio waits four bars and walks in quarters, leaving the sync lead the room it
      // shared with it
      arpLine: cycle(octaveUp(CRYPT_CELLS), ARP_RHYTHM.quarters),
      enter: { arp: 4 },
      bass: 'long',
      drums: 'darkdrive',
      feel: 'half',
      fill: 'stop',
      pad: 'hold',
      sweep: { arp: [0.3, 1.4], pads: [0.7, 1.2] },
    },
  ],
};

const SONG_DEFS: SongDef[] = [
  NEON_CATHEDRAL,
  {
    // After The Midnight and FM-84: a night drive. The engine idles from the first bar — kick,
    // hats, the bass in eighths under the seven-note arpeggio — then a sixteen-bar verse sung low
    // on the electric piano over the anthem beat (a kick on one and three, the gated snare on two
    // and four), four bars of the sax teasing the hook into the chorus, where the era's synth
    // brass pushes under it, a bridge on the sax, the second verse's own tune on the vibraphone,
    // and an outro that fades on it. Cymbals and drums mark the turns, no synth swells
    title: 'Sunset Strip',
    // Faster than Fuji's dawn by a third of a beat a second: a night drive, not a walk
    bpm: 112,
    swing: 0,
    level: -0.5,
    // Its backdrop, the outrun, is gone: it plays behind any of the quick match's
    transitions: 'drums',
    // A short plate for the gated snare; the bass breathes with the kick, but less than the
    // darksynth's, so the drive rolls rather than pumps
    room: 'night',
    pump: 0.7,
    // A string section holds the chords, and the crash is the era's electronic one
    kit: 'outrun',
    voices: { lead: 'epiano', counter: 'soft', arp: 'arpPulse', bass: 'bassFm', pad: 'strings' },
    form: ['intro', 'verse', 'build', 'chorus', 'bridge', 'verse2', 'build', 'chorus', 'outro'],
    sections: [
      {
        // The engine turns over: the kick and the hats, then the bass, then the arpeggio's lights
        name: 'intro',
        tier: 'calm',
        chords: 'Bb | Bb | F | F | Gm | Gm | Eb | Eb',
        arpLine: cycle(SUNSET_CELLS),
        bass: 'eighths',
        drums: 'cruise',
        pad: 'hold',
        enter: { bass: 2, arp: 4 },
        sweep: { arp: [0.3, 1.2] },
      },
      {
        name: 'verse',
        tier: 'groove',
        // The second pass turns round on Cm7 and F7sus4, leaning on into the build
        chords: 'Bb | Bb | F | F | Gm | Gm | Eb | Eb | Bb | Bb | F | F | Gm | Gm | Cm7 | F7sus4',
        // The electric piano low, then its answer pushed off the beat; the passenger's voice joins
        lead: `${W1_LOW} | ${W1_ANSWER_PUSH}`,
        counter: W1_UNDER,
        arpLine: cycle([...SUNSET_CELLS, ...SUNSET_TURN_CELLS], ARP_RHYTHM.nine),
        // The bass bouncing on its octave, the spring in the drive
        bass: 'octave',
        drums: 'anthem',
        fill: 'toms',
        pad: 'hold',
        layers: { lead: 0.3, counter: 0.3 },
        enter: { counter: 8 },
        sweep: { arp: [0.4, 1.4] },
      },
      {
        // Four bars: the sax teases the hook's head under a reverse crash, the toms lead in
        name: 'build',
        tier: 'rise',
        chords: 'Eb | F | Eb | F',
        lead: S3_TEASE,
        leadVoice: 'sax',
        arp: 'up',
        bass: 'drive',
        drums: 'anthem',
        fill: 'toms',
        pad: 'hold',
        riser: true,
      },
      {
        // The era's synth brass pushing under the sax, the melody lifted against the beat
        name: 'chorus',
        tier: 'high',
        chords: 'Bb | Gm7 | F | Cm7 | Ebmaj7 | Gm7 | Cm7 | Fsus4',
        lead: S3,
        leadVoice: 'sax',
        counter: S3_THIRDS,
        enter: { counter: 4 },
        arpLine: cycle(SUNSET_SOAR_CELLS),
        bass: 'drive',
        drums: 'anthem',
        fill: 'toms',
        pad: 'hold',
        stabs: 'push',
        mix: { melody: 1.5 },
        drop: true,
      },
      {
        name: 'bridge',
        tier: 'groove',
        chords: 'Ebmaj7 | Cm7 | Cm7 | Dm7 | Gm7 | Gm7 | Dm7 | D',
        // The sax, the era's voice: the koto belongs to Fuji
        lead: W2,
        leadVoice: 'sax',
        arpLine: cycle(SUNSET_DUSK_CELLS, ARP_RHYTHM.eighths),
        bass: 'walk',
        drums: 'break',
        fill: 'stop',
        pad: 'hold',
        layers: { lead: 0.3 },
        sweep: { arp: [0.4, 1.4], pads: [0.7, 1.2] },
      },
      {
        // The second verse's own tune on the vibraphone, in pushes of three
        name: 'verse2',
        tier: 'groove',
        chords: 'Bb | Bb | F | F | Gm | Gm | Eb | Eb',
        lead: W3_PUSH,
        leadVoice: 'vibes',
        arpLine: cycle(SUNSET_CELLS, ARP_RHYTHM.eleven),
        bass: 'sync',
        drums: 'anthem',
        fill: 'toms',
        pad: 'hold',
        layers: { lead: 0.3 },
        sweep: { arp: [0.6, 1.5] },
      },
      {
        // The drums gone, the verse's opening on the vibraphone, the arpeggio slowing to quarters
        name: 'outro',
        tier: 'calm',
        chords: 'Bb | Bb | F | F | Gm | Gm | Eb | Eb',
        lead: tease(W1),
        leadVoice: 'vibes',
        arpLine: cycle(SUNSET_CELLS, ARP_RHYTHM.quarters),
        bass: 'long',
        drums: 'none',
        pad: 'swell',
        sweep: { arp: [1, 0.3] },
      },
    ],
  },
  {
    // Cyberpunk industrial on a witch-house half-time: rain at night in Kabukicho, after
    // Cyberpunk 2077. A police radio crackles through the rain, then a music box steps through a
    // cold march over a gliding 808 that tears and a dark pad chopped into a rhythm; steel rings in
    // the street; in the second verse the march trades bars with the shamisen, the beat cuts out
    // in stutters, and the chorus hits on iron at the full tempo — the shamisen's riff whole,
    // leaping and gliding, strings holding and a pulse thrumming under it. The bridge is a koto
    // alone, a siren far off; rain ticks open and close it, a rain stick for a crash
    title: 'Kabukicho Rain',
    bpm: 140,
    swing: 0,
    level: -4,
    scene: 'neonCity',
    kit: 'rain',
    // Cuts, not swells: the turns are the drums, a reverse crash and the beat stuttering out
    transitions: 'drums',
    // The fog of a rainy street, long and dark; the pad ducks under the 808's kick, the city's
    // machinery breathing, and the 808 is driven into its saturation until it tears
    room: 'fog',
    pump: 0.6,
    grit: 10,
    voices: {
      lead: 'musicBox',
      counter: 'shamisen',
      arp: 'arpPulse',
      bass: 'bass808',
      bassGlide: 0.07,
    },
    form: [
      'intro',
      'verse',
      'verse2',
      'build',
      'chorus',
      'bridge',
      'verse2',
      'build',
      'chorus',
      'outro',
    ],
    sections: [
      {
        // Rain on the window, a police radio crackling through it; the lullaby's opening on the
        // celesta, the 808 under it
        name: 'intro',
        tier: 'calm',
        chords: 'Fm | Fm | Db | Db | Bbm | Bbm | C | C',
        lead: tease(N1_MARCH),
        leadVoice: 'celesta',
        bass: 'long',
        drums: 'witchIntro',
        pad: 'swell',
        // Quiet by its own sparseness already: the calm tier's dip would take it out of hearing
        level: 5,
        enter: { lead: 4, bass: 4 },
        hits: { radioStatic: 'X' + '.'.repeat(8 * STEPS_PER_BAR - 1) },
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Fm | Fm | Db | Db | Bbm | Bbm | C | C',
        lead: N1_MARCH,
        bassLine: RAIN_808,
        drums: 'witch',
        fill: 'stop',
        pad: 'chop',
        layers: { lead: 0.3 },
      },
      {
        // The march on the celesta, trading bars with the shamisen
        name: 'verse2',
        tier: 'groove',
        chords: 'Fm | Fm | Db | Db | Bbm | Bbm | C | C',
        lead: N2_DIALOGUE,
        leadVoice: 'celesta',
        counter: N2_DIALOGUE_ANSWER,
        bassLine: RAIN_808,
        drums: 'witch',
        fill: 'roll',
        pad: 'chop',
        layers: { lead: 0.3, counter: 0.3 },
      },
      {
        // No riser: the beat stutters, torn by a gate, and the chorus hits out of it
        name: 'build',
        tier: 'rise',
        chords: 'Bbm | C',
        bass: 'eighths',
        drums: 'witch',
        fill: 'roll',
        pad: 'hold',
        glitch: 'stutter',
      },
      {
        // The riff whole on the shamisen, its calls and glides, strings holding under it and the
        // pulse thrumming, the beat out of the half-time; the harmony finds the G flat the riff
        // keeps leaning on
        name: 'chorus',
        tier: 'high',
        chords: 'Fm | Gbmaj7 | Db | Bbm7 | Bbm | Gbmaj7 | C | C',
        lead: R2_LEAP,
        leadVoice: 'shamisen',
        counter: IRON_STRINGS,
        counterVoice: 'strings',
        arpLine: IRON_PULSE,
        bassLine: NEON_808,
        drums: 'neonIron',
        fill: 'stop',
        // The pulse takes over the chopped pad's rhythm; the pad holds under it
        pad: 'hold',
        layers: { counter: 0 },
        // Fuller, not only louder: the pads and the melody lifted against the beat and the 808,
        // which buried them 17-19 dB under
        mix: { pads: 6, melody: 4 },
        drop: true,
      },
      {
        // A koto alone over the held pad, the 808 gone: the Japanese insert, a siren far off.
        // Lifted to the verses' level, as it plays in a rally: an insert, not a hole in the music
        name: 'bridge',
        tier: 'groove',
        chords: 'Db | Gbmaj7 | Bbm | Ebm7 | Ab | Fm | C | C',
        lead: KOTO_RAIN,
        leadVoice: 'koto',
        bass: 'long',
        drums: 'witchIntro',
        pad: 'swell',
        layers: { lead: 0.3 },
        hits: { siren: '.'.repeat(4 * STEPS_PER_BAR) + 'o' + '.'.repeat(4 * STEPS_PER_BAR - 1) },
        level: 4,
      },
      {
        name: 'outro',
        tier: 'calm',
        chords: 'Fm | Fm | Db | Db | Bbm | Bbm | C | C',
        lead: tease(N1_MARCH),
        leadVoice: 'celesta',
        bass: 'long',
        drums: 'witchIntro',
        pad: 'swell',
        level: 5,
      },
    ],
  },
  {
    // Dawn over Fuji, the clouds below (see the lines above): the koto alone opens it, the
    // shakuhachi sings the verses over spacious half-time drums, then the festival beat with the
    // koto answering it; the kabuki's clappers and the koto's glissando climb into a silence,
    // and the chorus comes in on the royal road; the valley is the shakuhachi alone, wind chimes
    // and a temple bell. Moving in sixteenths where the match plays, so 96 BPM never drags a rally
    title: 'Above the Clouds',
    bpm: 96,
    swing: 0,
    level: -2.75,
    scene: 'fuji',
    kit: 'japan',
    transitions: 'drums',
    // Open air with far slopes answering late; the big pad all but still, the space it paints
    // not pulsing with the drums
    room: 'valley',
    pump: 0.2,
    // The shakuhachi slides through its turns and lets its phrase ends fall, as a breath does
    voices: {
      lead: 'shakuhachi',
      counter: 'koto',
      arp: 'pluck',
      bass: 'bassFm',
      glide: 0.04,
      fall: 2,
    },
    form: ['intro', 'verse', 'verse2', 'build', 'chorus', 'valley', 'verse2', 'build', 'chorus'],
    sections: [
      {
        // Dawn on the koto alone over the pad
        name: 'intro',
        tier: 'calm',
        chords: 'D | D | Bm7 | Bm7 | G | G | Asus4 | A',
        lead: tease(V1_YO),
        leadVoice: 'koto',
        bass: 'long',
        drums: 'none',
        pad: 'swell',
        enter: { lead: 4 },
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'D | D | Bm7 | Bm7 | G | G | Asus4 | A',
        lead: V1_YO,
        bass: 'long',
        drums: 'halftime',
        fill: 'taiko',
        pad: 'hold',
        layers: { lead: 0.3 },
      },
      {
        // The festival beat underneath, the koto answering the shakuhachi in its rests
        name: 'verse2',
        tier: 'groove',
        chords: 'D | D | Bm7 | Bm7 | G | G | Asus4 | A',
        lead: V2_LOW,
        counter: KAKEAI_LOW,
        bass: 'sync',
        drums: 'matsuri',
        fill: 'taiko',
        pad: 'hold',
        layers: { lead: 0.3, counter: 0.2 },
      },
      {
        // The clappers, the koto's glissando, then ma: six steps of silence before the chorus
        name: 'build',
        tier: 'rise',
        chords: 'G | G | Asus4 | A',
        counter: KOTO_GLISS,
        bass: 'drive',
        drums: 'kabuki',
        pad: 'hold',
        riser: true,
        silence: 6,
      },
      {
        // The shakuhachi on the royal road, a pure flute tone in unison under it, the odaiko
        // leading the half-time
        name: 'chorus',
        tier: 'high',
        chords: DAWN_CHORDS,
        lead: SABI_CLIMB,
        counter: SABI_CLIMB,
        counterVoice: 'flute',
        arpLine: KOTO_SPARSE,
        arpVoice: 'koto',
        bass: 'drive',
        drums: 'dawn',
        fill: 'taiko',
        pad: 'hold',
        // The shakuhachi and the koto lifted over the half-time, so the peak is the brightest part
        mix: { melody: 2 },
        drop: true,
      },
      {
        // The shakuhachi alone in the in-scale's shadow, wind chimes and a temple bell in the silence
        name: 'valley',
        tier: 'calm',
        chords: 'Gsus2 | Gsus2 | Gm | Gm | Ebmaj7 | Ebmaj7 | Dsus4 | Asus4',
        lead: VALLEY_SHADOW,
        counter: FURIN_VALLEY,
        counterVoice: 'celesta',
        bass: 'long',
        // A temple bell, slowly, once every two bars
        drums: 'bonsho',
        feel: 'half',
        pad: 'swell',
      },
    ],
  },
  {
    // EBM after Front 242 and Nitzer Ebb: the night shift in the warehouse. The machines start one
    // by one — the conveyor's bass, the chains and the steam, then the kick — and the hocket throws
    // sparks off the beat over the march; a long note answers it from the second verse; the line
    // stops dead for the shift's siren, and the peak runs the belt at full tilt under brass; the
    // shift change is the chains and the steam alone over the bass's hum
    title: 'Night Shift',
    bpm: 112,
    swing: 0,
    level: -1,
    scene: 'warehouse',
    kit: 'factory',
    // A short metal hall; the bass driven into its tear, and pumping under the kick as EBM does
    room: 'plate',
    grit: 8,
    voices: { lead: 'crush', counter: 'square', arp: 'arpPulse', bass: 'bassGrowl' },
    form: ['intro', 'verse', 'verse2', 'build', 'chorus', 'shift', 'verse2', 'build', 'chorus'],
    sections: [
      {
        // The conveyor starts: its bass alone, then the chains and the steam, then the kick
        name: 'intro',
        tier: 'calm',
        chords: 'Cm | Cm | Cm | Cm | Fm | Fm | G | G',
        bassLine: CONVEYOR_BASS,
        drums: 'ebm',
        pad: 'none',
        enter: { drums: 4 },
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Cm | Cm | Cm | Cm | Fm | Fm | G | G | Cm | Cm | Cm | Cm | Fm | Fm | G | G',
        lead: CONVEYOR_HOCKET,
        bassLine: CONVEYOR_BASS,
        drums: 'ebm',
        fill: 'roll',
        pad: 'none',
        stabs: 'offbeat',
        layers: { lead: 0.3 },
      },
      {
        name: 'verse2',
        tier: 'groove',
        chords: 'Cm | Cm | Cm | Cm | Fm | Fm | G | G',
        lead: CONVEYOR_HOCKET,
        counter: CONVEYOR_HOLD,
        bassLine: CONVEYOR_BASS,
        drums: 'ebm',
        fill: 'roll',
        pad: 'hold',
        stabs: 'offbeat',
        layers: { lead: 0.3, counter: 0.3 },
      },
      {
        // The line stops: two bars of the shift's siren over the drums, then dead silence
        name: 'build',
        tier: 'rise',
        chords: 'G | G',
        bass: 'pulse16',
        drums: 'ebm',
        fill: 'roll',
        pad: 'hold',
        hits: { siren: `X${'.'.repeat(31)}` },
        silence: 4,
      },
      {
        // The belt at full tilt: the hocket over a long note an octave up, brass pushing
        name: 'chorus',
        tier: 'high',
        chords: 'Cm | Cm | Cm | Cm | Fm | Fm | G | G',
        lead: CONVEYOR_HOCKET,
        counter: transpose(CONVEYOR_HOLD, 12),
        bassLine: CONVEYOR_BASS,
        drums: 'ebmHot',
        fill: 'roll',
        pad: 'hold',
        stabs: 'push',
        // The sparks lifted over the brass, so the peak is the brightest part
        mix: { melody: 2 },
        drop: true,
      },
      {
        // The shift change: no kick, the chains and the steam over the bass's hum, and the
        // harmony off the belt's road
        name: 'shift',
        tier: 'calm',
        chords: 'Ab | Ab | Bb | Bb | Fm | Fm | G | G',
        counter: CONVEYOR_HOLD,
        bass: 'long',
        drums: 'shift',
        pad: 'swell',
      },
    ],
  },
];

export const SONGS: Song[] = SONG_DEFS.map(compileSong);
