import { additive, cycle, euclid } from '@/audio/music/compose';
import { compileSong, Song, SongDef } from '@/audio/music/score';

// ——— Lines written by processes (audio/music/compose.ts), for the Laser backdrop's sketches ———

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

/** B2: three ostinatos of five, seven and twelve steps over Dm, Bb, Gm and A, two bars each. */
const PHASES = {
  arp: cycle([
    { cell: ['D4', 'F4', 'A4', 'D5', 'A4'], bars: 2 },
    { cell: ['D4', 'F4', 'Bb4', 'D5', 'Bb4'], bars: 2 },
    { cell: ['D4', 'G4', 'Bb4', 'D5', 'Bb4'], bars: 2 },
    { cell: ['C#4', 'E4', 'A4', 'C#5', 'A4'], bars: 2 },
  ]),
  bass: cycle([
    { cell: ['D2', '.', 'D2', 'D3', '.', 'A1', '.'], bars: 2 },
    { cell: ['Bb1', '.', 'Bb1', 'Bb2', '.', 'F2', '.'], bars: 2 },
    { cell: ['G1', '.', 'G1', 'G2', '.', 'D2', '.'], bars: 2 },
    { cell: ['A1', '.', 'A1', 'A2', '.', 'E2', '.'], bars: 2 },
  ]),
  counter: cycle([
    { cell: ['F5', '-', '-', '.', 'A4', '-', '-', '.', 'D5', '-', '.', '.'], bars: 2 },
    { cell: ['F5', '-', '-', '.', 'Bb4', '-', '-', '.', 'D5', '-', '.', '.'], bars: 2 },
    { cell: ['D5', '-', '-', '.', 'Bb4', '-', '-', '.', 'G4', '-', '.', '.'], bars: 2 },
    { cell: ['E5', '-', '-', '.', 'C#5', '-', '-', '.', 'A4', '-', '.', '.'], bars: 2 },
  ]),
};

/** B3: the cell growing from three notes to six and shrinking back, over C#m, A, E and B. */
const ADDITIVE = [
  additive(['C#4', 'E4', 'G#4', 'C#5', 'E5', 'G#5'], [3, 4]),
  additive(['A3', 'C#4', 'E4', 'A4', 'C#5', 'E5'], [5, 6]),
  additive(['E4', 'G#4', 'B4', 'E5', 'G#5', 'B5'], [6, 5]),
  additive(['B3', 'D#4', 'F#4', 'B4', 'D#5', 'F#5'], [4, 3]),
].join(' | ');

/** B4: the bass in five Euclidean pulses a bar, the arpeggio in seven, over F#m, D and E. */
const EUCLID_CHORDS = [
  { bass: ['F#1', 'F#2', 'F#1', 'C#2'], arp: ['F#4', 'A4', 'C#5', 'E5'], bars: 2 },
  { bass: ['D2', 'D1', 'A1', 'D2'], arp: ['F#4', 'A4', 'D5', 'F#5'], bars: 1 },
  { bass: ['E1', 'E2', 'B1', 'E1'], arp: ['G#4', 'B4', 'E5', 'G#5'], bars: 1 },
];
const EUCLID = {
  bass: cycle(
    [...EUCLID_CHORDS, ...EUCLID_CHORDS].map(({ bass, bars }) => ({ cell: bass, bars })),
    euclid(5, 16),
  ),
  arp: cycle(
    [...EUCLID_CHORDS, ...EUCLID_CHORDS].map(({ arp, bars }) => ({ cell: arp, bars })),
    euclid(7, 16, 2),
  ),
};

/** B5: a six-note arpeggio in sixteenths below, a five-note one in eighths above. */
const TWO_ARPS = {
  low: cycle([
    { cell: ['C4', 'Eb4', 'G4', 'C5', 'G4', 'Eb4'], bars: 2 },
    { cell: ['C4', 'Eb4', 'Ab4', 'C5', 'Ab4', 'Eb4'], bars: 2 },
    { cell: ['Bb3', 'Eb4', 'G4', 'Bb4', 'G4', 'Eb4'], bars: 2 },
    { cell: ['Bb3', 'D4', 'F4', 'Bb4', 'F4', 'D4'], bars: 2 },
  ]),
  high: cycle(
    [
      { cell: ['C5', 'Eb5', 'G5', 'C6', 'G5'], bars: 2 },
      { cell: ['C5', 'Eb5', 'Ab5', 'C6', 'Ab5'], bars: 2 },
      { cell: ['Bb4', 'Eb5', 'G5', 'Bb5', 'G5'], bars: 2 },
      { cell: ['Bb4', 'D5', 'F5', 'Bb5', 'F5'], bars: 2 },
    ],
    euclid(8, 16),
  ),
};

// ——— Melodies for the sketches over B and B5 (eighths: 8 a bar; sixteenths: 16) ———

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
    // F minor darksynth for the Laser backdrop, after Perturbator: a driven saw bass in straight
    // sixteenths, a triplet arpeggio crossing the four-on-the-floor, a two-bar hook that keeps
    // coming back, and a harmonic-minor C pulling it home
    title: 'Neon Cathedral',
    bpm: 118,
    swing: 0,
    level: -1.5,
    scene: 'lasers',
    kit: 'dark',
    voices: { lead: 'saw', counter: 'square', arp: 'arpPulse', bass: 'bassSaw' },
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
        chords: 'Fm | Db | Ab | Eb',
        counter: `C5 . . . F5 . . . | Ab4 . . . Db5 . . . | C5 . . . Eb5 . . . | G4 . . . Bb4 . . .`,
        bass: 'long',
        arp: 'sparse',
        drums: 'pulse',
        pad: 'swell',
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Fm | Db | Ab | Eb | Fm | Db | Bbm | C',
        lead: `C5 - F5 - Ab5 - G5 F5 | Ab5 - - - F5 - Db5 - | C5 - Eb5 - Ab5 - G5 Eb5 | G5 - - - Bb4 - - -
             | C5 - F5 - Ab5 - C6 - | Db6 - C6 - Ab5 - F5 - | F5 - Db5 - Bb4 - Db5 F5 | E5 - - - G5 - - -`,
        bass: 'pulse16',
        arp: 'triplet',
        drums: 'darkdrive',
        fill: 'roll',
        pad: 'hold',
        layers: { lead: 0.32, arp: 0.45, counter: 0.6 },
      },
      {
        // The hook asked again with gaps, for the counter voice to answer on a repeat
        name: 'answer',
        tier: 'groove',
        chords: 'Fm | Db | Ab | Eb | Fm | Db | Bbm | C',
        lead: `F5 - - Ab5 - - C6 - | . . . . . . . . | Eb5 - - Ab5 - - C6 - | . . . . . . . .
             | F5 - - Ab5 - - Db6 - | . . . . . . . . | Db5 - F5 - Bb5 - Ab5 - | G5 - - - E5 - - -`,
        bass: 'drive',
        arp: 'up',
        drums: 'darkdrive',
        fill: 'toms',
        pad: 'hold',
        layers: { lead: 0.32, arp: 0.4 },
      },
      {
        name: 'breakdown',
        tier: 'calm',
        chords: 'Db | Eb | Fm | Fm',
        counter: `Ab4 . . . Db5 . . . | G4 . . . Bb4 . . . | F4 . . . Ab4 . . . | C5 . . . . . . .`,
        bass: 'long',
        arp: 'sparse',
        drums: 'halftime',
        pad: 'swell',
        silence: 4,
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'Bbm | C',
        lead: `Bb4 - Db5 - F5 - Bb5 - | C5 - E5 - G5 - C6 -`,
        bass: 'pulse16',
        arp: 'up',
        drums: 'drive',
        fill: 'roll',
        pad: 'hold',
        riser: true,
      },
      {
        name: 'chorus',
        tier: 'high',
        chords: 'Db | Eb | Fm | Fm | Db | Eb | C | C',
        lead: `Ab5 - - - Db6 - C6 - | Bb5 - - - G5 - Eb5 - | C6 - - - Ab5 - F5 - | Ab5 - G5 - F5 - - -
             | Ab5 - - - Db6 - C6 - | Bb5 - - - G5 - Bb5 - | C6 - - - G5 - E5 - | G5 - - - C6 - - -`,
        bass: 'pulse16',
        arp: 'triplet',
        drums: 'darkdrive',
        fill: 'toms',
        pad: 'hold',
        stabs: 'push',
        drop: true,
      },
      {
        // The lead steps aside: a square counter-line over a darker turn of the chords
        name: 'bridge',
        tier: 'groove',
        chords: 'Bbm | Fm | Db | C',
        counter: `Db5 - - F5 - - Bb5 - | Ab5 - - - . . . . | F5 - - Ab5 - - Db6 - | C6 - - - . . . .`,
        bass: 'sync',
        arp: 'broken',
        drums: 'break',
        fill: 'stop',
        pad: 'hold',
        layers: { counter: 0.28, arp: 0.4 },
      },
      {
        // The hook once more, the beat doubled and the arpeggio tumbling down
        name: 'verse3',
        tier: 'groove',
        chords: 'Fm | Db | Ab | Eb | Fm | Db | Bbm | C',
        lead: `C5 - F5 - Ab5 - G5 F5 | Ab5 - - - F5 - Db5 - | C5 - Eb5 - Ab5 - G5 Eb5 | G5 - - - Bb4 - - -
             | C5 - F5 - Ab5 - C6 - | Db6 - C6 - Ab5 - F5 - | F5 - Db5 - Bb4 - Db5 F5 | E5 - - - G5 - - -`,
        leadVoice: 'square',
        bass: 'drive',
        arp: 'cascade',
        drums: 'darkdrive',
        feel: 'double',
        fill: 'roll',
        pad: 'hold',
        layers: { lead: 0.32, arp: 0.45 },
      },
    ],
  },
  {
    // D minor outrun for the Outrun backdrop, after Carpenter Brut and Kavinsky: a galloping
    // bass under a straight kick, a racing hook, and the harmonic minor's A major at every turn
    title: 'Redline',
    bpm: 124,
    swing: 0,
    level: 0.5,
    scene: 'outrun',
    voices: { lead: 'saw', counter: 'square', arp: 'pluck', bass: 'bassSaw' },
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
        chords: 'Dm | Bb | C | Am',
        counter: `A4 . . . D5 . . . | F4 . . . D5 . . . | E4 . . . G4 . . . | A4 . . . . . . .`,
        bass: 'long',
        arp: 'pulse',
        drums: 'pulse',
        pad: 'swell',
      },
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Dm | Bb | C | Am | Dm | Bb | Gm | A',
        lead: `D5 - A4 - D5 - F5 E5 | D5 - - - Bb4 - - - | C5 - E5 - G5 - F5 E5 | A4 - - - . . . .
             | D5 - A4 - D5 - A5 - | Bb5 - A5 - F5 - D5 - | G5 - - - Bb5 - A5 G5 | A5 - - - C#5 - E5 -`,
        bass: 'gallop',
        arp: 'broken',
        drums: 'outrun',
        fill: 'toms',
        pad: 'hold',
        layers: { lead: 0.32, arp: 0.45, counter: 0.6 },
      },
      {
        name: 'answer',
        tier: 'groove',
        chords: 'Dm | Bb | C | Am | Dm | Bb | Gm | A',
        lead: `D5 - F5 - A5 - - - | . . . . . . . . | E5 - G5 - C6 - - - | . . . . . . . .
             | D5 - F5 - A5 - D6 - | . . . . . . . . | Bb5 - A5 - G5 - Bb5 - | A5 - - - - - - -`,
        counter: `D5 - - - - - - - | Bb4 - - - - - - - | C5 - - - - - - - | A4 - - - - - - -
                | D5 - - - - - - - | Bb4 - - - - - - - | Bb4 - - - - - - - | A4 - - - - - - -`,
        bass: 'drive',
        arp: 'up',
        drums: 'outrun',
        fill: 'roll',
        pad: 'hold',
        layers: { lead: 0.32, arp: 0.4, counter: 0.5 },
      },
      {
        name: 'breakdown',
        tier: 'calm',
        chords: 'Bb | C | Dm | Dm',
        counter: `F4 . . . D5 . . . | G4 . . . C5 . . . | A4 . . . D5 . . . | F5 . . . . . . .`,
        bass: 'long',
        arp: 'sparse',
        drums: 'halftime',
        pad: 'swell',
        silence: 4,
      },
      {
        name: 'build',
        tier: 'rise',
        chords: 'Gm | A',
        lead: `G4 - Bb4 - D5 - G5 - | A4 - C#5 - E5 - A5 -`,
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
        chords: 'Bb | C | Dm | Dm | Bb | C | A | A',
        lead: `F5 - - - Bb5 - A5 - | G5 - - - E5 - C5 - | D5 - F5 - A5 - D6 - | D6 - C6 - A5 - . .
             | F5 - - - Bb5 - A5 - | G5 - - - C6 - G5 - | A5 - - - C#6 - - - | E5 - - - A5 - - -`,
        bass: 'gallop',
        arp: 'updown',
        drums: 'outrun',
        fill: 'toms',
        pad: 'hold',
        stabs: 'push',
        drop: true,
      },
      {
        name: 'bridge',
        tier: 'groove',
        chords: 'Gm | Dm | Bb | A',
        counter: `Bb4 - D5 - G5 - - - | F5 - - - D5 - - - | F5 - Bb5 - F5 - D5 - | E5 - - - C#5 - - -`,
        bass: 'sync',
        arp: 'triplet',
        drums: 'break',
        fill: 'stop',
        pad: 'hold',
        layers: { counter: 0.28, arp: 0.4 },
      },
      {
        // Flat out: the hook on the square lead over double-time drums
        name: 'verse3',
        tier: 'groove',
        chords: 'Dm | Bb | C | Am | Dm | Bb | Gm | A',
        lead: `D5 - A4 - D5 - F5 E5 | D5 - - - Bb4 - - - | C5 - E5 - G5 - F5 E5 | A4 - - - . . . .
             | D5 - A4 - D5 - A5 - | Bb5 - A5 - F5 - D5 - | G5 - - - Bb5 - A5 G5 | A5 - - - C#5 - E5 -`,
        leadVoice: 'square',
        bass: 'gallop',
        arp: 'cascade',
        drums: 'outrun',
        feel: 'double',
        fill: 'toms',
        pad: 'hold',
        layers: { lead: 0.32, arp: 0.45 },
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
  // ——— Sketches for the Laser backdrop's track: three hooks to choose between on the stand,
  // each as it sounds in a rally (hook) and at the peak (hot). Never played by the game ———
  {
    // A: the riff carries it, after Carpenter Brut — a driven bass in F phrygian, its flat
    // second (G flat) the menace; the lead only answers, in syncopated stabs
    title: 'Lasers A Riff',
    bpm: 118,
    swing: 0,
    level: -2,
    sketch: true,
    kit: 'dark',
    voices: { lead: 'saw', counter: 'square', arp: 'arpPulse', bass: 'bassSaw' },
    sections: [
      {
        name: 'hook',
        tier: 'groove',
        chords: 'Fm | Fm | Gb | Fm | Fm | Fm | Db | C',
        bassLine: `F1 F1 F2 F1 . F1 Eb2 F1 F1 F1 F2 F1 . Ab1 Gb1 F1
                 | F1 F1 F2 F1 . F1 Eb2 F1 F1 F1 F2 F1 . C2 Db2 C2
                 | Gb1 Gb1 Gb2 Gb1 . Gb1 F2 Gb1 Gb1 Gb1 Gb2 Gb1 . Ab1 Gb1 F1
                 | F1 F1 F2 F1 . F1 Eb2 F1 F1 . F1 . F2 . Eb2 Db2
                 | F1 F1 F2 F1 . F1 Eb2 F1 F1 F1 F2 F1 . Ab1 Gb1 F1
                 | F1 F1 F2 F1 . F1 Eb2 F1 F1 F1 F2 F1 . C2 Db2 C2
                 | Db2 Db2 Ab1 Db2 . Db2 Ab1 Db2 Db2 Db2 Ab1 Db2 . Eb2 Db2 C2
                 | C2 C2 G1 C2 . C2 G1 C2 C2 . C2 . G1 . E2 G2`,
        lead: `. . . . Ab5 - . C6 - . Db6 - C6 - - - | . . . . Ab5 - . C6 - . Bb5 - Ab5 - Gb5 -
             | . . . . Bb5 - . Db6 - . C6 - Bb5 - - - | F5 - - - - - - - . . . . . . . .
             | . . . . Ab5 - . C6 - . Db6 - C6 - - - | . . . . Ab5 - . C6 - . Bb5 - C6 - Db6 -
             | . . . . F5 - . Ab5 - . C6 - Ab5 - - - | E5 - - - G5 - - - C6 - - - - - - -`,
        drums: 'darkdrive',
        fill: 'roll',
        pad: 'hold',
      },
      {
        name: 'hot',
        tier: 'high',
        chords: 'Db | Eb | Fm | Fm | Db | Eb | C | C',
        lead: `Ab5 - Ab5 - F5 - Ab5 - Db6 - - - C6 - Ab5 - | G5 - G5 - Eb5 - G5 - Bb5 - - - Ab5 - G5 -
             | Ab5 - Ab5 - F5 - Ab5 - C6 - - - Db6 - C6 - | F5 - - - - - - - . . . . . . . .
             | Ab5 - Ab5 - F5 - Ab5 - Db6 - - - C6 - Ab5 - | G5 - G5 - Eb5 - G5 - Bb5 - - - C6 - Db6 -
             | C6 - - - G5 - - - E5 - - - G5 - - - | C6 - - - - - - - . . . . . . . .`,
        bass: 'pulse16',
        arp: 'triplet',
        drums: 'darkdrive',
        fill: 'toms',
        pad: 'hold',
        stabs: 'push',
        drop: true,
      },
    ],
  },
  {
    // B: hypnotic, after M|O|O|N's "Hydrogen" — a five-note arpeggio cycling over four beats,
    // so its accent lands somewhere new every time; long sighing notes above, a pulsing bass
    title: 'Lasers B Hypnotic',
    bpm: 118,
    swing: 0,
    level: -1,
    sketch: true,
    kit: 'dark',
    voices: { lead: 'saw', counter: 'square', arp: 'arpPulse', bass: 'bassReese' },
    sections: [
      {
        name: 'hook',
        tier: 'groove',
        chords: 'Em | Em | C | C | Am | Am | B | B',
        arpLine: `E4 G4 B4 E5 B4 E4 G4 B4 E5 B4 E4 G4 B4 E5 B4 E4
                | G4 B4 E5 B4 E4 G4 B4 E5 B4 E4 G4 B4 E5 B4 E4 G4
                | C5 E5 C5 E4 G4 C5 E5 C5 E4 G4 C5 E5 C5 E4 G4 C5
                | E5 C5 E4 G4 C5 E5 C5 E4 G4 C5 E5 C5 E4 G4 C5 E5
                | C5 E4 A4 C5 E5 C5 E4 A4 C5 E5 C5 E4 A4 C5 E5 C5
                | E4 A4 C5 E5 C5 E4 A4 C5 E5 C5 E4 A4 C5 E5 C5 E4
                | F#4 B4 D#5 B4 D#4 F#4 B4 D#5 B4 D#4 F#4 B4 D#5 B4 D#4 F#4
                | B4 D#5 B4 D#4 F#4 B4 D#5 B4 D#4 F#4 B4 D#5 B4 D#4 F#4 B4`,
        bassLine: `E1 . E1 . E2 . E1 . E1 . E1 . E2 . D2 . | E1 . E1 . E2 . E1 . E1 . E1 . E2 . G1 .
                 | C2 . C2 . C2 . G1 . C2 . C2 . G1 . B1 . | C2 . C2 . C2 . G1 . C2 . C2 . E2 . G1 .
                 | A1 . A1 . A2 . A1 . A1 . A1 . A2 . G1 . | A1 . A1 . A2 . A1 . A1 . A1 . E2 . A1 .
                 | B1 . B1 . B1 . F#1 . B1 . B1 . D#2 . F#2 . | B1 . B1 . B1 . F#1 . B1 . B1 . A1 . F#1 .`,
        counter: `B4 - - - - - - - | . . . . . . . . | C5 - - - - - - - | . . . . . . . .
                | C5 - - - E5 - - - | . . . . . . . . | D#5 - - - F#5 - - - | B4 - - - - - - -`,
        drums: 'drive',
        fill: 'stop',
        pad: 'hold',
        layers: { counter: 0.3 },
        sweep: { arp: [0.4, 1.5], pads: [0.7, 1.2] },
      },
      {
        name: 'hot',
        tier: 'high',
        chords: 'Em | Em | C | C | Am | Am | B | B',
        arpLine: `E4 G4 B4 E5 B4 E4 G4 B4 E5 B4 E4 G4 B4 E5 B4 E4
                | G4 B4 E5 B4 E4 G4 B4 E5 B4 E4 G4 B4 E5 B4 E4 G4
                | C5 E5 C5 E4 G4 C5 E5 C5 E4 G4 C5 E5 C5 E4 G4 C5
                | E5 C5 E4 G4 C5 E5 C5 E4 G4 C5 E5 C5 E4 G4 C5 E5
                | C5 E4 A4 C5 E5 C5 E4 A4 C5 E5 C5 E4 A4 C5 E5 C5
                | E4 A4 C5 E5 C5 E4 A4 C5 E5 C5 E4 A4 C5 E5 C5 E4
                | F#4 B4 D#5 B4 D#4 F#4 B4 D#5 B4 D#4 F#4 B4 D#5 B4 D#4 F#4
                | B4 D#5 B4 D#4 F#4 B4 D#5 B4 D#4 F#4 B4 D#5 B4 D#4 F#4 B4`,
        lead: `B5 - - - - - - - | A5 - - - G5 - F#5 - | E5 - - - - - - - | G5 - - - E5 - C5 -
             | A5 - - - - - - - | C6 - - - B5 - A5 - | B5 - - - - - - - | F#5 - - - D#5 - - -`,
        bass: 'pulse16',
        drums: 'darkdrive',
        fill: 'toms',
        pad: 'hold',
        drop: true,
      },
    ],
  },
  {
    // C: the anthem, after Perturbator's "Future Club" — a lead in a 3+3+2 rhythm of repeated
    // notes that leaps at the end of each phrase, two chords to the bar, D dorian's bright B flat
    title: 'Lasers C Anthem',
    bpm: 118,
    swing: 0,
    level: 2,
    sketch: true,
    voices: { lead: 'saw', counter: 'square', arp: 'arpPulse', bass: 'bassSaw' },
    sections: [
      {
        name: 'hook',
        tier: 'groove',
        chords: 'Dm Bb | C Am | Dm Bb | C A | Dm Bb | C Am | Dm Bb | C A',
        lead: `A5 - - A5 - - A5 - G5 - - F5 - - D5 - | G5 - - G5 - - G5 - E5 - - E5 - - C5 -
             | A5 - - A5 - - A5 - D6 - - C6 - - Bb5 - | C6 - - - - - - - C#6 - - - - - - -
             | F5 - - F5 - - F5 - D5 - - F5 - - A5 - | G5 - - G5 - - G5 - A5 - - G5 - - E5 -
             | A5 - - A5 - - D6 - D6 - - C6 - - Bb5 - | G5 - - - - - - - E5 - - - - - - -`,
        bassLine: `D2 . D1 . D2 . D1 . Bb1 . Bb1 . F2 . Bb1 . | C2 . C2 . G1 . C2 . A1 . A1 . E2 . A1 .
                 | D2 . D1 . D2 . D1 . Bb1 . Bb1 . F2 . Bb1 . | C2 . C2 . G1 . C2 . A1 . C#2 . E2 . A1 .`,
        arp: 'broken',
        drums: 'outrun',
        fill: 'roll',
        pad: 'hold',
        layers: { arp: 0.45 },
      },
      {
        name: 'hot',
        tier: 'high',
        chords: 'Dm Bb | C Am | Dm Bb | C A | Dm Bb | C Am | Dm Bb | C A',
        lead: `A5 - - A5 - - A5 - G5 - - F5 - - D5 - | G5 - - G5 - - G5 - E5 - - E5 - - C5 -
             | A5 - - A5 - - A5 - D6 - - C6 - - Bb5 - | C6 - - - - - - - C#6 - - - - - - -
             | F5 - - F5 - - F5 - D5 - - F5 - - A5 - | G5 - - G5 - - G5 - A5 - - G5 - - E5 -
             | A5 - - A5 - - D6 - D6 - - C6 - - Bb5 - | G5 - - - - - - - E5 - - - - - - -`,
        counter: `F5 - - - D5 - - - | E5 - - - C5 - - - | F5 - - - F5 - - - | E5 - - - E5 - - -`,
        bassLine: `D2 . D1 . D2 . D1 . Bb1 . Bb1 . F2 . Bb1 . | C2 . C2 . G1 . C2 . A1 . A1 . E2 . A1 .
                 | D2 . D1 . D2 . D1 . Bb1 . Bb1 . F2 . Bb1 . | C2 . C2 . G1 . C2 . A1 . C#2 . E2 . A1 .`,
        arp: 'updown',
        drums: 'outrun',
        fill: 'toms',
        pad: 'hold',
        stabs: 'push',
        drop: true,
      },
    ],
  },
  {
    // B2, phases, after Steve Reich: three ostinatos of different lengths — a five-step
    // arpeggio, a seven-step bass, a twelve-step counter-line — so their pattern together comes
    // round only after hundreds of steps; the filter opening slowly over it all
    title: 'Lasers B2 Phases',
    bpm: 112,
    swing: 0,
    level: -1,
    sketch: true,
    kit: 'dark',
    voices: { lead: 'saw', counter: 'square', arp: 'arpPulse', bass: 'bassReese' },
    sections: [
      {
        name: 'hook',
        tier: 'groove',
        chords: 'Dm | Dm | Bb | Bb | Gm | Gm | A | A',
        arpLine: PHASES.arp,
        bassLine: PHASES.bass,
        counter: PHASES.counter,
        drums: 'drive',
        fill: 'stop',
        pad: 'hold',
        layers: { counter: 0.3 },
        sweep: { arp: [0.35, 1.8], pads: [0.6, 1.3] },
      },
      {
        name: 'hot',
        tier: 'high',
        chords: 'Dm | Dm | Bb | Bb | Gm | Gm | A | A',
        arpLine: PHASES.arp,
        bassLine: PHASES.bass,
        counter: PHASES.counter,
        lead: `D5 - - - - - - - | F5 - - - E5 - D5 - | D5 - - - - - - - | F5 - - - D5 - Bb4 -
             | G5 - - - - - - - | Bb5 - - - A5 - G5 - | A5 - - - - - - - | C#6 - - - E5 - - -`,
        drums: 'darkdrive',
        fill: 'toms',
        pad: 'hold',
        drop: true,
      },
    ],
  },
  {
    // B3, additive, after Philip Glass: the arpeggio's cell grows a note a bar and shrinks
    // again — three, four, five, six notes, and back — so the phrase keeps reshaping itself
    title: 'Lasers B3 Additive',
    bpm: 120,
    swing: 0,
    level: -1,
    sketch: true,
    kit: 'dark',
    voices: { lead: 'saw', counter: 'square', arp: 'arpPulse', bass: 'bassSaw' },
    sections: [
      {
        name: 'hook',
        tier: 'groove',
        chords: 'C#m | C#m | A | A | E | E | B | B',
        arpLine: ADDITIVE,
        bass: 'eighths',
        drums: 'four',
        fill: 'roll',
        pad: 'hold',
        sweep: { arp: [0.5, 1.6] },
      },
      {
        name: 'hot',
        tier: 'high',
        chords: 'C#m | C#m | A | A | E | E | B | B',
        arpLine: ADDITIVE,
        lead: `G#5 - - - - - - - | E5 - - - C#5 - - - | E5 - - - - - - - | C#5 - - - A4 - - -
             | B5 - - - - - - - | G#5 - - - E5 - - - | F#5 - - - - - - - | D#5 - - - B4 - - -`,
        bass: 'pulse16',
        drums: 'darkdrive',
        fill: 'toms',
        pad: 'hold',
        drop: true,
      },
    ],
  },
  {
    // B4, Euclidean: the bass's five notes and the arpeggio's seven spread as evenly as they
    // go over the bar, against a kick spread the same way — a groove that rolls rather than marches
    title: 'Lasers B4 Euclid',
    bpm: 122,
    swing: 0,
    sketch: true,
    kit: 'dark',
    voices: { lead: 'saw', counter: 'square', arp: 'arpPulse', bass: 'bassSaw' },
    sections: [
      {
        name: 'hook',
        tier: 'groove',
        chords: 'F#m | F#m | D | E | F#m | F#m | D | E',
        bassLine: EUCLID.bass,
        arpLine: EUCLID.arp,
        drums: 'euclid',
        fill: 'stop',
        pad: 'hold',
        sweep: { arp: [0.4, 1.5] },
      },
      {
        name: 'hot',
        tier: 'high',
        chords: 'F#m | F#m | D | E | F#m | F#m | D | E',
        bassLine: EUCLID.bass,
        arpLine: EUCLID.arp,
        lead: `. . . . A5 - - - | C#6 - - - B5 - A5 - | . . . . F#5 - - - | G#5 - - - - - - -`,
        drums: 'darkdrive',
        fill: 'toms',
        pad: 'hold',
        drop: true,
      },
    ],
  },
  {
    // B5, two arpeggios, after Tangerine Dream: a six-note one in sixteenths and a five-note
    // one in eighths above it, weaving a third pattern that neither plays alone
    title: 'Lasers B5 Two Arps',
    bpm: 100,
    swing: 0,
    level: -2,
    sketch: true,
    voices: { lead: 'saw', counter: 'square', arp: 'arpPulse', bass: 'bassFm' },
    sections: [
      {
        name: 'hook',
        tier: 'groove',
        chords: 'Cm | Cm | Ab | Ab | Eb | Eb | Bb | Bb',
        arpLine: TWO_ARPS.low,
        counter: TWO_ARPS.high,
        bass: 'long',
        drums: 'four',
        fill: 'stop',
        pad: 'hold',
        layers: { drums: 0.35, counter: 0.3 },
        sweep: { arp: [0.3, 1.4], pads: [0.7, 1.2] },
      },
      {
        name: 'hot',
        tier: 'high',
        chords: 'Cm | Cm | Ab | Ab | Eb | Eb | Bb | Bb',
        arpLine: TWO_ARPS.low,
        counter: TWO_ARPS.high,
        lead: `C5 - - - - - - - | Eb5 - - - D5 - - - | C5 - - - - - - - | Eb5 - - - F5 - - -
             | G5 - - - - - - - | Bb5 - - - G5 - - - | F5 - - - - - - - | D5 - - - Bb4 - - -`,
        bass: 'drive',
        drums: 'drive',
        fill: 'toms',
        pad: 'hold',
        drop: true,
      },
    ],
  },
  // ——— Melodies over the chosen processes: a tune to hum on top of B's and B5's ostinatos ———
  {
    // B + M1: long notes reached by pickups, the phrase an arch — asked over Em and C, answered
    // from the high A down to the leading tone; the square lead slides between its notes
    title: 'Lasers B M1 Arch',
    bpm: 118,
    swing: 0,
    sketch: true,
    kit: 'dark',
    level: -1,
    voices: { lead: 'square', counter: 'saw', arp: 'arpPulse', bass: 'bassReese', glide: 0.07 },
    sections: [
      {
        name: 'hook',
        tier: 'groove',
        chords: 'Em | Em | C | C | Am | Am | B | B',
        lead: M1,
        arpLine: HYPNOTIC.arp,
        bassLine: HYPNOTIC.bass,
        drums: 'drive',
        fill: 'stop',
        pad: 'hold',
        sweep: { arp: [0.4, 1.5], pads: [0.7, 1.2] },
      },
      {
        name: 'hot',
        tier: 'high',
        chords: 'Em | Em | C | C | Am | Am | B | B',
        lead: M1,
        leadVoice: 'saw',
        arpLine: HYPNOTIC.arp,
        bass: 'pulse16',
        drums: 'darkdrive',
        fill: 'toms',
        pad: 'hold',
        drop: true,
      },
    ],
  },
  {
    // B + M2: rhythm first — a 3+3+2 figure of repeated notes in sixteenths, answered by a run
    // that climbs; the lead leans on 9ths and suspended 4ths before it lands
    title: 'Lasers B M2 Pulse',
    bpm: 118,
    swing: 0,
    sketch: true,
    kit: 'dark',
    level: -1,
    voices: { lead: 'saw', counter: 'square', arp: 'arpPulse', bass: 'bassReese', glide: 0.05 },
    sections: [
      {
        name: 'hook',
        tier: 'groove',
        chords: 'Em | Em | C | C | Am | Am | B | B',
        lead: M2,
        arpLine: HYPNOTIC.arp,
        bassLine: HYPNOTIC.bass,
        drums: 'drive',
        fill: 'stop',
        pad: 'hold',
        sweep: { arp: [0.4, 1.5], pads: [0.7, 1.2] },
      },
      {
        name: 'hot',
        tier: 'high',
        chords: 'Em | Em | C | C | Am | Am | B | B',
        lead: M2,
        arpLine: HYPNOTIC.arp,
        bass: 'pulse16',
        drums: 'darkdrive',
        fill: 'toms',
        pad: 'hold',
        drop: true,
      },
    ],
  },
  {
    // B5 + M3: a slow, aching line over the two arpeggios — long notes, each strong beat
    // leaning on a note just off the chord (a 9th, a major 7th) before it gives way
    title: 'Lasers B5 M3 Ache',
    bpm: 100,
    swing: 0,
    sketch: true,
    level: -2,
    voices: { lead: 'square', counter: 'square', arp: 'arpPulse', bass: 'bassFm', glide: 0.09 },
    sections: [
      {
        name: 'hook',
        tier: 'groove',
        chords: 'Cm | Cm | Ab | Ab | Eb | Eb | Bb | Bb',
        lead: M3,
        arpLine: TWO_ARPS.low,
        bass: 'long',
        drums: 'four',
        fill: 'stop',
        pad: 'hold',
        layers: { drums: 0.35 },
        sweep: { arp: [0.3, 1.4], pads: [0.7, 1.2] },
      },
      {
        name: 'hot',
        tier: 'high',
        chords: 'Cm | Cm | Ab | Ab | Eb | Eb | Bb | Bb',
        lead: M3,
        leadVoice: 'saw',
        arpLine: TWO_ARPS.low,
        bass: 'drive',
        drums: 'drive',
        fill: 'toms',
        pad: 'hold',
        drop: true,
      },
    ],
  },
  {
    // B5 + M4: call and response with the arpeggios — a phrase climbs the chord in a 3+3+2
    // rhythm, rests while the arpeggios answer, then a run climbs to the next
    title: 'Lasers B5 M4 Call',
    bpm: 100,
    swing: 0,
    sketch: true,
    level: -2,
    voices: { lead: 'saw', counter: 'square', arp: 'arpPulse', bass: 'bassFm', glide: 0.05 },
    sections: [
      {
        name: 'hook',
        tier: 'groove',
        chords: 'Cm | Cm | Ab | Ab | Eb | Eb | Bb | Bb',
        lead: M4,
        arpLine: TWO_ARPS.low,
        bass: 'long',
        drums: 'four',
        fill: 'stop',
        pad: 'hold',
        layers: { drums: 0.35 },
        sweep: { arp: [0.3, 1.4], pads: [0.7, 1.2] },
      },
      {
        name: 'hot',
        tier: 'high',
        chords: 'Cm | Cm | Ab | Ab | Eb | Eb | Bb | Bb',
        lead: M4,
        arpLine: TWO_ARPS.low,
        bass: 'drive',
        drums: 'drive',
        fill: 'toms',
        pad: 'hold',
        drop: true,
      },
    ],
  },
];

export const SONGS: Song[] = SONG_DEFS.map(compileSong);
