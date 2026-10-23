import { cycle, euclid, Stretch, transpose } from '@/audio/music/compose';
import { compileSong, Song, SongDef } from '@/audio/music/score';

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

/** K4, the bridge: long low notes, each leaning on its neighbour a semitone off. */
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

/** The same cells over the bridge's turn of the chords (Gm Eb Bb F). */
const SUNSET_TURN_CELLS: Stretch[] = [
  { cell: ['Bb3', 'D4', 'G4', 'Bb4', 'D5', 'Bb4', 'G4'], bars: 2 },
  { cell: ['Bb3', 'Eb4', 'G4', 'Bb4', 'Eb5', 'Bb4', 'G4'], bars: 2 },
  { cell: ['Bb3', 'D4', 'F4', 'Bb4', 'D5', 'Bb4', 'F4'], bars: 2 },
  { cell: ['A3', 'C4', 'F4', 'A4', 'C5', 'A4', 'F4'], bars: 2 },
];

/** W1, the verse (Bb Bb F F Gm Gm Eb Eb): wide leaps down from the top, held. */
const W1 = `D6 - - - - - F5 - - - Bb5 - - - - - | A5 - - - - - - - F5 - - - - - - -
          | C6 - - - - - F5 - - - A5 - - - - - | G5 - - - - - - - C6 - - - - - - -
          | Bb5 - - Bb5 - - G5 - - - D6 - - - - - | - - - - C6 - - - Bb5 - - - G5 - - -
          | G5 - - - - - Bb5 - - - G5 - - - F5 - | F5 - - - - - - - . . . . . . . .`;

/** S3, the chorus hook (soar): by step from D6, then tied over the bar and climbing, a 3+3+2. */
const S3 = `D6 - - - C6 - Bb5 - | A5 - - - Bb5 - - - | C6 - - - A5 - F5 - | G5 - - - - - - -
             | - - Bb5 - - - D6 - | - - - - C6 - Bb5 - | G5 - - Bb5 - - C6 - | Bb5 - - - - - G5 A5`;

/** S3's harmony below it. */
const S3_THIRDS = `Bb5 - - - A5 - G5 - | F5 - - - G5 - - - | A5 - - - F5 - D5 - | Eb5 - - - - - - -
                    | D5 - G5 - - - Bb5 - | - - - - A5 - G5 - | Eb5 - - G5 - - G5 - | G5 - - - - - Eb5 F5`;

/** W2, the bridge (Gm Gm Eb Eb Bb Bb F F): falling fifths and sixths, held long. */
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

/** The fusion groove moved down a tone into D, and the guitar's cutting over the royal road. */
const PLAZA = {
  chops: cycle(
    [
      { cell: ['B4', 'F#4'], bars: 1 },
      { cell: ['A4', 'E4'], bars: 1 },
      { cell: ['A4', 'F#4'], bars: 1 },
      { cell: ['B4', 'F#4'], bars: 1 },
      { cell: ['G4', 'D4'], bars: 1 },
      { cell: ['G4', 'D4'], bars: 1 },
      { cell: ['A4', 'F#4'], bars: 2 },
    ],
    CUTTING,
  ),
  bass: transpose(FUSION.bass, -2),
  arp: transpose(FUSION.arp, -2),
};

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

/**
 * The soundtrack. Every song has a part for each tier — calm intros and breakdowns for the
 * menu, a verse to play over, a short build and a chorus for the hottest rallies — and the
 * conductor moves between them as the match heats up and cools down. See SectionDef for the
 * notation.
 */
const SONG_DEFS: SongDef[] = [
  {
    // After Perturbator: two arpeggio processes turning across the beat, a reese bass, the dark
    // kit; the melody low and the arpeggios over it
    title: 'Neon Cathedral',
    bpm: 118,
    swing: 0,
    level: -1,
    scene: 'lasers',
    kit: 'dark',
    voices: { lead: 'brass', counter: 'saw', arp: 'arpPulse', bass: 'bassReese' },
    form: [
      'intro',
      'verse',
      'verse2',
      'breakdown',
      'build',
      'chorus',
      'bridge',
      'verse',
      'verse2',
      'breakdown',
      'build',
      'chorus',
      'bridge',
      'verse2',
    ],
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'Em | Em | C | C | G | G | D | D',
        arpLine: cycle(octaveUp(CATHEDRAL_CELLS), ARP_RHYTHM.eighths),
        bass: 'long',
        drums: 'none',
        pad: 'swell',
        sweep: { arp: [0.3, 1.1], pads: [0.6, 1] },
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
        sweep: { arp: [0.4, 1.5], pads: [0.7, 1.2] },
      },
      {
        name: 'verse2',
        tier: 'groove',
        chords: 'Em | Em | C | C | Am | Am | B | B',
        lead: K2,
        leadVoice: 'pluck',
        arpLine: cycle(octaveUp(HYPNOTIC_CELLS), ARP_RHYTHM.eleven),
        bassLine: HYPNOTIC_BASS,
        drums: 'darkdrive',
        fill: 'roll',
        pad: 'hold',
        layers: { lead: 0.3 },
        sweep: { arp: [0.6, 1.6] },
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
        name: 'build',
        tier: 'rise',
        chords: 'Am | B',
        arp: 'up',
        bass: 'pulse16',
        drums: 'drive',
        fill: 'roll',
        pad: 'hold',
        riser: true,
        sweep: { arp: [0.5, 2] },
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'Em | Em | C | C | G | G | D | D',
        lead: K3,
        arpLine: cycle(octaveUp(CATHEDRAL_CELLS)),
        bass: 'drive',
        drums: 'darkdrive',
        fill: 'toms',
        pad: 'hold',
        stabs: 'push',
        drop: true,
      },
      {
        name: 'bridge',
        tier: 'groove',
        chords: 'Em | Em | C | C | G | G | D | D',
        lead: K4,
        leadVoice: 'sync',
        arpLine: cycle(octaveUp(CATHEDRAL_CELLS), ARP_RHYTHM.eighths),
        bass: 'long',
        drums: 'four',
        fill: 'stop',
        pad: 'hold',
        layers: { drums: 0.35 },
        sweep: { arp: [0.3, 1.4], pads: [0.7, 1.2] },
      },
    ],
  },
  {
    // After The Midnight, FM-84 and Lazerhawk: the seven-note arpeggio, a DX7 electric piano and a
    // vibraphone in the verses, a sax with its soft harmony at the chorus, a koto in the bridge
    title: 'Sunset Strip',
    bpm: 112,
    swing: 0,
    scene: 'outrun',
    voices: { lead: 'epiano', counter: 'soft', arp: 'arpPulse', bass: 'bassFm' },
    form: [
      'intro',
      'verse',
      'verse2',
      'breakdown',
      'build',
      'chorus',
      'bridge',
      'verse',
      'verse2',
      'breakdown',
      'build',
      'chorus',
      'bridge',
      'verse2',
    ],
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'Bb | Bb | F | F | Gm | Gm | Eb | Eb',
        arpLine: cycle(SUNSET_CELLS, ARP_RHYTHM.eighths),
        bass: 'long',
        drums: 'none',
        pad: 'swell',
        sweep: { arp: [0.3, 1.1], pads: [0.6, 1] },
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Bb | Bb | F | F | Gm | Gm | Eb | Eb',
        lead: W1,
        arpLine: cycle(SUNSET_CELLS, ARP_RHYTHM.nine),
        bass: 'eighths',
        drums: 'outrun',
        fill: 'roll',
        pad: 'hold',
        layers: { lead: 0.3, drums: 0.3 },
        sweep: { arp: [0.4, 1.4] },
      },
      {
        name: 'verse2',
        tier: 'groove',
        chords: 'Bb | Bb | F | F | Gm | Gm | Eb | Eb',
        lead: W1,
        leadVoice: 'vibes',
        arpLine: cycle(SUNSET_CELLS, ARP_RHYTHM.eleven),
        bass: 'sync',
        drums: 'outrun',
        fill: 'toms',
        pad: 'hold',
        layers: { lead: 0.3 },
        sweep: { arp: [0.6, 1.5] },
      },
      {
        name: 'breakdown',
        tier: 'calm',
        chords: 'Bb | Bb | F | F | Gm | Gm | Eb | Eb',
        lead: tease(S3),
        leadVoice: 'koto',
        arpLine: cycle(SUNSET_CELLS, ARP_RHYTHM.quarters),
        bass: 'long',
        drums: 'halftime',
        pad: 'swell',
        silence: 4,
        sweep: { arp: [1.2, 0.4] },
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'Eb | F',
        arp: 'up',
        bass: 'drive',
        drums: 'drive',
        fill: 'roll',
        pad: 'hold',
        riser: true,
        sweep: { arp: [0.5, 2] },
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'Bb | Bb | F | F | Gm | Gm | Eb | Eb',
        lead: S3,
        leadVoice: 'sax',
        counter: S3_THIRDS,
        arpLine: cycle(SUNSET_CELLS),
        bass: 'drive',
        drums: 'outrun',
        fill: 'toms',
        pad: 'hold',
        stabs: 'push',
        drop: true,
      },
      {
        name: 'bridge',
        tier: 'groove',
        chords: 'Gm | Gm | Eb | Eb | Bb | Bb | F | F',
        lead: W2,
        leadVoice: 'koto',
        arpLine: cycle(SUNSET_TURN_CELLS, ARP_RHYTHM.eighths),
        bass: 'walk',
        drums: 'break',
        fill: 'stop',
        pad: 'hold',
        layers: { lead: 0.3 },
        sweep: { arp: [0.4, 1.4], pads: [0.7, 1.2] },
      },
    ],
  },
  {
    // After Tatsuro Yamashita, Mariya Takeuchi and Casiopea: a muted guitar cutting, a slapped
    // bass, the electric piano and the vibraphone for the verses, a sax over brass at the chorus,
    // the guitar's riff in the bridge, a sax solo in the second half
    title: 'Summer Plaza',
    bpm: 108,
    swing: 0.1,
    level: 1.5,
    scene: 'memphis',
    voices: { lead: 'epiano', counter: 'guitar', arp: 'pluck', bass: 'bassFm' },
    form: [
      'intro',
      'verse',
      'verse2',
      'breakdown',
      'build',
      'chorus',
      'bridge',
      'verse',
      'solo',
      'breakdown',
      'build',
      'chorus',
      'bridge',
      'verse2',
    ],
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'Gmaj7 | A | F#m7 | Bm7 | Em7 | A7sus4 | Dmaj7 | Dmaj7',
        counter: PLAZA.chops,
        arpLine: ROYAL_ROAD,
        bass: 'long',
        drums: 'none',
        pad: 'swell',
        sweep: { arp: [0.3, 1.1], pads: [0.6, 1] },
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
        pad: 'hold',
        stabs: 'offbeat',
        layers: { lead: 0.3, counter: 0.2, arp: 0.5 },
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
        pad: 'hold',
        layers: { lead: 0.3, counter: 0.2, arp: 0.5 },
        sweep: { arp: [0.5, 1.4] },
      },
      {
        name: 'breakdown',
        tier: 'calm',
        chords: 'Gmaj7 | F#m7 | Em7 | Dmaj7 | Gmaj7 | F#m7 | Em7 | A7sus4',
        lead: tease(Q3),
        leadVoice: 'vibes',
        arpLine: transpose(
          cycle(
            FUSION_CHORDS.map(({ arp }) => ({ cell: arp, bars: 1 })),
            ARP_RHYTHM.quarters,
          ),
          -2,
        ),
        bass: 'long',
        drums: 'halftime',
        pad: 'swell',
        silence: 4,
        sweep: { arp: [1.2, 0.4] },
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'Em7 | A7sus4',
        arp: 'up',
        bass: 'octave',
        drums: 'four',
        fill: 'roll',
        pad: 'hold',
        riser: true,
        sweep: { arp: [0.5, 2] },
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'Gmaj7 | F#m7 | Em7 | Dmaj7 | Gmaj7 | F#m7 | Em7 | A7sus4',
        lead: Q3,
        leadVoice: 'sax',
        counter: Q3_UNDER,
        counterVoice: 'brass',
        arpLine: PLAZA.arp,
        bassLine: PLAZA.bass,
        drums: 'disco',
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
        pad: 'hold',
        layers: { lead: 0.3 },
        sweep: { arp: [0.5, 1.5] },
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
        pad: 'hold',
        stabs: 'offbeat',
        layers: { lead: 0.3, counter: 0.2, arp: 0.5 },
        sweep: { arp: [0.5, 1.4] },
      },
    ],
  },
];

export const SONGS: Song[] = SONG_DEFS.map(compileSong);
