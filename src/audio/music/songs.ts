import { cycle, euclid, pulse, Stretch, transpose } from '@/audio/music/compose';
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

/** Under K2, from its fifth bar: a supersaw choir holding one note a bar, under the pluck. */
const K2_CHOIR = `. . . . . . . . | . . . . . . . . | . . . . . . . . | . . . . . . . .
                | E5 - - - - - - - | C5 - - - - - - - | D#5 - - - - - - - | F#5 - - - - - - -`;

/** Answering K3 in its rests: the call falls, the second voice climbs back in the gap. */
const K3_ANSWER = `. . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .
                 | . . . . . . . . . . . . . . . . | . . . . . . . . G5 - E5 - C5 - - -
                 | . . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .
                 | . . . . . . . . . . . . . . . . | . . . . . . . . A5 - F#5 - D5 - - -`;

/**
 * K4, the bridge (Em Cmaj7 Fmaj7 Fmaj7 Am7 G D D): long low notes, each leaning on its neighbour
 * a semitone off.
 */
const K4 = `B4 - - - C5 - - - B4 - - - - - - - | G4 - - - - - - - F#4 - - - E4 - - -
          | C5 - - - B4 - - - C5 - - - - - - - | G4 - - - - - - - . . . . . . . .
          | D5 - - - - - - - B4 - - - C5 - - - | B4 - - - A4 - - - G4 - - - - - - -
          | A4 - - - - - - - . . . . F#4 - - - | D4 - - - - - - - . . . . . . . .`;

// ——— Sunset Strip (outrun): B flat major. Wide leaps and long notes sung down from the top
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
          | C6 - - - - - F5 - - - A5 - - - - - | G5 - - - - - - - C6 - - - - - - -
          | Bb5 - - Bb5 - - G5 - - - D6 - - - - - | - - - - C6 - - - Bb5 - - - G5 - - -
          | G5 - - - - - Bb5 - - - G5 - - - F5 - | F5 - - - - - - - . . . . . . . .`;

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
const S3 = `D6 - - - C6 - Bb5 - | A5 - - - Bb5 - - - | C6 - - - A5 - F5 - | G5 - - - - - - -
             | - - Bb5 - - - D6 - | - - - - C6 - Bb5 - | G5 - - Bb5 - - C6 - | Bb5 - - - - - G5 A5`;

/** S3's harmony below it. */
const S3_THIRDS = `Bb5 - - - A5 - G5 - | F5 - - - G5 - - - | A5 - - - F5 - D5 - | Eb5 - - - - - - -
                    | D5 - G5 - - - Bb5 - | - - - - A5 - G5 - | Eb5 - - G5 - - G5 - | G5 - - - - - Eb5 F5`;

/** W2, the bridge (Ebmaj7 Cm7 Cm7 Dm7 Gm7 Gm7 Dm7 D): falling fifths and sixths, held long. */
const W2 = `D6 - - - - - - - G5 - - - - - - - | Bb5 - - - A5 - - - G5 - - - - - - -
          | Bb5 - - - - - - - G5 - - - - - - - | F5 - - - - - - - D6 - - - - - - -
          | - - - - C6 - - - Bb5 - - - F5 - - - | D6 - - - - - - - . . . . . . . .
          | C6 - - - A5 - - - F5 - - - C6 - - - | A5 - - - - - - - . . . . . . . .`;

// ——— Summer Plaza (memphis): city pop in D major, a band rather than a synth. A note struck off
// the beat and repeated, slid into from a semitone below, falls by thirds, short calls; the royal
// road (IVmaj7–V–iii7–vi7) for the verses, a fusion groove falling a step a bar for the chorus ———

/** Chord tones in five Euclidean hits a bar, a four-note cell so each bar starts elsewhere. */
const ROYAL_ROAD = cycle(
  [
    { cell: ['D4', 'F#4', 'G4', 'B4'], bars: 1 },
    { cell: ['C#4', 'E4', 'A4', 'C#5'], bars: 1 },
    { cell: ['C#4', 'E4', 'F#4', 'A4'], bars: 1 },
    { cell: ['D4', 'F#4', 'A4', 'B4'], bars: 1 },
    { cell: ['D4', 'E4', 'G4', 'B4'], bars: 1 },
    { cell: ['D4', 'E4', 'G4', 'A4'], bars: 1 },
    { cell: ['C#4', 'D4', 'F#4', 'A4'], bars: 2 },
  ],
  euclid(5, 16),
);

/** The chorus groove: a slapped three-note bass in seven hits a bar, a pluck in nine. */
const FUSION_CHORDS = [
  { bass: ['A1', 'A2', 'E2'], arp: ['E4', 'G#4', 'A4', 'C#5'] },
  { bass: ['G#1', 'G#2', 'D#2'], arp: ['D#4', 'F#4', 'G#4', 'B4'] },
  { bass: ['F#1', 'F#2', 'C#2'], arp: ['C#4', 'E4', 'F#4', 'A4'] },
  { bass: ['E1', 'E2', 'B1'], arp: ['D#4', 'E4', 'G#4', 'B4'] },
  { bass: ['A1', 'A2', 'E2'], arp: ['E4', 'G#4', 'A4', 'C#5'] },
  { bass: ['G#1', 'G#2', 'D#2'], arp: ['D#4', 'F#4', 'G#4', 'B4'] },
  { bass: ['F#1', 'F#2', 'C#2'], arp: ['C#4', 'E4', 'F#4', 'A4'] },
  { bass: ['B1', 'B2', 'F#2'], arp: ['E4', 'F#4', 'A4', 'B4'] },
];
const FUSION = {
  bass: cycle(
    FUSION_CHORDS.map(({ bass }) => ({ cell: bass, bars: 1 })),
    euclid(7, 16),
  ),
  arp: cycle(
    FUSION_CHORDS.map(({ arp }) => ({ cell: arp, bars: 1 })),
    euclid(9, 16, 1),
  ),
};

/** A muted guitar cutting between the beats every half bar, after Tatsuro Yamashita's "Sparkle". */
const CUTTING = [false, false, true, false, false, true, false, true];

/** The guitar's two-note cuts over the royal road, a bar each (the last chord two). */
const CHOP_CELLS: Stretch[] = [
  { cell: ['B4', 'F#4'], bars: 1 },
  { cell: ['A4', 'E4'], bars: 1 },
  { cell: ['A4', 'F#4'], bars: 1 },
  { cell: ['B4', 'F#4'], bars: 1 },
  { cell: ['G4', 'D4'], bars: 1 },
  { cell: ['G4', 'D4'], bars: 1 },
  { cell: ['A4', 'F#4'], bars: 2 },
];

/** The fusion groove moved down a tone into D, and the guitar's cutting over the royal road. */
const PLAZA = {
  chops: cycle(CHOP_CELLS, CUTTING),
  /** The intro's four bars of it. */
  introChops: cycle(CHOP_CELLS.slice(0, 4), CUTTING),
  bass: transpose(FUSION.bass, -2),
  arp: transpose(FUSION.arp, -2),
};

/** Q0, the intro (Gmaj7 A F#m7 Bm7): the electric piano's lick, answered by its own echo. */
const Q0 = `. . . . . . . . . . . F#5 - . G5 . | A5 - - . . . . . . . . . . . . .
          | . . . . . . . . . . . E5 - . F#5 . | D5 - - . . . . . . . . . . . . .`;

/** Q1, the verse (the royal road): a note struck off the beat three times, falling. */
const Q1 = `. . . F#5 - . F#5 - . F#5 - E5 - . D5 - | E5 - - - . . . . . . D#5 E5 - - - -
          | . . . A5 - . A5 - . A5 - G#5 - . F#5 - | D5 - - - . . . . . . . C#5 D5 - - -
          | B5 - G5 - E5 - G5 - B5 - - - A5 - - - | G5 - E5 - D5 - - - . . . . E5 - D5 -
          | F#5 - - - - - - E5 - - F#5 - - - . . | A5 - - - - - - - . . . . . . . .`;

/** Q2, the second verse: a two-note call and its answer, then held notes and a fall to D. */
const Q2 = `B5 - . G5 - . . . . . . . . . . . | . . . . . . . . E5 - C#5 - E5 - A5 -
          | A5 - . F#5 - . . . . . . . . . . . | . . . . . . . . F#5 - D5 - F#5 - B5 -
          | G5 - - - - - E5 - - - - - D5 - - - | E5 - - - - - - - . . . . . . . .
          | . . C#6 . . A5 . . F#5 - - - - - - - | . . . . . . . . E5 - - - D5 - - -`;

/** Q3, the chorus (Gmaj7 F#m7 Em7 Dmaj7 Gmaj7 F#m7 Em7 A7sus4): 3+3 and a fall. */
const Q3 = `F#5 - - F#5 - - F#5 - - - E5 - D5 - - - | E5 - - - - - - - . . . . . . . .
          | G5 - - G5 - - G5 - - - F#5 - E5 - - - | F#5 - - - - - - - . . . . . . . .
          | B5 - - - A5 - - - F#5 - - - D5 - - - | C#6 - - - A5 - - - . . F#5 - . . E5 -
          | E5 - - - G5 - - - - - - - F#5 - - - | E5 - - - - - - - D5 - - - - - - -`;

/** Q3's harmony below it, on brass. */
const Q3_UNDER = `D5 - - D5 - - D5 - - - C#5 - B4 - - - | C#5 - - - - - - - . . . . . . . .
                | E5 - - E5 - - E5 - - - D5 - C#5 - - - | D5 - - - - - - - . . . . . . . .
                | G5 - - - F#5 - - - D5 - - - B4 - - - | A5 - - - F#5 - - - . . D5 - . . C#5 -
                | C#5 - - - E5 - - - - - - - D5 - - - | A4 - - - - - - - B4 - - - - - - -`;

/** Q4, the bridge riff on the guitar: notes slid into from below, then even eighths. */
const Q4 = `. . D5 . . D5 . C#5 D5 . . . B4 . . . | . . C#5 . . C#5 . C5 C#5 . . . A4 . . .
          | . . B4 . . B4 . A#4 B4 . . . G4 . . . | A4 - - - - - - - . . . . . . . .
          | F#5 . D5 . B4 . D5 . F#5 . . . . . . . | . . . . . . . . E5 . C#5 . A4 . C#5 .
          | D5 - - - B4 - - - G4 - - - B4 - - - | E5 - - - - - - - . . . . . . . .`;

/** Q5, the sax solo over the royal road: falling, a blue note slid up, a 3+3+3, a held D6. */
const Q5 = `. . . . . . . . B5 - - A5 - - F#5 - | E5 - - - - - F5 F#5 - - - - E5 - C#5 -
          | A5 - . A5 - . A5 - . C#6 - - - . . . | B5 - - - A5 - F#5 - - - - - . . . .
          | . . G5 . E5 . D5 . E5 - - - G5 - - - | A5 - - - - - G5 - - - E5 - - - D5 -
          | F#5 - - - - - - - C#6 - - - A5 - - - | D6 - - - - - - - . . . . . . . .`;

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
                | F4 - - - Gb4 - - - F4 - - - Db5 - - - | C5 - - - - - - - Ab4 - - - - - - -
                | Db5 - - - C5 - - - Bb4 - - - F5 - - - | F5 - - - - - - - Eb5 - - - Db5 - - -
                | E5 - - - - - - - . . . . G4 - - - | C5 - - - - - - - . . . . . . . .`;

/**
 * R2, the shamisen's riff (Fm Gbmaj7 Db Bbm7 Bbm Gbmaj7 C C), the Japanese quarter's voice in
 * the city's iron: a call jerking between the root and its octave in 3+3+2, answered every
 * other bar by a line gliding down by step on held notes.
 */
const R2_LEAP = `F4 - - F5 - - C5 - Ab4 - - Ab4 - - F4 - | Db5 - - - - - - - Bb4 - - - Ab4 - Gb4 -
               | Db5 - - Db5 - - Ab4 - F4 - - F5 - - Eb5 - | Db5 - - - - - C5 - - - Bb4 - - - - -
               | Bb4 - - F5 - - Db5 - Bb4 - - F5 - - Db5 - | Gb5 - - - - - F5 - - - Db5 - - - - -
               | C5 - - C5 - - G4 - E4 - - - G4 - - - | G4 - - - - - - - C5 - - - - - - -`;

/**
 * The riff's calls alone, every other bar, under the second verse's march (Fm Fm Db Db Bbm Bbm C
 * C): the glides kept for the chorus.
 */
const R2_CALLS = `F4 - - F5 - - C5 - Ab4 - - Ab4 - - F4 - | . . . . . . . . . . . . . . . .
                | Db5 - - Db5 - - Ab4 - F4 - - F5 - - Eb5 - | . . . . . . . . . . . . . . . .
                | Bb4 - - F5 - - Db5 - Bb4 - - F5 - - Db5 - | . . . . . . . . . . . . . . . .
                | C5 - - C5 - - G4 - E4 - - - G4 - - - | . . . . . . . . . . . . . . . .`;

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
 * The bridge's koto (Db Gbmaj7 Bbm Ebm7 Ab Fm C C): an in-scale phrase falling, plucked bare,
 * over the furthest the song strays — to A flat, the relative major, and back.
 */
const KOTO_RAIN = `Ab5 - - - F5 - Gb5 F5 | Db5 - - - - - - - | F5 - - - Db5 - Eb5 Db5 | Bb4 - - - - - - -
                 | C5 - - - - - Db5 C5 | Ab4 - - - G4 - F4 - | E5 - - - G5 - - - | C5 - - - - - - -`;

// ——— Above the Clouds (fuji): D major on the Japanese yo pentatonic, 96 BPM. Dawn over the
// mountain, the clouds below: a shakuhachi's long notes, each reached by a quick turn it slides
// through, a koto's ostinato, a big pad on open, suspended chords rather than the West's
// sevenths, the kabuki's clappers striking faster into the festival drums at the peak, and a
// valley in the shadow of the in-scale, the darker Japanese mode ———

/** The koto's ostinato: four notes of each chord in eighths, two bars each (D Bm7 G Asus4). */
const KOTO_DAWN = cycle(
  [
    { cell: ['D5', 'A4', 'E5', 'A4'], bars: 2 },
    { cell: ['B4', 'F#4', 'D5', 'F#4'], bars: 2 },
    { cell: ['G4', 'D5', 'B4', 'D5'], bars: 2 },
    { cell: ['A4', 'E5', 'D5', 'E5'], bars: 2 },
  ],
  euclid(8, 16),
);

/** The ostinato's last four bars (G Asus4), climbing with the drums into the chorus. */
const KOTO_CLIMB = cycle(
  [
    { cell: ['G4', 'D5', 'B4', 'D5'], bars: 2 },
    { cell: ['A4', 'E5', 'D5', 'E5'], bars: 2 },
  ],
  euclid(8, 16),
);

/** V1, the verse (D D Bm7 Bm7 G G Asus4 A): long notes, each next one reached by a turn. */
const V1_DAWN = `A5 - - - - - - - - - - - E5 D5 E5 - | F#5 - - - - - - - - - - - . . . .
               | B5 - - - - - - - A5 - B5 - . . . . | F#5 - - - - - - - - - - - E5 F#5 E5 -
               | D5 - - - - - - - - - - - E5 D5 B4 - | G5 - - - - - - - . . . . . . . .
               | E5 - - - - - - - D5 - - - B4 - A4 - | A4 - - - - - - - . . . . . . . .`;

/**
 * C1, the chorus (D Asus4 Bm7 Esus4 Gadd9 Em7 Asus4 A): a 3+3+2 call climbing the pentatonic to
 * D6, falling home.
 */
const C1_DAWN = `D5 - - - - - A5 - - - - - F#5 - - - | E5 - - - - - D5 - - - - - . . . .
               | B4 - - - - - F#5 - - - - - D5 - - - | E5 - - - - - D5 - - - - - B4 - A4 -
               | G5 - - - - - D6 - - - - - B5 - - - | A5 - - - - - G5 - - - E5 - D5 - - -
               | E5 - - - D5 - - - E5 - - - A5 - - - | A5 - - - - - - - . . . . . . . .`;

/**
 * The valley (Gsus2 Gsus2 Gm Gm Ebmaj7 Ebmaj7 Dsus4 Asus4): the chorus's opening two bars, then
 * an answer in the in-scale, falling to the E flat and sighing down its semitone onto D.
 */
const VALLEY_SHADOW = `D5 - - - - - A5 - - - - - F#5 - - - | E5 - - - - - D5 - - - - - . . . .
                     | . . . . Bb5 - - - - - A5 - - - - - | G5 - - - - - - - . . . . . . . .
                     | G5 - - - - - Eb5 - - - - - D5 - - - | Bb4 - - - - - - - . . . . . . . .
                     | . . . . A4 - - - - - G4 - - - - - | A4 - - - - - - - . . . . . . . .`;

/** The koto answering C1 in its rests: a pentatonic drop of four notes. */
const C1_ANSWER = `. . . . . . . . . . . . . . . . | . . . . . . . . . . . . A4 F#4 E4 D4
                 | . . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .
                 | . . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .
                 | . . . . . . . . . . . . . . . . | . . . . . . . . . . . . E5 C#5 B4 A4`;

// ——— Firefly Temple (jungle): A dorian, 110 BPM. Night at a Khmer temple in the jungle (Koh
// Ker), fireflies: a pinpeat ensemble in the game's sound — the roneat's xylophone (the
// marimba) on a pulse of three sixteenths across the four beats, the kong vong's gong circle
// (the gamelan) interlocking between its notes, the melody on the pentatonic, the chhing's
// cymbals keeping time, the skor's barrel drum and the sampho's hand drum ———

/** The marimba: a note every three sixteenths, crossing the bar (Am7 D Am7 D Em7 G Am7 Am7). */
const MARIMBA_PULSE = pulse(
  [
    { cell: ['A5', 'E5', 'G5', 'C6'], bars: 4 },
    { cell: ['B5', 'E5', 'G5', 'D6'], bars: 2 },
    { cell: ['A5', 'E5', 'G5', 'C6'], bars: 2 },
  ],
  3,
);

/** The gong circle between the marimba's notes, a sixteenth after each: the two interlock. */
const GONG_PULSE = pulse(
  [
    { cell: ['E5', 'C5', 'D5', 'A4'], bars: 1 },
    { cell: ['D5', 'A4', 'F#4', 'E5'], bars: 1 },
    { cell: ['E5', 'C5', 'D5', 'A4'], bars: 1 },
    { cell: ['D5', 'A4', 'F#4', 'E5'], bars: 1 },
    { cell: ['B4', 'G4', 'E5', 'D5'], bars: 1 },
    { cell: ['D5', 'B4', 'G4', 'A4'], bars: 1 },
    { cell: ['E5', 'C5', 'D5', 'A4'], bars: 2 },
  ],
  3,
  1,
);

/**
 * F1, the verse's melody (Am7 D Am7 D Em7 G Am7 Am7), below the marimba and on the pentatonic
 * of the Khmer and their neighbours (A C D E G): a three-note call in 3+3+2, the jungle
 * answering it from further off — sung on a reedy pulse wave, as the pinpeat's oboe sings.
 */
const F1_CALL = `E4 - - G4 - - A4 - . . . . . . . . | . . . . A4 - - E4 - - D4 - - - - -
               | E4 - - G4 - - C5 - . . . . . . . . | . . . . C5 - - A4 - - E4 - - A4 - -
               | G4 - - D5 - - E5 - - - - - D5 - A4 - | D5 - - - - - A4 - - G4 - - E4 - - -
               | . . . . E4 - - G4 - - A4 - - - - - | C5 - - - D5 - - - A4 - - - - - - -`;

/**
 * G1, the temple bells on the gamelan (Am7 D Am7 D C G Fadd9 Am7): repeated notes, fourths, a
 * 3+3+2, up to D6 and home.
 */
const G1_BELLS = `E5 - - - E5 - A5 - | F#5 - - E5 - - D5 - | E5 - - - E5 - C6 - | A5 - - - - - - -
                | G5 - B5 - D6 - - - | D6 - - B5 - - G5 - | A5 - - - - - E5 G5 | A5 - - - - - - -`;

/**
 * The soundtrack. Every song has a calm part for the menus, parts to play over and a peak for
 * the hottest rallies, and the conductor moves between them as the match heats up and cools
 * down — but each track is built its own way: its form, the length of its parts, its intro, its
 * beat, its kit, how it climbs to its peak and how it marks its turns (5.6a: three tracks built
 * on one template sounded like one song). See SectionDef for the notation.
 */
const SONG_DEFS: SongDef[] = [
  {
    // After Perturbator: a cinematic sixteen-bar intro of the arpeggios alone over a bass drone,
    // two verses, a four-bar riser into a four-on-the-floor chorus with a drop, a breakdown that
    // teases the hook on a bell, a half-time bridge; the melody low, the arpeggios over it
    title: 'Neon Cathedral',
    bpm: 124,
    swing: 0,
    level: -0.5,
    scene: 'lasers',
    kit: 'dark',
    transitions: 'synth',
    // The cathedral's long stone tail on the choir and the beams; the bass and pads pump in full
    // under the kick, the machine the darksynth is
    room: 'cathedral',
    pump: 1,
    // The FM bass fed lightly into the saturation: a rubbery attack settling round, clean under
    // the choir and the beams, not a second wall of distortion under the distorted kick
    grit: -6,
    // A wordless choir holds the chords in place of the synth pad: the cathedral the name promises
    voices: { lead: 'brass', counter: 'saw', arp: 'arpPulse', bass: 'bassFm', pad: 'choir' },
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
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Em | Em | C | C | Am | Am | B | B',
        lead: K1,
        leadVoice: 'pwm',
        arpLine: cycle(octaveUp(HYPNOTIC_CELLS), ARP_RHYTHM.seven),
        bassLine: HYPNOTIC_BASS,
        drums: 'drive',
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
        counter: K2_CHOIR,
        arpLine: cycle(octaveUp(HYPNOTIC_CELLS), ARP_RHYTHM.eleven),
        bassLine: HYPNOTIC_BASS,
        drums: 'darkdrive',
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
        name: 'chorus',
        tier: 'high',
        chords: 'Em | Em | C | C | G | G | D | D',
        lead: K3,
        counter: K3_ANSWER,
        arpLine: cycle(octaveUp(CATHEDRAL_CELLS)),
        bass: 'drive',
        drums: 'darkdrive',
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
      },
      {
        // The dark beat at half speed: heavy, the hats still running, and the harmony going down
        // into the crypt — the F a semitone over the home E
        name: 'bridge',
        tier: 'groove',
        chords: 'Em | Cmaj7 | Fmaj7 | Fmaj7 | Am7 | G | D | D',
        lead: K4,
        leadVoice: 'sync',
        arpLine: cycle(octaveUp(CRYPT_CELLS), ARP_RHYTHM.eighths),
        bass: 'long',
        drums: 'darkdrive',
        feel: 'half',
        fill: 'stop',
        pad: 'hold',
        sweep: { arp: [0.3, 1.4], pads: [0.7, 1.2] },
      },
    ],
  },
  {
    // After The Midnight and FM-84: a night drive. The engine idles from the first bar — kick,
    // hats, the bass in eighths under the seven-note arpeggio — then a sixteen-bar verse on the
    // anthem beat (a kick on one and three, the gated snare on two and four), toms and a reverse
    // crash into the sax's chorus, the koto's bridge, and an outro that fades on the vibraphone.
    // Cymbals and drums mark the turns, no synth swells
    title: 'Sunset Strip',
    bpm: 100,
    swing: 0,
    level: 1,
    scene: 'outrun',
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
        // The electric piano drives alone for eight bars; then the passenger's voice joins it
        lead: W1,
        counter: W1_UNDER,
        arpLine: cycle([...SUNSET_CELLS, ...SUNSET_TURN_CELLS], ARP_RHYTHM.nine),
        bass: 'eighths',
        drums: 'anthem',
        fill: 'toms',
        pad: 'hold',
        layers: { lead: 0.3, counter: 0.3 },
        enter: { counter: 8 },
        sweep: { arp: [0.4, 1.4] },
      },
      {
        // Two bars of toms under a reverse crash
        name: 'build',
        tier: 'rise',
        chords: 'Eb | F',
        arp: 'up',
        bass: 'drive',
        drums: 'anthem',
        fill: 'toms',
        pad: 'hold',
        riser: true,
      },
      {
        name: 'chorus',
        tier: 'high',
        // A chord a bar where the verse holds each for two: the harmony speeds up at the peak
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
        drop: true,
      },
      {
        name: 'bridge',
        tier: 'groove',
        chords: 'Ebmaj7 | Cm7 | Cm7 | Dm7 | Gm7 | Gm7 | Dm7 | D',
        lead: W2,
        leadVoice: 'koto',
        arpLine: cycle(SUNSET_DUSK_CELLS, ARP_RHYTHM.eighths),
        bass: 'walk',
        drums: 'break',
        fill: 'stop',
        pad: 'hold',
        layers: { lead: 0.3 },
        sweep: { arp: [0.4, 1.4], pads: [0.7, 1.2] },
      },
      {
        name: 'verse2',
        tier: 'groove',
        chords: 'Bb | Bb | F | F | Gm | Gm | Eb | Eb',
        lead: W1,
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
    // After Tatsuro Yamashita, Mariya Takeuchi and Casiopea: a band in a room, not a synth. Four
    // bars count it in — the electric piano's lick, the guitar cutting, hats and a shaker — then
    // verses on the royal road with no pad at all, a four-bar pre-chorus of brass and a snare
    // roll into a live funk chorus (a sax over brass), the guitar's riff, a quiet interlude, a sax
    // solo, and the last chorus a semitone up, in E flat. No swells or sweeps: the band plays
    // every turn
    title: 'Summer Plaza',
    bpm: 112,
    swing: 0.1,
    level: 4.5,
    scene: 'memphis',
    kit: 'band',
    transitions: 'band',
    // A band in a small, nearly dry studio, and no sidechain: a slap bass breathes by its own
    // playing, pumping under the kick would turn the band into a dance track
    room: 'studio',
    pump: 0,
    // A slapped bass in place of the FM one; strings for the chords where there are any (the
    // pre-choruses, the choruses, the interlude), as a disco section plays them
    voices: { lead: 'epiano', counter: 'guitar', arp: 'pluck', bass: 'bassSlap', pad: 'strings' },
    form: [
      'intro',
      'verse',
      'verse2',
      'pre',
      'chorus',
      'bridge',
      'interlude',
      'solo',
      'verse',
      'pre2',
      'chorus2',
    ],
    sections: [
      {
        // The tape starts: the hats and the guitar, the electric piano's lick, the bass on the third
        name: 'intro',
        tier: 'calm',
        chords: 'Gmaj7 | A | F#m7 | Bm7',
        lead: Q0,
        counter: PLAZA.introChops,
        bass: 'funk',
        drums: 'bandIntro',
        pad: 'none',
        enter: { bass: 2 },
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Gmaj7 | A | F#m7 | Bm7 | Em7 | A7sus4 | Dmaj7 | Dmaj7',
        lead: Q1,
        counter: PLAZA.chops,
        arpLine: ROYAL_ROAD,
        bass: 'funk',
        drums: 'citypop',
        fill: 'stop',
        pad: 'none',
        stabs: 'offbeat',
        layers: { lead: 0.3, counter: 0.2, arp: 0.5 },
        enter: { arp: 4 },
        sweep: { arp: [0.4, 1.3] },
      },
      {
        name: 'verse2',
        tier: 'groove',
        chords: 'Gmaj7 | A | F#m7 | Bm7 | Em7 | A7sus4 | Dmaj7 | Dmaj7',
        lead: Q2,
        leadVoice: 'vibes',
        counter: PLAZA.chops,
        arpLine: ROYAL_ROAD,
        bass: 'funk',
        drums: 'citypop',
        fill: 'toms',
        pad: 'none',
        layers: { lead: 0.3, counter: 0.2, arp: 0.5 },
        sweep: { arp: [0.5, 1.4] },
      },
      {
        // Four bars of brass pushing up the chords, the bass walking, a snare roll at the end
        name: 'pre',
        tier: 'rise',
        chords: 'Em7 | F#m7 | Gmaj7 | A7sus4',
        bass: 'walk',
        drums: 'band',
        fill: 'roll',
        pad: 'hold',
        stabs: 'push',
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'Gmaj7 | F#m7 | Em7 | Dmaj7 | Gmaj7 | F#m7 | Em7 | A7sus4',
        lead: Q3,
        leadVoice: 'sax',
        counter: Q3_UNDER,
        counterVoice: 'brass',
        enter: { counter: 4 },
        arpLine: PLAZA.arp,
        bassLine: PLAZA.bass,
        drums: 'band',
        fill: 'toms',
        pad: 'hold',
        stabs: 'push',
        drop: true,
      },
      {
        name: 'bridge',
        tier: 'groove',
        chords: 'Gmaj7 | F#m7 | Em7 | Dmaj7 | Gmaj7 | F#m7 | Em7 | A7sus4',
        lead: Q4,
        leadVoice: 'guitar',
        arpLine: PLAZA.arp,
        bassLine: PLAZA.bass,
        drums: 'euclid',
        fill: 'stop',
        pad: 'none',
        layers: { lead: 0.3 },
        sweep: { arp: [0.5, 1.5] },
      },
      {
        // The band drops out: the chorus's opening on the vibraphone over held chords
        name: 'interlude',
        tier: 'calm',
        chords: 'Gmaj7 | F#m7 | Em7 | Dmaj7 | Gmaj7 | F#m7 | Em7 | A7sus4',
        lead: tease(Q3),
        leadVoice: 'vibes',
        bass: 'long',
        drums: 'none',
        pad: 'swell',
        // A harp's glissando opens it, once
        hits: { harpGliss: 'X' + '.'.repeat(8 * STEPS_PER_BAR - 1) },
      },
      {
        name: 'solo',
        tier: 'groove',
        chords: 'Gmaj7 | A | F#m7 | Bm7 | Em7 | A7sus4 | Dmaj7 | Dmaj7',
        lead: Q5,
        leadVoice: 'sax',
        counter: PLAZA.chops,
        arpLine: ROYAL_ROAD,
        bass: 'funk',
        drums: 'citypop',
        fill: 'roll',
        pad: 'none',
        stabs: 'offbeat',
        layers: { lead: 0.3, counter: 0.2, arp: 0.5 },
        sweep: { arp: [0.5, 1.4] },
      },
      {
        // The pre-chorus a semitone up, turning the song into E flat for its last chorus
        name: 'pre2',
        tier: 'rise',
        chords: 'Fm7 | Gm7 | Abmaj7 | Bb7sus4',
        bass: 'walk',
        drums: 'band',
        fill: 'roll',
        pad: 'hold',
        stabs: 'push',
      },
      {
        name: 'chorus2',
        tier: 'high',
        chords: 'Abmaj7 | Gm7 | Fm7 | Ebmaj7 | Abmaj7 | Gm7 | Fm7 | Bb7sus4',
        lead: transpose(Q3, 1),
        leadVoice: 'sax',
        counter: transpose(Q3_UNDER, 1),
        counterVoice: 'brass',
        arpLine: transpose(PLAZA.arp, 1),
        bassLine: transpose(PLAZA.bass, 1),
        drums: 'band',
        fill: 'toms',
        pad: 'hold',
        stabs: 'push',
        drop: true,
      },
    ],
  },
  {
    // Cyberpunk industrial on a witch-house half-time: rain at night in Kabukicho, after
    // Cyberpunk 2077. A police radio crackles through the rain, then a music box steps through a
    // cold march over a gliding 808 that tears and a dark pad chopped into a rhythm; steel rings in
    // the street; in the second verse the shamisen's calls creep in under it, the beat cuts out in
    // stutters, and the chorus hits on iron — the shamisen's riff whole, leaping and gliding, a
    // pulse thrumming under it. The bridge is a koto alone, a siren far off; rain ticks open and
    // close it, a rain stick for a crash
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
        // The march on the celesta; the riff's calls creep in under it halfway, on the shamisen
        name: 'verse2',
        tier: 'groove',
        chords: 'Fm | Fm | Db | Db | Bbm | Bbm | C | C',
        lead: N1_MARCH,
        leadVoice: 'celesta',
        counter: R2_CALLS,
        bassLine: RAIN_808,
        drums: 'witch',
        fill: 'roll',
        pad: 'chop',
        layers: { lead: 0.3, counter: 0.3 },
        enter: { counter: 4 },
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
        // The riff whole on the shamisen, its calls and glides, the pulse thrumming under it; the
        // harmony finds the G flat the riff keeps leaning on
        name: 'chorus',
        tier: 'high',
        chords: 'Fm | Gbmaj7 | Db | Bbm7 | Bbm | Gbmaj7 | C | C',
        lead: R2_LEAP,
        leadVoice: 'shamisen',
        arpLine: IRON_PULSE,
        bassLine: NEON_808,
        drums: 'neonIron',
        fill: 'stop',
        // The pulse takes over the chopped pad's rhythm; the pad holds under it
        pad: 'hold',
        drop: true,
      },
      {
        // A koto alone over the held pad, the 808 gone: the Japanese insert, a siren far off
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
      },
    ],
  },
  {
    // Dawn over Fuji, the clouds below: the koto's ostinato and a big pad open it, a shakuhachi
    // sings long notes reached by quick turns, spacious half-time drums in the verse, the festival
    // beat (matsuri) — the odaiko's "don", the rim's "ka" — at the chorus, four bars of the
    // kabuki's clappers striking faster into it, a gong for a crash, and a valley where the
    // shakuhachi sings alone in the in-scale's shadow. Moving in sixteenths where the match plays,
    // so 96 BPM never drags a rally
    title: 'Above the Clouds',
    bpm: 96,
    swing: 0,
    level: -2.5,
    scene: 'fuji',
    kit: 'japan',
    transitions: 'drums',
    // Open air with far slopes answering late; the big pad all but still, the space it paints
    // not pulsing with the drums
    room: 'valley',
    pump: 0.2,
    // The shakuhachi slides through its turns, as the flute bends its notes with the breath
    voices: { lead: 'shakuhachi', counter: 'koto', arp: 'pluck', bass: 'bassFm', glide: 0.04 },
    form: ['intro', 'verse', 'verse2', 'build', 'chorus', 'valley', 'verse2', 'build', 'chorus'],
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'D | D | Bm7 | Bm7 | G | G | Asus4 | A',
        lead: tease(V1_DAWN),
        counter: KOTO_DAWN,
        bass: 'long',
        drums: 'none',
        pad: 'swell',
        enter: { lead: 4 },
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'D | D | Bm7 | Bm7 | G | G | Asus4 | A',
        lead: V1_DAWN,
        bass: 'long',
        drums: 'halftime',
        fill: 'taiko',
        pad: 'hold',
        layers: { lead: 0.3 },
      },
      {
        // The koto's ostinato joins the shakuhachi, the festival beat underneath
        name: 'verse2',
        tier: 'groove',
        chords: 'D | D | Bm7 | Bm7 | G | G | Asus4 | A',
        lead: V1_DAWN,
        counter: KOTO_DAWN,
        bass: 'sync',
        drums: 'matsuri',
        fill: 'taiko',
        pad: 'hold',
        layers: { lead: 0.3, counter: 0.2 },
        enter: { counter: 2 },
      },
      {
        // Four bars of the kabuki's clappers striking faster over the odaiko, a reverse crash into
        // the gong
        name: 'build',
        tier: 'rise',
        chords: 'G | G | Asus4 | A',
        counter: KOTO_CLIMB,
        bass: 'drive',
        drums: 'kabuki',
        fill: 'taiko',
        pad: 'hold',
        riser: true,
      },
      {
        name: 'chorus',
        tier: 'high',
        // A chord a bar where the verse holds each for two, open and suspended as a koto is tuned,
        // and up through E the verse never reaches: the sun clearing the peak
        chords: 'D | Asus4 | Bm7 | Esus4 | Gadd9 | Em7 | Asus4 | A',
        lead: C1_DAWN,
        counter: C1_ANSWER,
        bass: 'drive',
        drums: 'matsuri',
        fill: 'taiko',
        pad: 'hold',
        drop: true,
      },
      {
        // The drums gone: the shakuhachi alone over the pad, the chorus's opening slowly, and the
        // valley's shadow — the in-scale on D (D E flat G A B flat), the yo's dark twin: G minor,
        // E flat, D suspended — before the E of A suspended brings back the dawn
        name: 'valley',
        tier: 'calm',
        chords: 'Gsus2 | Gsus2 | Gm | Gm | Ebmaj7 | Ebmaj7 | Dsus4 | Asus4',
        lead: VALLEY_SHADOW,
        bass: 'long',
        drums: 'none',
        pad: 'swell',
      },
    ],
  },
  {
    // Night at a Khmer temple in the jungle, fireflies: the barrel drum and the hand drum open
    // it, the gong circle joins; in the verse a reed sings a call and its echo over the marimba,
    // which strikes a note every three sixteenths, three against four, landing somewhere new each
    // bar; in the second verse the gongs play between the marimba's notes, the two interlocking
    // as a pinpeat's do; the temple's bells carry the chorus over the marimba; a still break with
    // a swelling, backward pad. Every part its own beat, the chhing keeping time in all of them;
    // the drums mark the turns, no synth swells
    title: 'Firefly Temple',
    bpm: 110,
    swing: 0,
    level: 0.5,
    scene: 'jungle',
    kit: 'khmer',
    transitions: 'band',
    // A stone temple the hand drums and mallets ring in; no sidechain, the groove is the drums'
    // own
    room: 'stone',
    pump: 0,
    voices: { lead: 'gamelan', counter: 'gamelan', arp: 'pluck', bass: 'bassFm', pad: 'reverse' },
    form: ['intro', 'verse', 'build', 'chorus', 'verse2', 'break', 'build', 'chorus'],
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'Am7 | D | Am7 | D | Em7 | G | Am7 | Am7',
        counter: GONG_PULSE,
        bass: 'long',
        drums: 'temple',
        pad: 'swell',
        enter: { counter: 4, bass: 4 },
      },
      {
        // The call and its echo on the reed, the marimba's pulse under it
        name: 'verse',
        tier: 'groove',
        chords: 'Am7 | D | Am7 | D | Em7 | G | Am7 | Am7',
        lead: F1_CALL,
        leadVoice: 'pwm',
        counter: MARIMBA_PULSE,
        counterVoice: 'marimba',
        bass: 'sync',
        drums: 'tribal',
        fill: 'taiko',
        pad: 'none',
        layers: { lead: 0.3 },
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'Em7 | G',
        bass: 'gallop',
        drums: 'stampede',
        fill: 'taiko',
        pad: 'hold',
      },
      {
        name: 'chorus',
        tier: 'high',
        // The vamp opens out in its second half: C, G and F, the F a step outside the dorian
        chords: 'Am7 | D | Am7 | D | C | G | Fadd9 | Am7',
        lead: G1_BELLS,
        counter: MARIMBA_PULSE,
        counterVoice: 'marimba',
        bass: 'gallop',
        drums: 'ritual',
        fill: 'taiko',
        pad: 'hold',
        drop: true,
      },
      {
        // The hocket: the gong circle plays between the marimba's notes
        name: 'verse2',
        tier: 'groove',
        chords: 'Am7 | D | Am7 | D | Em7 | G | Am7 | Am7',
        lead: MARIMBA_PULSE,
        leadVoice: 'marimba',
        counter: GONG_PULSE,
        bass: 'sync',
        drums: 'canopy',
        fill: 'toms',
        pad: 'none',
        layers: { lead: 0.3, counter: 0.2 },
        enter: { counter: 2 },
      },
      {
        // The temple's stillness: no drums, the backward pad swelling, the bells' opening on the
        // marimba; the dorian's bright F sharp gives way to F, and the harmony steps up from D to
        // the build's E
        name: 'break',
        tier: 'calm',
        chords: 'Am7 | D | Fadd9 | Fadd9 | C | C | Dm7 | Dm7',
        lead: tease(G1_BELLS),
        leadVoice: 'marimba',
        bass: 'long',
        drums: 'none',
        pad: 'swell',
      },
    ],
  },
];

export const SONGS: Song[] = SONG_DEFS.map(compileSong);
