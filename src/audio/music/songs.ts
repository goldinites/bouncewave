import { additive, cycle, euclid, transpose } from '@/audio/music/compose';
import { compileSong, Song, SongDef } from '@/audio/music/score';

// ——— Lines written by processes (audio/music/compose.ts) ———

/** B: a five-note cell cycling over Em, C, Am and B, two bars each, and its pulsing bass. */
const HYPNOTIC = {
  arp: cycle([
    { cell: ['E4', 'G4', 'B4', 'E5', 'B4'], bars: 2 },
    { cell: ['E4', 'G4', 'C5', 'E5', 'C5'], bars: 2 },
    { cell: ['E4', 'A4', 'C5', 'E5', 'C5'], bars: 2 },
    { cell: ['D#4', 'F#4', 'B4', 'D#5', 'B4'], bars: 2 },
  ]),
  bass: `E1 . E1 . E2 . E1 . E1 . E1 . E2 . D2 . | E1 . E1 . E2 . E1 . E1 . E1 . E2 . G1 .
                 | C2 . C2 . C2 . G1 . C2 . C2 . G1 . B1 . | C2 . C2 . C2 . G1 . C2 . C2 . E2 . G1 .
                 | A1 . A1 . A2 . A1 . A1 . A1 . A2 . G1 . | A1 . A1 . A2 . A1 . A1 . A1 . E2 . A1 .
                 | B1 . B1 . B1 . F#1 . B1 . B1 . D#2 . F#2 . | B1 . B1 . B1 . F#1 . B1 . B1 . A1 . F#1 .`,
};

// ——— The Laser track's melodies, chosen on the stand (eighths: 8 a bar; sixteenths: 16) ———

/** M1, over Em Em C C Am Am B B: an arch of long notes reached by pickups. */
const M1 = `B4 - - - . G4 A4 B4 | E5 - - - D5 - B4 - | C5 - - - . A4 B4 C5 | G5 - - - E5 - - -
          | A5 - - - G5 - E5 - | E5 - - D5 C5 - B4 - | D#5 - - - F#5 - - - | B4 - - - - - - -`;

/** M2, over Em Em C C Am Am B B: a 3+3+2 figure of repeated notes, answered by climbing runs. */
const M2 = `E5 - - G5 - - F#5 - E5 - - - B4 - - - | . . D5 - E5 - F#5 - G5 - - - . . . .
          | E5 - - G5 - - D5 - C5 - - - G4 - - - | . . B4 - C5 - D5 - E5 - - - - - - -
          | A5 - - G5 - - E5 - G5 - - - E5 - - - | . . C5 - D5 - E5 - C5 - - - B4 - A4 -
          | D#5 - - F#5 - - B5 - A5 - - - F#5 - - - | D#5 - - - - - - - B4 - - - - - - -`;

/** M3, over Cm Cm Ab Ab Eb Eb Bb Bb: long aching notes, leaning off the chord and resolving down. */
const M3 = `G5 - - - - - Eb5 F5 | G5 - - - Bb5 - G5 - | C6 - - - - - Bb5 Ab5 | Bb5 - Ab5 - - - Eb5 -
          | G5 - - - - - Bb5 C6 | C6 - Bb5 - - - G5 - | F5 - - - D5 - - - | F5 - - - - - Eb5 F5`;

/** M4, over Cm Cm Ab Ab Eb Eb Bb Bb: a phrase, a rest for the arpeggios to answer, a climbing run. */
const M4 = `C5 - - Eb5 - - G5 - - - - - . . . . | . . Bb4 - C5 - D5 - Eb5 - - - D5 - C5 -
          | C5 - - Eb5 - - Ab5 - - - - - . . . . | . . G5 - Ab5 - Bb5 - C6 - - - Bb5 - Ab5 -
          | G5 - - - - - Eb5 - Bb5 - - - G5 - - - | . . F5 - G5 - Ab5 - G5 - - - F5 - Eb5 -
          | D5 - - F5 - - Bb5 - - - - - Ab5 - - - | G5 - - - F5 - - - D5 - - - - - - -`;

/**
 * The Laser track's material, in E minor (5.6a, chosen on the stand): B's five-note arpeggio
 * under M1 and M2, and B5's two arpeggios with M3 and M4 moved over from C minor — their chords
 * (Cm Ab Eb Bb) become Em C G D, the same key as B's.
 */
const CATHEDRAL = {
  arps: cycle([
    { cell: ['E4', 'G4', 'B4', 'E5', 'B4', 'G4'], bars: 2 },
    { cell: ['E4', 'G4', 'C5', 'E5', 'C5', 'G4'], bars: 2 },
    { cell: ['D4', 'G4', 'B4', 'D5', 'B4', 'G4'], bars: 2 },
    { cell: ['D4', 'F#4', 'A4', 'D5', 'A4', 'F#4'], bars: 2 },
  ]),
  // M3, down into the warm middle of the range
  ache: transpose(M3, -8),
  // M4, up for the chorus, its peak bar rewritten to top out at D6
  call: transpose(M4, 4)
    .split('|')
    .map((bar, i) => (i === 3 ? ' . . A5 - B5 - C6 - D6 - - - C6 - B5 - ' : bar))
    .join('|'),
};

// ——— The Outrun track's base, chosen on the stand ———

/** O3: a sunny seven-note up-and-down arpeggio in sixteenths, never landing the same (Bb F Gm Eb). */
const SUNSET = cycle([
  { cell: ['Bb3', 'D4', 'F4', 'Bb4', 'D5', 'Bb4', 'F4'], bars: 2 },
  { cell: ['A3', 'C4', 'F4', 'A4', 'C5', 'A4', 'F4'], bars: 2 },
  { cell: ['Bb3', 'D4', 'G4', 'Bb4', 'D5', 'Bb4', 'G4'], bars: 2 },
  { cell: ['Bb3', 'Eb4', 'G4', 'Bb4', 'Eb5', 'Bb4', 'G4'], bars: 2 },
]);

// ——— The Outrun track's melody, chosen on the stand, and what grows from it. It sits above the
// arpeggio's top (E flat 5), so the ear keeps the two apart ———

/** S3, soar, over Bb Bb F F Gm Gm Eb Eb: a singing line moving by step, leaning on the 7th and 9th. */
const S3 = `D6 - - - C6 - Bb5 - | A5 - - - Bb5 - - - | C6 - - - A5 - F5 - | G5 - - - - - - -
          | Bb5 - - - A5 - G5 - | F5 - - - G5 - - - | Bb5 - - - G5 - Eb5 - | F5 - - - - - G5 A5`;

/** S3's harmony a third below, for the chorus (the counter voice, under the melody). */
const S3_THIRDS = `Bb5 - - - A5 - G5 - | F5 - - - G5 - - - | A5 - - - F5 - D5 - | Eb5 - - - - - - -
                 | G5 - - - F5 - Eb5 - | D5 - - - Bb4 - - - | G5 - - - Eb5 - C5 - | D5 - - - - - Eb5 F5`;

/**
 * S3 turned upside down for the bridge, over Gm Gm Eb Eb Bb Bb F F: the motif climbs where it
 * fell, peaks on the major 7th of E flat, and S3's own head comes back to close it.
 */
const S3_TURNED = `G5 - - - A5 - Bb5 - | C6 - - - Bb5 - - - | G5 - - - Bb5 - C6 - | D6 - - - - - - -
                  | D6 - - - C6 - Bb5 - | A5 - - - Bb5 - - - | C6 - - - A5 - F5 - | G5 - - - A5 - - -`;

/** The sunset arpeggio over the bridge's turn of the chords (Gm Eb Bb F). */
const SUNSET_TURN = cycle([
  { cell: ['Bb3', 'D4', 'G4', 'Bb4', 'D5', 'Bb4', 'G4'], bars: 2 },
  { cell: ['Bb3', 'Eb4', 'G4', 'Bb4', 'Eb5', 'Bb4', 'G4'], bars: 2 },
  { cell: ['Bb3', 'D4', 'F4', 'Bb4', 'D5', 'Bb4', 'F4'], bars: 2 },
  { cell: ['A3', 'C4', 'F4', 'A4', 'C5', 'A4', 'F4'], bars: 2 },
]);

// ——— Bases for the Memphis backdrop's track, to choose between on the stand ———

/** P1: chord tones in five Euclidean hits a bar, a four-note cell so each bar starts elsewhere. */
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

/** P2: the cell growing from three notes to six and back, a chord to the bar (after Glass). */
const PLASTIC = [
  additive(['F4', 'A4', 'C5', 'E5', 'C5', 'A4'], [3]),
  additive(['E4', 'G#4', 'B4', 'D5', 'B4', 'G#4'], [4]),
  additive(['E4', 'A4', 'C5', 'E5', 'G4', 'C5'], [5, 6]),
  additive(['D4', 'F4', 'A4', 'C5', 'A4', 'F4'], [6]),
  additive(['D4', 'G4', 'B4', 'D5', 'B4', 'G4'], [5]),
  additive(['E4', 'G4', 'B4', 'C5', 'G4', 'E4'], [4]),
  additive(['E4', 'G#4', 'B4', 'D5', 'B4', 'G#4'], [3]),
].join(' | ');

/** P3: soft electric-piano comping in the tresillo (3+3+2), a four-note cell over six hits. */
const TWO_OF_US = cycle(
  [
    { cell: ['F4', 'Ab4', 'C5', 'Db5'], bars: 1 },
    { cell: ['E4', 'G4', 'Bb4', 'C5'], bars: 1 },
    { cell: ['F4', 'Ab4', 'C5', 'Eb5'], bars: 2 },
    { cell: ['F4', 'Ab4', 'C5', 'Db5'], bars: 1 },
    { cell: ['E4', 'G4', 'Bb4', 'C5'], bars: 1 },
    { cell: ['Gb4', 'Bb4', 'Db5', 'Eb5'], bars: 1 },
    { cell: ['Gb4', 'Ab4', 'C5', 'Eb5'], bars: 1 },
  ],
  euclid(3, 8),
);

/** P4: a slapped three-note bass in seven hits a bar against a four-note pluck in nine. */
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

/**
 * The soundtrack. Every song has a part for each tier — calm intros and breakdowns for the
 * menu, a verse to play over, a short build and a chorus for the hottest rallies — and the
 * conductor moves between them as the match heats up and cools down. See SectionDef for the
 * notation.
 */
const SONG_DEFS: SongDef[] = [
  {
    // A minor, the classic: a night drive down an empty highway
    title: 'Night Drive',
    bpm: 100,
    swing: 0,
    level: 1.5,
    voices: { lead: 'saw', counter: 'bell', arp: 'arpPulse', bass: 'bassSaw' },
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'Am9 | Fmaj7 | Cmaj7 | G6',
        counter: `E5 . . . . . B4 . | A4 . . . . . . . | G4 . . . . . E5 . | D5 . . . B4 . . .`,
        bass: 'long',
        arp: 'sparse',
        drums: 'pulse',
        pad: 'swell',
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Am7 | Fmaj7 | C | G | Am7 | Fmaj7 | Dm7 | Esus4 E',
        lead: `E5 - - A4 C5 - D5 - | C5 - A4 - . . G4 A4 | G4 - - E4 G4 - C5 - | B4 - - - . . . .
             | E5 - - A4 C5 - D5 - | E5 - F5 - E5 - C5 - | D5 - - C5 A4 - F4 - | A4 - - - G#4 - - -`,
        bass: 'octave',
        arp: 'broken',
        drums: 'four',
        fill: 'toms',
        pad: 'hold',
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'Dm7 | Esus4 E',
        lead: `F4 - A4 - D5 - F5 - | E5 - - - G#5 - B5 -`,
        bass: 'eighths',
        arp: 'up',
        drums: 'drive',
        fill: 'roll',
        pad: 'hold',
        riser: true,
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'F | G | Em7 Am7 | Am | F | G | Esus4 | E',
        lead: `A5 - - G5 F5 - E5 - | D5 - - - B4 - D5 - | E5 - G5 - A5 - C6 - | B5 - A5 - - - . .
             | A5 - - G5 F5 - E5 - | D5 - - - G5 - - - | A5 - G5 - E5 - D5 - | E5 - - - B4 - G#4 -`,
        bass: 'drive',
        arp: 'updown',
        drums: 'disco',
        fill: 'toms',
        pad: 'hold',
      },
      {
        name: 'breakdown',
        tier: 'calm',
        chords: 'Fmaj7 | G | Am7 | Am7',
        counter: `C5 . E5 . G5 . . . | B4 . D5 . G5 . . . | C5 . E5 . A5 . . . | G5 . E5 . . . . .`,
        bass: 'long',
        arp: 'pulse',
        drums: 'halftime',
        pad: 'swell',
      },
    ],
  },
  {
    // D dorian: the bright major IV gives it a hopeful, sunlit lift
    title: 'Chrome Heart',
    bpm: 112,
    swing: 0,
    level: 2,
    voices: { lead: 'square', counter: 'bell', arp: 'pluck', bass: 'bassFm' },
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'Dm9 | G6 | Dm9 | Bbmaj7',
        counter: `A4 . . . D5 . . . | B4 . . . . . . . | A4 . . . F5 . . . | D5 . . . . . . .`,
        bass: 'long',
        arp: 'pulse',
        drums: 'none',
        pad: 'swell',
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Dm7 | G | Dm7 | G | Bbmaj7 | C | Dm7 | Asus4 A',
        lead: `A4 . D5 . F5 - E5 D5 | B4 - - - D5 . B4 . | A4 . D5 . F5 - G5 A5 | G5 - - - . . . .
             | F5 - D5 - A4 - D5 - | E5 - - - G5 - E5 - | F5 - E5 - D5 - C5 - | D5 - - - C#5 - - -`,
        bass: 'sync',
        arp: 'up',
        drums: 'break',
        fill: 'stop',
        pad: 'hold',
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'Bbmaj7 | C',
        lead: `F4 . A4 . D5 . F5 . | G4 . C5 . E5 - G5 -`,
        bass: 'eighths',
        arp: 'up',
        drums: 'four',
        fill: 'roll',
        pad: 'hold',
        riser: true,
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'Dm | Bbmaj7 | F | C | Dm | Bbmaj7 | Gm7 | Asus4 A',
        lead: `D5 - - - F5 - A5 - | A5 - G5 - F5 - D5 - | C5 - - - F5 - A5 - | G5 - - - E5 - - -
             | D5 - - - F5 - A5 - | Bb5 - A5 - F5 - D5 - | G5 - F5 - D5 - Bb4 - | D5 - - - C#5 - E5 -`,
        bass: 'octave',
        arp: 'broken',
        drums: 'drive',
        fill: 'toms',
        pad: 'none',
        stabs: 'push',
      },
      {
        name: 'breakdown',
        tier: 'calm',
        chords: 'Bbmaj7 | Am7 | Gm7 | Asus4 A',
        counter: `D5 . F5 . A5 . . . | C5 . E5 . G5 . . . | Bb4 . D5 . F5 . . . | E5 . . . C#5 . . .`,
        bass: 'long',
        arp: 'sparse',
        drums: 'pulse',
        pad: 'swell',
      },
    ],
  },
  {
    // E minor at full throttle: a driving 16th bass and a harmonic-minor B7 pulling home
    title: 'Overdrive',
    bpm: 124,
    swing: 0,
    level: -0.5,
    voices: { lead: 'saw', counter: 'bell', arp: 'pluck', bass: 'bassSaw' },
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'Em | Fmaj7 | Em | Fmaj7',
        counter: `B4 . . . . . . . | C5 . . . A4 . . . | B4 . . . G4 . . . | E5 . . . . . . .`,
        bass: 'long',
        arp: 'pulse',
        drums: 'pulse',
        pad: 'swell',
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Em | C | Em | D | Em | C | Am | B7',
        lead: `E4 . E4 G4 - E4 B4 - | C5 - B4 - G4 - E4 - | E4 . E4 G4 - E4 B4 - | A4 - - - F#4 - D4 -
             | E5 - D5 - B4 - G4 - | C5 - - - E5 - G5 - | A4 - C5 - E5 - D5 C5 | B4 - - - D#5 - F#5 -`,
        bass: 'drive',
        arp: 'broken',
        drums: 'drive',
        fill: 'toms',
        pad: 'hold',
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'C | D',
        lead: `G4 . C5 . E5 . G5 . | A4 . D5 . F#5 . A5 .`,
        bass: 'drive',
        arp: 'up',
        drums: 'drive',
        fill: 'roll',
        pad: 'hold',
        riser: true,
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'Em | C | G | D | Em | C | Am | B7',
        lead: `B4 - - - E5 - G5 - | G5 - E5 - C5 - E5 - | D5 - - - G5 - B5 - | A5 - - - F#5 - - -
             | B5 - - - G5 - E5 - | E5 - G5 - C6 - B5 - | A5 - - - E5 - C5 - | B4 - D#5 - F#5 - A5 -`,
        bass: 'gallop',
        arp: 'cascade',
        drums: 'disco',
        fill: 'toms',
        pad: 'hold',
        stabs: 'offbeat',
      },
      {
        name: 'breakdown',
        tier: 'calm',
        chords: 'Cmaj7 | Am7 | Fmaj7 | Bsus4 B',
        counter: `E5 . G5 . B5 . . . | C5 . E5 . A5 . . . | A4 . C5 . E5 . . . | E5 . . . D#5 . . .`,
        bass: 'long',
        arp: 'sparse',
        drums: 'halftime',
        pad: 'swell',
      },
    ],
  },
  {
    // C major city pop: IV–V–iii–vi, swung, with a glassy bell singing the verse
    title: 'Sunset Boulevard',
    bpm: 92,
    swing: 0.12,
    level: 1.5,
    voices: { lead: 'bell', counter: 'pluck', arp: 'triangle', bass: 'bassFm' },
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'Fmaj9 | Em7 | Dm9 | G7sus4',
        lead: `A5 . . . G5 . . . | E5 . . . . . . . | F5 . . . E5 . . . | D5 . . . . . . .`,
        bass: 'long',
        arp: 'sparse',
        drums: 'none',
        pad: 'swell',
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Fmaj7 | G | Em7 | Am7 | Dm7 | G | Cmaj7 | C7',
        lead: `E5 - - - C5 - A4 C5 | D5 - - - B4 - G4 B4 | D5 - E5 - G5 - E5 - | C5 - - - . . A4 C5
             | F5 - - - E5 - D5 - | D5 - - - B4 - - - | G4 - B4 - E5 - - - | E5 - D5 - C5 - Bb4 -`,
        bass: 'walk',
        arp: 'pulse',
        drums: 'halftime',
        fill: 'stop',
        pad: 'hold',
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'Dm7 | G7sus4 G7',
        lead: `A4 - C5 - F5 - A5 - | G5 - - - F5 - D5 -`,
        leadVoice: 'saw',
        bass: 'sync',
        arp: 'up',
        drums: 'four',
        fill: 'roll',
        pad: 'hold',
        riser: true,
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'Fmaj7 | G | Em7 Am7 | Dm7 G | Fmaj7 | G | Cmaj7 | Cmaj7',
        lead: `A5 - - - G5 - E5 - | D5 - - - G5 - - - | G5 - - - E5 - - - | F5 - - - D5 - B4 -
             | A5 - - - G5 - E5 - | D5 - G5 - B5 - - - | C6 - - - B5 - G5 - | E5 - - - - - . .`,
        leadVoice: 'saw',
        bass: 'octave',
        arp: 'updown',
        drums: 'disco',
        fill: 'toms',
        pad: 'hold',
      },
      {
        name: 'breakdown',
        tier: 'calm',
        chords: 'Am7 | Em7 | Fmaj7 | G6',
        lead: `E5 . . . C5 . . . | B4 . . . G4 . . . | A4 . . . E5 . . . | D5 . . . B4 . . .`,
        bass: 'long',
        arp: 'pulse',
        drums: 'pulse',
        pad: 'swell',
      },
    ],
  },
  {
    // B minor, plucky and restless: 16th-note riffs ringing through the echo
    title: 'Laser Grid',
    bpm: 116,
    swing: 0,
    level: 0.5,
    voices: { lead: 'pluck', counter: 'bell', arp: 'arpPulse', bass: 'bassSaw' },
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'Bm9 | Gmaj7 | Bm9 | Gmaj7',
        counter: `F#5 . . . C#5 . . . | B4 . . . . . . . | F#5 . . . D5 . . . | D5 . . . F#5 . . .`,
        bass: 'long',
        arp: 'sparse',
        drums: 'pulse',
        pad: 'swell',
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Bm | G | D | A | Bm | G | Em7 | F#sus4 F#',
        lead: `B4 . D5 . F#5 . D5 . B4 . F#5 . E5 . D5 . | D5 - - - B4 - G4 -
             | A4 . D5 . F#5 . A5 . F#5 . D5 . E5 . F#5 . | E5 - - - C#5 - - -
             | B4 . D5 . F#5 . D5 . B4 . F#5 . E5 . D5 . | G5 - F#5 - D5 - B4 -
             | E5 - G5 - B5 - - - | B4 - - - A#4 - C#5 -`,
        bass: 'gallop',
        arp: 'pulse',
        drums: 'break',
        fill: 'toms',
        pad: 'hold',
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'Em7 | F#sus4 F#',
        lead: `E4 . G4 . B4 . E5 . | F#4 . B4 . A#4 . C#5 .`,
        bass: 'eighths',
        arp: 'up',
        drums: 'drive',
        fill: 'roll',
        pad: 'hold',
        riser: true,
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'G | A | F#m7 Bm | Bm | G | A | Em7 | F#7',
        lead: `D5 - G5 - B5 - A5 - | A5 - - - E5 - C#5 - | F#5 - E5 - D5 - F#5 - | B4 - - - . . D5 E5
             | D5 - G5 - B5 - A5 - | C#6 - B5 - A5 - E5 - | G5 - - - E5 - B4 - | A#4 - C#5 - E5 - F#5 -`,
        leadVoice: 'saw',
        bass: 'drive',
        arp: 'cascade',
        drums: 'four',
        fill: 'toms',
        pad: 'hold',
      },
      {
        name: 'breakdown',
        tier: 'calm',
        chords: 'Gmaj7 | F#m7 | Em7 | F#sus4 F#',
        counter: `B4 . D5 . F#5 . . . | A4 . C#5 . E5 . . . | G4 . B4 . D5 . . . | B4 . . . A#4 . . .`,
        bass: 'long',
        arp: 'sparse',
        drums: 'halftime',
        pad: 'swell',
      },
    ],
  },
  {
    // F minor arcade cabinet glow: chiptune squares over i–VI–III–VII
    title: 'Midnight Arcade',
    bpm: 104,
    swing: 0,
    level: 1,
    voices: { lead: 'square', counter: 'bell', arp: 'arpPulse', bass: 'bassFm' },
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'Fm9 | Dbmaj7 | Abmaj7 | Eb6',
        counter: `C5 . . . G4 . . . | F4 . . . . . . . | Eb5 . . . C5 . . . | Bb4 . . . . . . .`,
        bass: 'long',
        arp: 'pulse',
        drums: 'none',
        pad: 'swell',
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Fm | Db | Ab | Eb | Fm | Db | Bbm7 | Csus4 C',
        lead: `F4 . Ab4 . C5 - Bb4 Ab4 | F4 - - - Ab4 . F4 . | Eb5 . C5 . Ab4 - Bb4 C5 | Bb4 - - - . . . .
             | F4 . Ab4 . C5 - Eb5 F5 | F5 - Eb5 - Db5 - Ab4 - | Db5 - C5 - Bb4 - F4 - | F4 - - - E4 - G4 -`,
        bass: 'octave',
        arp: 'broken',
        drums: 'four',
        fill: 'toms',
        pad: 'hold',
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'Db | Eb',
        lead: `F4 . Ab4 . Db5 . F5 . | G4 . Bb4 . Eb5 - G5 -`,
        bass: 'eighths',
        arp: 'up',
        drums: 'drive',
        fill: 'roll',
        pad: 'hold',
        riser: true,
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'Fm | Db | Ab | Eb | Fm | Dbmaj7 | Bbm7 | C7',
        lead: `C5 - - - F5 - Ab5 - | Ab5 - F5 - Db5 - F5 - | Eb5 - - - C5 - Eb5 - | G5 - - - Bb4 - - -
             | C5 - - - F5 - Ab5 - | C6 - Bb5 - Ab5 - F5 - | F5 - - - Db5 - Bb4 - | C5 - E5 - G5 - Bb5 -`,
        bass: 'gallop',
        arp: 'updown',
        drums: 'drive',
        fill: 'toms',
        pad: 'hold',
      },
      {
        name: 'breakdown',
        tier: 'calm',
        chords: 'Dbmaj7 | Cm7 | Bbm7 | Csus4 C',
        counter: `F4 . Ab4 . C5 . . . | G4 . Bb4 . Eb5 . . . | F4 . Ab4 . Db5 . . . | F4 . . . E4 . . .`,
        bass: 'long',
        arp: 'sparse',
        drums: 'pulse',
        pad: 'swell',
      },
    ],
  },
  {
    // G major eurobeat: bright, fast and soaring, with brass pushes in the chorus
    title: 'Crystal Skies',
    bpm: 120,
    swing: 0,
    level: 1.5,
    voices: { lead: 'saw', counter: 'bell', arp: 'pluck', bass: 'bassSaw' },
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'Gmaj9 | Cmaj7 | Gmaj9 | Dsus4 D',
        counter: `B4 . . . F#5 . . . | E5 . . . G4 . . . | D5 . . . A4 . . . | G4 . . . F#4 . . .`,
        bass: 'long',
        arp: 'sparse',
        drums: 'pulse',
        pad: 'swell',
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Em | C | G | D | Em | C | Am7 | Dsus4 D',
        lead: `B4 - E5 - G5 - F#5 E5 | E5 - - - C5 - D5 E5 | D5 - B4 - G4 - A4 B4 | A4 - - - . . . .
             | B4 - E5 - G5 - B5 - | C6 - B5 - G5 - E5 - | A5 - G5 - E5 - C5 - | G5 - - - F#5 - - -`,
        bass: 'octave',
        arp: 'up',
        drums: 'disco',
        fill: 'stop',
        pad: 'hold',
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'C | D',
        lead: `E4 . G4 . C5 . E5 . | F#4 . A4 . D5 . F#5 .`,
        bass: 'eighths',
        arp: 'up',
        drums: 'four',
        fill: 'roll',
        pad: 'hold',
        riser: true,
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'G | D | Em | Bm | C | G | Am7 | D',
        lead: `D5 - G5 - B5 - - - | A5 - - - F#5 - D5 - | E5 - - - G5 - B5 - | B5 - A5 - F#5 - - -
             | G5 - - - E5 - C5 - | D5 - G5 - B5 - D6 - | C6 - - - A5 - E5 - | F#5 - - - D5 - A4 -`,
        bass: 'drive',
        arp: 'cascade',
        drums: 'drive',
        fill: 'toms',
        pad: 'none',
        stabs: 'push',
      },
      {
        name: 'breakdown',
        tier: 'calm',
        chords: 'Cmaj7 | Bm7 | Am7 | Dsus4 D',
        counter: `E5 . G5 . B5 . . . | D5 . F#5 . A5 . . . | C5 . E5 . G5 . . . | G4 . . . F#4 . . .`,
        bass: 'long',
        arp: 'pulse',
        drums: 'halftime',
        pad: 'swell',
      },
    ],
  },
  {
    // C minor after dark: slow, swung and haunted, a bell drifting over a half-time beat
    title: 'Ghost Signal',
    bpm: 88,
    swing: 0.08,
    level: -0.5,
    kit: 'night',
    voices: { lead: 'bell', counter: 'square', arp: 'triangle', bass: 'bass808' },
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'Cm9 | Abmaj7 | Fm9 | G7sus4 G7',
        lead: `G5 . . . D5 . . . | C5 . . . Eb5 . . . | Ab4 . . . G4 . . . | F4 . . . . . . .`,
        bass: 'long',
        arp: 'sparse',
        drums: 'none',
        pad: 'swell',
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Cm | Ab | Eb | Bb | Cm | Ab | Fm7 | G7',
        lead: `G4 - - - C5 - Eb5 - | Eb5 - - - C5 - Ab4 - | Bb4 - - - G4 - Eb4 - | F4 - - - D4 - - -
             | G4 - - - C5 - G5 - | Ab5 - G5 - Eb5 - C5 - | F5 - Eb5 - C5 - Ab4 - | B4 - - - D5 - F5 -`,
        bass: 'sync',
        arp: 'pulse',
        drums: 'halftime',
        fill: 'stop',
        pad: 'hold',
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'Ab | Bb',
        lead: `C5 . Eb5 . Ab5 . C6 . | D5 . F5 . Bb5 - D6 -`,
        leadVoice: 'saw',
        bass: 'eighths',
        arp: 'up',
        drums: 'four',
        fill: 'roll',
        pad: 'hold',
        riser: true,
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'Cm | Ab | Eb | Bb | Cm | Ab | Fm7 | G7',
        lead: `C6 - - - G5 - Eb5 - | Eb5 - F5 - Ab5 - - - | G5 - - - Bb5 - G5 - | F5 - - - D5 - - -
             | C6 - - - G5 - Eb5 - | Eb5 - F5 - Ab5 - C6 - | Ab5 - G5 - F5 - Eb5 - | D5 - - - B4 - - -`,
        leadVoice: 'saw',
        bass: 'octave',
        arp: 'broken',
        drums: 'break',
        fill: 'toms',
        pad: 'hold',
      },
      {
        name: 'breakdown',
        tier: 'calm',
        chords: 'Abmaj7 | Gm7 | Fm7 | G7sus4 G7',
        lead: `C5 . Eb5 . G5 . . . | Bb4 . D5 . F5 . . . | Ab4 . C5 . Eb5 . . . | F4 . . . B4 . . .`,
        bass: 'long',
        arp: 'pulse',
        drums: 'pulse',
        pad: 'swell',
      },
    ],
  },
  {
    // D minor after midnight in the rain: shamisen-like koto riffs over a half-time beat, a
    // breathy flute low underneath and taiko rolling into every section
    title: 'Shinjuku Rain',
    bpm: 92,
    swing: 0.06,
    level: -1,
    kit: 'night',
    voices: { lead: 'koto', counter: 'flute', arp: 'triangle', bass: 'bass808' },
    scene: 'neonCity',
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'Dm9 | Bbmaj7 | Gm9 | A7sus4 A7',
        counter: `D5 - - - - - C5 A4 | F5 - - - D5 - - - | G5 - - - - - F5 D5 | E5 - - - C#5 - - -`,
        bass: 'long',
        arp: 'sparse',
        drums: 'none',
        pad: 'swell',
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Dm | Bb | C | Am | Dm | Bb | Gm7 | A7',
        lead: `D5 . F5 . A5 G5 F5 . | D5 . F5 . Bb4 - - . | G4 . C5 . E5 - D5 C5 | A4 - - - E4 - G4 -
             | D5 . F5 . A5 G5 F5 . | F5 . G5 . F5 . D5 . | G5 . F5 . D5 . Eb5 D5 | E5 - - - C#5 - A4 -`,
        counter: `A4 - - - - - - - | F4 - - - - - - - | G4 - - - - - - - | E4 - - - - - - -
                | A4 - - - - - - - | F4 - - - - - - - | D4 - - - - - - - | E4 - - - - - - -`,
        bass: 'sync',
        arp: 'pulse',
        drums: 'halftime',
        fill: 'taiko',
        pad: 'hold',
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'Gm | A7sus4 A7',
        lead: `G4 . Bb4 . D5 . G5 . | A4 . D5 . C#5 . E5 .`,
        bass: 'eighths',
        arp: 'up',
        drums: 'matsuri',
        fill: 'taiko',
        pad: 'hold',
        riser: true,
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'Dm | Bb | F | C | Dm | Bb | Gm7 | A7',
        lead: `D6 - - - A5 - G5 F5 | F5 - - - D5 - F5 - | A5 - - - C6 - A5 - | G5 - - - E5 - D5 -
             | D6 - - - A5 - C6 - | D6 - - - Bb5 - A5 G5 | Bb5 - - - G5 - F5 - | E5 - - - C#5 - - -`,
        leadVoice: 'saw',
        counter: `A4 - - - - - - - | D5 - - - - - - - | C5 - - - - - - - | E5 - - - - - - -
                | F5 - - - - - - - | D5 - - - - - - - | D5 - - - - - - - | C#5 - - - - - - -`,
        bass: 'octave',
        arp: 'broken',
        drums: 'matsuri',
        fill: 'taiko',
        pad: 'hold',
        stabs: 'offbeat',
      },
      {
        name: 'breakdown',
        tier: 'calm',
        chords: 'Bbmaj7 | Am7 | Gm9 | A7sus4 A7',
        lead: `D5 . . . F5 . . . | E5 . . . C5 . . . | D5 . . . Bb4 . . . | A4 . . . C#5 . . .`,
        bass: 'long',
        arp: 'pulse',
        drums: 'pulse',
        pad: 'swell',
      },
    ],
  },
  {
    // A minor through the Japanese in scale (A Bb D E F): a shakuhachi-like flute singing over
    // a koto ostinato, the flat second of Bb giving it its mountain-lake ache
    title: 'Torii Gates',
    bpm: 96,
    swing: 0,
    level: 0.5,
    voices: { lead: 'flute', counter: 'koto', arp: 'triangle', bass: 'bassSaw' },
    scene: 'fuji',
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'Am9 | Bbmaj7 | Dm9 | E7sus4',
        lead: `E5 - - - - - D5 Bb4 | A4 - - - - - - - | F5 - - - E5 - D5 - | E5 - - - - - - -`,
        counter: `. . A4 . . . E5 . | . . D5 . . . Bb4 . | . . A4 . . . D5 . | . . B4 . . . A4 .`,
        bass: 'long',
        arp: 'sparse',
        drums: 'none',
        pad: 'swell',
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Am | Bb | Dm | Am | F | Bb | Dm7 | E7sus4',
        lead: `A4 - - - C5 - E5 - | D5 - - - - - F5 - | F5 - - - E5 - D5 - | E5 - - - - - . .
             | A4 - - - C5 - F5 - | F5 - - - D5 - Bb4 - | D5 - - - C5 - A4 - | E5 - - - D5 - B4 -`,
        counter: `A4 . E5 . A4 . E5 . | Bb4 . F5 . Bb4 . F5 . | D5 . A5 . D5 . A5 . | A4 . E5 . A4 . E5 .
                | F4 . C5 . F4 . C5 . | Bb4 . F5 . Bb4 . F5 . | D5 . A4 . C5 . A4 . | E4 . B4 . D5 . B4 .`,
        bass: 'octave',
        arp: 'broken',
        drums: 'four',
        fill: 'taiko',
        pad: 'hold',
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'Dm | E7sus4',
        lead: `D5 . F5 . A5 . D6 . | E5 . A5 . B5 . D6 .`,
        leadVoice: 'koto',
        bass: 'eighths',
        arp: 'up',
        drums: 'matsuri',
        fill: 'taiko',
        pad: 'hold',
        riser: true,
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'Am | F | Bb | E7sus4 | Am | F | Dm7 | E7sus4',
        lead: `A5 - - - E5 - A5 - | C6 - - - A5 - F5 - | Bb5 - - - F5 - D5 - | E5 - - - - - D5 -
             | A5 - - - C6 - B5 - | A5 - - - F5 - E5 - | D5 - - - F5 - A5 - | E5 - - - - - - -`,
        leadVoice: 'saw',
        counter: `A4 . E5 . A4 . E5 . | F4 . C5 . F4 . C5 . | Bb4 . F5 . Bb4 . F5 . | E4 . B4 . D5 . B4 .
                | A4 . E5 . A4 . E5 . | F4 . C5 . F4 . C5 . | D5 . A4 . C5 . A4 . | E4 . B4 . D5 . B4 .`,
        bass: 'drive',
        arp: 'updown',
        drums: 'drive',
        fill: 'taiko',
        pad: 'hold',
        stabs: 'push',
      },
      {
        name: 'breakdown',
        tier: 'calm',
        chords: 'Fmaj7 | Bbmaj7 | Dm9 | E7sus4',
        lead: `C5 - - - E5 - - - | D5 - - - A4 - - - | E5 - - - F5 - - - | E5 - - - - - - -`,
        bass: 'long',
        arp: 'pulse',
        drums: 'pulse',
        pad: 'swell',
      },
    ],
  },
  {
    // E minor bent toward a pelog scale (E F G B C): gamelan bells interlocking over a rolling
    // jungle groove, a muted pluck answering them on the off-beats
    title: 'Jade Temple',
    bpm: 108,
    swing: 0,
    level: -1,
    voices: { lead: 'bell', counter: 'pluck', arp: 'triangle', bass: 'bassFm' },
    scene: 'jungle',
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'Em9 | Fmaj7 | Am9 | Bsus4',
        lead: `B4 . . . E5 . . . | C5 . . . E5 . . . | B4 . . . C5 . . . | B4 . . . E5 . . .`,
        bass: 'long',
        arp: 'sparse',
        drums: 'none',
        pad: 'swell',
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Em | Fmaj7 | C | Bsus4 | Em | Fmaj7 | Am7 | Bsus4',
        lead: `E5 . G5 . B5 . G5 F5 | F5 . E5 . C5 . E5 . | E5 . G5 . C6 . B5 G5 | B5 - - - E5 - - -
             | G5 . E5 . B4 . C5 B4 | C5 . F5 . A5 . G5 F5 | E5 . C5 . G5 . F5 E5 | F#5 - - - B4 - - -`,
        counter: `. E4 . G4 . E4 . B4 | . F4 . A4 . F4 . C5 | . G4 . C5 . G4 . E5 | . F#4 . B4 . F#4 . E4`,
        bass: 'gallop',
        arp: 'cascade',
        drums: 'tribal',
        fill: 'toms',
        pad: 'hold',
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'Am | Bsus4',
        lead: `A4 . C5 . E5 . A5 . | B4 . E5 . F#5 . B5 .`,
        bass: 'eighths',
        arp: 'up',
        drums: 'drive',
        fill: 'taiko',
        pad: 'hold',
        riser: true,
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'Em | C | Fmaj7 | Bsus4 | Em | C | Am7 | Bsus4',
        lead: `B5 - - - G5 - E5 - | G5 - - - E5 - C5 - | A5 - - - C6 - A5 - | B5 - - - F#5 - E5 -
             | E5 - - - G5 - B5 - | C6 - - - G5 - E5 - | A5 - - - E5 - G5 - | F#5 - - - - - - -`,
        leadVoice: 'saw',
        counter: `. B4 . E5 . G5 . E5 | . C5 . E5 . G5 . E5 | . C5 . F5 . A5 . F5 | . B4 . E5 . F#5 . E5`,
        bass: 'drive',
        arp: 'updown',
        drums: 'tribal',
        fill: 'toms',
        pad: 'hold',
        stabs: 'push',
      },
      {
        name: 'breakdown',
        tier: 'calm',
        chords: 'Cmaj7 | Bsus4 | Am9 | Bsus4',
        lead: `E5 . . . G5 . . . | E5 . . . B4 . . . | C5 . . . E5 . . . | F#5 . . . B4 . . .`,
        bass: 'long',
        arp: 'pulse',
        drums: 'pulse',
        pad: 'swell',
      },
    ],
  },
  {
    // E minor with a phrygian F: the Warehouse, the challenges' first tier. A heavy square bass
    // under a broken beat, stabs off the beat like steel doors slamming, the crowd's chant on top
    title: 'Iron Floor',
    bpm: 112,
    swing: 0,
    level: -1.5,
    kit: 'dark',
    voices: { lead: 'square', counter: 'pluck', arp: 'pluck', bass: 'bassReese' },
    scene: 'warehouse',
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'Em | Fmaj7 | Em | D',
        counter: `E5 . . . . . B4 . | F5 . . . . . C5 . | E5 . . . . . G5 . | F#5 . . . . . D5 .`,
        bass: 'long',
        arp: 'sparse',
        drums: 'pulse',
        pad: 'swell',
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Em | Em | Fmaj7 | D | Em | Em | C | Bsus4 B',
        lead: `E5 . E5 . G5 - F5 E5 | B4 - - - G4 - - - | C5 . C5 . E5 - D5 C5 | D5 - - - . . . .
             | E5 . E5 . G5 - A5 G5 | G5 - E5 - B4 - - - | C5 - E5 - G5 - E5 - | F#5 - - - D#5 - - -`,
        bass: 'sync',
        arp: 'broken',
        drums: 'break',
        fill: 'stop',
        pad: 'hold',
        stabs: 'offbeat',
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'C | D',
        lead: `C5 - E5 - G5 - C6 - | D5 - F#5 - A5 - D6 -`,
        bass: 'eighths',
        arp: 'up',
        drums: 'drive',
        fill: 'roll',
        pad: 'hold',
        riser: true,
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'Em | C | D | Bsus4 B | Em | C | Am7 | Bsus4',
        lead: `B5 - - - G5 - E5 - | G5 - - - E5 - C5 - | A5 - - - F#5 - D5 - | B4 - - - D#5 - F#5 -
             | B5 - - - G5 - E5 - | C6 - - - G5 - E5 - | A5 - G5 - E5 - C5 - | B4 - - - - - - -`,
        leadVoice: 'saw',
        bass: 'drive',
        arp: 'updown',
        drums: 'foundry',
        fill: 'toms',
        pad: 'hold',
        stabs: 'push',
      },
      {
        name: 'breakdown',
        tier: 'calm',
        chords: 'Cmaj7 | Bsus4 | Em | D',
        counter: `G5 . . . E5 . . . | F#5 . . . B4 . . . | G5 . . . B5 . . . | A5 . . . F#5 . . .`,
        bass: 'long',
        arp: 'pulse',
        drums: 'halftime',
        pad: 'swell',
      },
    ],
  },
  {
    // D minor pentatonic, the Dojo exam, the challenges' second tier: a koto riff driving over a
    // festival beat, taiko rolling into each section. Brisk and martial, unlike Fuji's still lake
    title: 'Black Belt',
    bpm: 118,
    swing: 0,
    level: -1.5,
    kit: 'dark',
    voices: { lead: 'koto', counter: 'bell', arp: 'arpPulse', bass: 'bassReese' },
    scene: 'dojo',
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'Dm | Bb | C | Asus4',
        counter: `D5 . . . . . A4 . | D5 . . . . . F4 . | C5 . . . . . G4 . | A4 . . . . . E5 .`,
        bass: 'long',
        arp: 'sparse',
        drums: 'pulse',
        fill: 'taiko',
        pad: 'swell',
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Dm | Dm | Bb | C | Dm | Dm | Gm | Asus4 A',
        lead: `D5 . F5 . A5 - G5 F5 | D5 - - - A4 - - - | D5 . D5 . F5 - D5 C5 | C5 - - - G4 - - -
             | D5 . F5 . A5 - C6 A5 | A5 - G5 - F5 - - - | G5 - F5 - D5 - C5 - | E5 - - - C#5 - - -`,
        bass: 'octave',
        arp: 'broken',
        drums: 'matsuri',
        fill: 'taiko',
        pad: 'hold',
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'Bb | C',
        lead: `Bb4 - D5 - F5 - Bb5 - | C5 - E5 - G5 - C6 -`,
        bass: 'eighths',
        arp: 'up',
        drums: 'drive',
        fill: 'roll',
        pad: 'hold',
        riser: true,
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'Dm | Bb | F | C | Dm | Bb | Gm | Asus4 A',
        lead: `A5 - - - F5 - D5 - | F5 - - - D5 - Bb4 - | C6 - - - A5 - F5 - | G5 - - - E5 - C5 -
             | D6 - - - A5 - F5 - | D6 - - - Bb5 - F5 - | G5 - Bb5 - D6 - Bb5 - | E5 - - - C#5 - - -`,
        leadVoice: 'saw',
        bass: 'drive',
        arp: 'updown',
        drums: 'tribal',
        fill: 'taiko',
        pad: 'hold',
        stabs: 'push',
      },
      {
        name: 'breakdown',
        tier: 'calm',
        chords: 'Bbmaj7 | Asus4 | Dm | C',
        counter: `F5 . . . D5 . . . | E5 . . . A4 . . . | F5 . . . A5 . . . | E5 . . . G5 . . .`,
        bass: 'long',
        arp: 'pulse',
        drums: 'halftime',
        pad: 'swell',
      },
    ],
  },
  {
    // C minor, the Broken Net, the challenges' last tier: the classic synthwave of the quick
    // match, but the signal won't hold. Every section ends in a fault: the line drops out, the
    // beat is chopped up, the tape rewinds into the chorus
    title: 'No Carrier',
    bpm: 104,
    swing: 0,
    level: -1.5,
    kit: 'dark',
    voices: { lead: 'saw', counter: 'bell', arp: 'arpPulse', bass: 'bassReese' },
    scene: 'brokenNet',
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'Cm | Abmaj7 | Eb | Bb',
        counter: `G5 . . . . . C5 . | Eb5 . . . . . Ab4 . | G5 . . . . . Bb4 . | F5 . . . . . D5 .`,
        bass: 'long',
        arp: 'sparse',
        drums: 'pulse',
        pad: 'swell',
        glitch: 'dropout',
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Cm | Ab | Eb | Bb | Cm | Ab | Fm | Gsus4 G',
        lead: `G5 - - Eb5 C5 - D5 - | Eb5 - C5 - Ab4 - - - | G4 - Bb4 - Eb5 - G5 - | F5 - - - D5 - - -
             | G5 - - Eb5 C5 - D5 - | Eb5 - F5 - Ab5 - G5 - | G5 - F5 - C5 - Ab4 - | D5 - - - B4 - - -`,
        bass: 'octave',
        arp: 'broken',
        drums: 'four',
        fill: 'stop',
        pad: 'hold',
        glitch: 'stutter',
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'Fm | Gsus4 G',
        lead: `F4 - Ab4 - C5 - F5 - | G5 - - - B5 - D6 -`,
        bass: 'eighths',
        arp: 'up',
        drums: 'drive',
        pad: 'hold',
        riser: true,
        glitch: 'rewind',
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'Ab | Bb | Gm7 Cm | Cm | Ab | Bb | Gsus4 | G',
        lead: `C6 - - Bb5 Ab5 - G5 - | F5 - - - D5 - F5 - | G5 - Bb5 - D6 - C6 - | D6 - C6 - - - . .
             | C6 - - Bb5 Ab5 - G5 - | F5 - - - Bb5 - - - | C6 - Bb5 - G5 - F5 - | G5 - - - D5 - B4 -`,
        bass: 'drive',
        arp: 'updown',
        drums: 'drive',
        fill: 'roll',
        pad: 'hold',
        stabs: 'push',
        glitch: 'stutter',
      },
      {
        name: 'breakdown',
        tier: 'calm',
        chords: 'Abmaj7 | Bb | Cm | Gsus4',
        counter: `C5 . Eb5 . G5 . . . | D5 . F5 . Bb5 . . . | Eb5 . G5 . C6 . . . | D5 . . . G4 . . .`,
        bass: 'long',
        arp: 'pulse',
        drums: 'halftime',
        pad: 'swell',
        glitch: 'rewind',
      },
    ],
  },
  // ——— The new soundtrack (5.6, docs/AUDIO.md). Each track belongs to its backdrop, walks a
  // form of its own, and keeps its chorus for a hot rally ———
  {
    // E minor for the Laser backdrop, built from the sketches chosen on the stand: hypnotic
    // arpeggios (a five-note cell over four beats, two interlocking ones) carrying melodies on
    // a polysynth brass lead — M1's arch in the verse, M2's pulse in the second, M3's ache on a
    // hard-sync lead in the bridge, M4's call at the chorus
    title: 'Neon Cathedral',
    bpm: 118,
    swing: 0,
    level: -1,
    scene: 'lasers',
    kit: 'dark',
    voices: { lead: 'brass', counter: 'square', arp: 'arpPulse', bass: 'bassReese', glide: 0.04 },
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
        // The two arpeggios alone, opening slowly: the menus' music too
        name: 'intro',
        tier: 'calm',
        chords: 'Em | Em | C | C | G | G | D | D',
        arpLine: CATHEDRAL.arps,
        bass: 'long',
        drums: 'none',
        pad: 'swell',
        sweep: { arp: [0.3, 1.1], pads: [0.6, 1] },
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Em | Em | C | C | Am | Am | B | B',
        lead: M1,
        arpLine: HYPNOTIC.arp,
        bassLine: HYPNOTIC.bass,
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
        lead: M2,
        arpLine: HYPNOTIC.arp,
        bassLine: HYPNOTIC.bass,
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
        arpLine: CATHEDRAL.arps,
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
        lead: CATHEDRAL.call,
        arpLine: CATHEDRAL.arps,
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
        lead: CATHEDRAL.ache,
        leadVoice: 'sync',
        arpLine: CATHEDRAL.arps,
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
    // B flat major for the Outrun backdrop, built from what was chosen on the stand: the sunset
    // arpeggio (a seven-note cell over the bar, after Lazerhawk) carrying S3, a line that sings
    // by step — on a pluck in the verse, on the soft lead after, with its harmony a third below
    // at the chorus — and turned upside down in the bridge, on the koto
    title: 'Sunset Strip',
    bpm: 112,
    swing: 0,
    scene: 'outrun',
    voices: { lead: 'pluck', counter: 'square', arp: 'arpPulse', bass: 'bassFm', glide: 0.04 },
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
        // The arpeggio alone, opening slowly: the menus' music too
        name: 'intro',
        tier: 'calm',
        chords: 'Bb | Bb | F | F | Gm | Gm | Eb | Eb',
        arpLine: SUNSET,
        bass: 'long',
        drums: 'none',
        pad: 'swell',
        sweep: { arp: [0.3, 1.1], pads: [0.6, 1] },
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Bb | Bb | F | F | Gm | Gm | Eb | Eb',
        lead: S3,
        arpLine: SUNSET,
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
        lead: S3,
        leadVoice: 'soft',
        arpLine: SUNSET,
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
        arpLine: SUNSET,
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
        leadVoice: 'soft',
        counter: S3_THIRDS,
        arpLine: SUNSET,
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
        lead: S3_TURNED,
        leadVoice: 'koto',
        arpLine: SUNSET_TURN,
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
    // D major city pop for the Memphis backdrop, after Tatsuro Yamashita: the Japanese "royal
    // road" (IVmaj7–V–iii7–vi7), a slapped FM bass, brass stabs, a swing in the hats
    title: 'Pastel Avenue',
    bpm: 104,
    swing: 0.12,
    level: 1.5,
    scene: 'memphis',
    voices: { lead: 'pluck', counter: 'bell', arp: 'triangle', bass: 'bassFm' },
    form: [
      'intro',
      'verse',
      'answer',
      'breakdown',
      'build',
      'chorus',
      'verse3',
      'bridge',
      'verse',
      'answer',
      'breakdown',
      'build',
      'chorus',
      'bridge',
      'verse3',
    ],
    sections: [
      {
        name: 'intro',
        tier: 'calm',
        chords: 'Gmaj7 | F#m7 | Em7 | A7sus4',
        counter: `D5 . F#5 . A5 . . . | C#5 . E5 . A5 . . . | B4 . D5 . G5 . . . | A4 . . . . . . .`,
        bass: 'long',
        arp: 'sparse',
        drums: 'none',
        pad: 'swell',
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Gmaj7 | A | F#m7 | Bm7 | Em7 | A7sus4 | Dmaj7 | Dmaj7',
        lead: `B4 - D5 - F#5 - E5 D5 | C#5 - - - E5 - A4 - | A4 - C#5 - E5 - F#5 E5 | D5 - - - . . B4 C#5
             | G5 - F#5 - E5 - D5 - | E5 - - - D5 - B4 - | A4 - - - F#4 - A4 - | D5 - - - - - - -`,
        bass: 'funk',
        arp: 'broken',
        drums: 'citypop',
        fill: 'stop',
        pad: 'hold',
        layers: { lead: 0.3, arp: 0.45, counter: 0.6 },
      },
      {
        name: 'answer',
        tier: 'groove',
        chords: 'Gmaj7 | A | F#m7 | Bm7 | Em7 | A7sus4 | Dmaj7 | Dmaj7',
        lead: `B4 - D5 - F#5 - - - | . . . . . . . . | A4 - C#5 - E5 - - - | . . . . . . . .
             | G5 - E5 - D5 - B4 - | . . . . . . . . | A4 - D5 - F#5 - A5 - | F#5 - - - - - - -`,
        bass: 'funk',
        arp: 'pulse',
        drums: 'citypop',
        fill: 'toms',
        pad: 'hold',
        stabs: 'offbeat',
        layers: { lead: 0.3, arp: 0.4, pads: 0.35 },
      },
      {
        name: 'breakdown',
        tier: 'calm',
        chords: 'Em7 | F#m7 | Gmaj7 | A7sus4',
        counter: `G5 . . . B4 . . . | A4 . . . C#5 . . . | B4 . . . D5 . . . | E5 . . . . . . .`,
        bass: 'long',
        arp: 'sparse',
        drums: 'none',
        pad: 'swell',
        silence: 4,
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'Bm7 | A7sus4',
        lead: `B4 - D5 - F#5 - A5 - | G5 - - - A5 - - -`,
        bass: 'walk',
        arp: 'up',
        drums: 'four',
        fill: 'roll',
        pad: 'hold',
        riser: true,
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'Gmaj7 | A | F#m7 | Bm7 | Gmaj7 | A | D | D',
        lead: `D6 - - - B5 - A5 - | C#6 - - - A5 - E5 - | F#5 - A5 - C#6 - A5 - | B5 - - - F#5 - D5 -
             | D6 - - - B5 - A5 - | C#6 - - - E5 - A5 - | A5 - - - F#5 - - - | D5 - - - - - - -`,
        leadVoice: 'saw',
        bass: 'funk',
        arp: 'updown',
        drums: 'citypop',
        fill: 'toms',
        pad: 'hold',
        stabs: 'push',
      },
      {
        name: 'bridge',
        tier: 'groove',
        chords: 'Em7 | A7sus4 | F#m7 | Bm7',
        counter: `G5 . E5 . B4 . D5 . | E5 . . . A4 . . . | F#5 . C#5 . A4 . C#5 . | D5 . . . B4 . . .`,
        bass: 'walk',
        arp: 'pulse',
        drums: 'break',
        fill: 'stop',
        pad: 'hold',
        layers: { counter: 0.25 },
      },
      {
        name: 'verse3',
        tier: 'groove',
        chords: 'Gmaj7 | A | F#m7 | Bm7 | Em7 | A7sus4 | Dmaj7 | Dmaj7',
        lead: `B4 - D5 - F#5 - E5 D5 | C#5 - - - E5 - A4 - | A4 - C#5 - E5 - F#5 E5 | D5 - - - . . B4 C#5
             | G5 - F#5 - E5 - D5 - | E5 - - - D5 - B4 - | A4 - - - F#4 - A4 - | D5 - - - - - - -`,
        leadVoice: 'square',
        bass: 'funk',
        arp: 'up',
        drums: 'citypop',
        fill: 'roll',
        pad: 'hold',
        stabs: 'offbeat',
        layers: { lead: 0.3, arp: 0.45, pads: 0.35 },
      },
    ],
  },
  // ——— Sketches for the Memphis backdrop's track: process bases to choose between on the stand,
  // each as it sounds in a rally (hook) and at the peak (hot); the melodies come next ———
  {
    // P1, royal road: after Tatsuro Yamashita's "Sparkle" — the Japanese royal road
    // (IVmaj7–V–iii7–vi7) under a slapped FM bass, a plucked comp in five uneven hits a bar
    title: 'Memphis P1 Royal Road',
    bpm: 104,
    swing: 0.12,
    level: 1.5,
    sketch: true,
    voices: { lead: 'brass', counter: 'square', arp: 'pluck', bass: 'bassFm' },
    sections: [
      {
        name: 'hook',
        tier: 'groove',
        chords: 'Gmaj7 | A | F#m7 | Bm7 | Em7 | A7sus4 | Dmaj7 | Dmaj7',
        arpLine: ROYAL_ROAD,
        bass: 'funk',
        drums: 'citypop',
        fill: 'stop',
        pad: 'hold',
        stabs: 'offbeat',
        sweep: { arp: [0.5, 1.4] },
      },
      {
        name: 'hot',
        tier: 'high',
        chords: 'Gmaj7 | A | F#m7 | Bm7 | Em7 | A7sus4 | Dmaj7 | Dmaj7',
        arpLine: ROYAL_ROAD,
        bass: 'funk',
        drums: 'citypop',
        fill: 'toms',
        pad: 'hold',
        stabs: 'push',
        drop: true,
      },
    ],
  },
  {
    // P2, plastic: after Mariya Takeuchi's "Plastic Love" — disco four on the floor, the bass
    // bouncing octaves, a minor-key night; the arpeggio's cell grows by a note a bar and shrinks
    title: 'Memphis P2 Plastic',
    bpm: 112,
    swing: 0.06,
    level: 2.5,
    sketch: true,
    voices: { lead: 'brass', counter: 'square', arp: 'arpPulse', bass: 'bassSaw' },
    sections: [
      {
        name: 'hook',
        tier: 'groove',
        chords: 'Fmaj7 | E7 | Am7 | Am7 | Dm7 | G | Cmaj7 | E7',
        arpLine: PLASTIC,
        bass: 'octave',
        drums: 'disco',
        fill: 'roll',
        pad: 'hold',
        sweep: { arp: [0.4, 1.5], pads: [0.7, 1.2] },
      },
      {
        name: 'hot',
        tier: 'high',
        chords: 'Fmaj7 | E7 | Am7 | Am7 | Dm7 | G | Cmaj7 | E7',
        arpLine: PLASTIC,
        bass: 'octave',
        drums: 'disco',
        fill: 'toms',
        pad: 'hold',
        stabs: 'offbeat',
        drop: true,
      },
    ],
  },
  {
    // P3, two of us: after "Just the Two of Us" and Anri — the city-pop changes
    // (IVmaj7–III7–vi7), slow and swung, a soft electric-piano comp in the 3+3+2 tresillo
    title: 'Memphis P3 Two Of Us',
    bpm: 96,
    swing: 0.15,
    level: -0.5,
    sketch: true,
    voices: { lead: 'brass', counter: 'square', arp: 'triangle', bass: 'bassFm' },
    sections: [
      {
        name: 'hook',
        tier: 'groove',
        chords: 'Dbmaj7 | C7 | Fm7 | Fm7 | Dbmaj7 | C7 | Ebm7 | Ab7',
        arpLine: TWO_OF_US,
        bass: 'walk',
        drums: 'break',
        fill: 'stop',
        pad: 'swell',
        sweep: { pads: [0.6, 1.3] },
      },
      {
        name: 'hot',
        tier: 'high',
        chords: 'Dbmaj7 | C7 | Fm7 | Fm7 | Dbmaj7 | C7 | Ebm7 | Ab7',
        arpLine: TWO_OF_US,
        bass: 'walk',
        drums: 'citypop',
        fill: 'toms',
        pad: 'hold',
        stabs: 'push',
        drop: true,
      },
    ],
  },
  {
    // P4, fusion: after Casiopea's "Asayake" — a bright, quick major groove, a slapped bass and
    // a pluck in Euclidean rhythms of seven and nine hits that interlock and keep shifting
    title: 'Memphis P4 Fusion',
    bpm: 116,
    swing: 0,
    level: 1.5,
    sketch: true,
    voices: { lead: 'brass', counter: 'square', arp: 'pluck', bass: 'bassFm' },
    sections: [
      {
        name: 'hook',
        tier: 'groove',
        chords: 'Amaj7 | G#m7 | F#m7 | Emaj7 | Amaj7 | G#m7 | F#m7 | B7sus4',
        arpLine: FUSION.arp,
        bassLine: FUSION.bass,
        drums: 'euclid',
        fill: 'roll',
        pad: 'hold',
        sweep: { arp: [0.5, 1.5] },
      },
      {
        name: 'hot',
        tier: 'high',
        chords: 'Amaj7 | G#m7 | F#m7 | Emaj7 | Amaj7 | G#m7 | F#m7 | B7sus4',
        arpLine: FUSION.arp,
        bassLine: FUSION.bass,
        drums: 'drive',
        fill: 'toms',
        pad: 'hold',
        stabs: 'push',
        drop: true,
      },
    ],
  },
];

export const SONGS: Song[] = SONG_DEFS.map(compileSong);
