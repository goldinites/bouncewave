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

/**
 * The passenger's line under W1, from the verse's ninth bar: one or two long notes a bar, low,
 * moving against the melody — down where it climbs, up where it falls.
 */
const W1_UNDER = `F4 - - - D5 - - - | C5 - - - - - - - | A4 - - - C5 - - - | G4 - - - A4 - - -
                | Bb4 - - - D5 - - - | D5 - - - C5 - - - | Bb4 - - - G4 - - - | G4 - - - - - - -`;

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

/**
 * The soundtrack. Every song has a calm part for the menus, parts to play over and a peak for
 * the hottest rallies, and the conductor moves between them as the match heats up and cools
 * down — but each track is built its own way: its form, the length of its parts, its intro, its
 * beat, its kit, how it climbs to its peak and how it marks its turns (5.6a: three tracks built
 * on one template sounded like one song). See SectionDef for the notation.
 */
const SONG_DEFS: SongDef[] = [
  {
    // After Perturbator: a cinematic sixteen-bar intro of the arpeggios alone over a reese drone,
    // two verses, a four-bar riser into a four-on-the-floor chorus with a drop, a breakdown that
    // teases the hook on a bell, a half-time bridge; the melody low, the arpeggios over it
    title: 'Neon Cathedral',
    bpm: 124,
    swing: 0,
    level: -1,
    scene: 'lasers',
    kit: 'dark',
    transitions: 'synth',
    // A wordless choir holds the chords in place of the synth pad: the cathedral the name promises
    voices: { lead: 'brass', counter: 'saw', arp: 'arpPulse', bass: 'bassReese', pad: 'choir' },
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
        // The lights come on one by one: a single beam (the arpeggio), the reese drone under it,
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
        // The dark beat at half speed: heavy, the hats still running
        name: 'bridge',
        tier: 'groove',
        chords: 'Em | Em | C | C | G | G | D | D',
        lead: K4,
        leadVoice: 'sync',
        arpLine: cycle(octaveUp(CATHEDRAL_CELLS), ARP_RHYTHM.eighths),
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
    scene: 'outrun',
    transitions: 'drums',
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
        chords: 'Bb | Bb | F | F | Gm | Gm | Eb | Eb | Bb | Bb | F | F | Gm | Gm | Eb | Eb',
        // The electric piano drives alone for eight bars; then the passenger's voice joins it
        lead: W1,
        counter: W1_UNDER,
        arpLine: cycle(SUNSET_CELLS, ARP_RHYTHM.nine),
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
        chords: 'Bb | Bb | F | F | Gm | Gm | Eb | Eb',
        lead: S3,
        leadVoice: 'sax',
        counter: S3_THIRDS,
        enter: { counter: 4 },
        arpLine: cycle(SUNSET_CELLS),
        bass: 'drive',
        drums: 'anthem',
        fill: 'toms',
        pad: 'hold',
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
];

export const SONGS: Song[] = SONG_DEFS.map(compileSong);
