/**
 * Reusable one-bar patterns the songs pick from, written on a 16th-note grid (16 characters
 * per bar) so they read like a drum machine's step buttons.
 */

/** Drum hit strength per character: accent, normal, ghost, nothing. */
export const HIT_VELOCITY: Record<string, number> = { X: 1, x: 0.7, o: 0.35, '.': 0 };

export interface DrumPattern {
  kick?: string;
  snare?: string;
  clap?: string;
  hat?: string;
  open?: string;
  /** A big festival drum under the kit. */
  taiko?: string;
}

export const DRUM_PATTERNS = {
  none: {},
  // A soft heartbeat for intros and the menu
  pulse: { kick: 'x.......x.......', hat: '....o.......o...' },
  halftime: { kick: 'X.........x.....', snare: '........X.......', hat: '..o...o...o...o.' },
  four: { kick: 'X...X...X...X...', snare: '....X.......X...', hat: '..x...x...x...x.' },
  drive: {
    kick: 'X...X...X...X.x.',
    snare: '....X.......X...',
    hat: 'x.x.x.x.x.x.x.x.',
    open: '..............x.',
  },
  disco: {
    kick: 'X...X...X...X...',
    clap: '....X.......X...',
    hat: 'oxo.oxo.oxo.oxo.',
    open: '..x...x...x...x.',
  },
  break: {
    kick: 'X.....x...X.....',
    snare: '....X..o.o..X..o',
    hat: 'x.x.x.x.x.x.x.x.',
  },
  // A straight beat with a taiko answering the kick, like a festival drum line
  matsuri: {
    kick: 'X.......X.......',
    snare: '....X.......X...',
    hat: '..x...x...x...x.',
    taiko: '......x.....x.xX',
  },
} satisfies Record<string, DrumPattern>;

export type DrumPatternName = keyof typeof DRUM_PATTERNS;

/**
 * Fills take over the drums for the second half of a section's last bar (8 characters, steps
 * 8–15). Toms: 1 high, 2 mid, 3 low.
 */
export interface DrumFill {
  kick?: string;
  snare?: string;
  tom?: string;
  open?: string;
  taiko?: string;
}

export const DRUM_FILLS = {
  toms: { kick: 'x.......', tom: '..1.2.33', snare: 'o.......' },
  // Taiko rolling into the next section, quiet to loud
  taiko: { taiko: 'o.o.x.xX', open: '.......x' },
  roll: { snare: 'o.o.xxXX', kick: 'x...x...' },
  // Everything drops out for a beat, then one hit leads into the next section
  stop: { kick: 'x.......', open: '......X.' },
} satisfies Record<string, DrumFill>;

export type DrumFillName = keyof typeof DRUM_FILLS;

/**
 * Bass lines relative to the chord, so one pattern fits any progression:
 * R root, O root an octave up, 5 fifth, 3 third, A a semitone below the next chord's root
 * (a chromatic approach), - holds the previous note, . rests.
 */
export const BASS_PATTERNS = {
  long: 'R-------R-----A-',
  eighths: 'R.R.R.R.R.R.R.R.',
  octave: 'R.O.R.O.R.O.R.OA',
  drive: 'RRORRRORRRORRROA',
  sync: 'R..R..O.R..R.5A.',
  walk: 'R-.R5-.5O-.O5-A.',
  gallop: 'R.RRR.RRR.RRR.OA',
} satisfies Record<string, string>;

export type BassPatternName = keyof typeof BASS_PATTERNS;

/**
 * Arpeggios as indices into the chord's tones climbing from the bottom (0 = root, then the
 * next chord tones up, wrapping into higher octaves); . rests.
 */
export const ARP_PATTERNS = {
  sparse: '0...2...4...2...',
  pulse: '0.2.4.2.0.2.4.2.',
  up: '0123456701234567',
  updown: '0123432101234321',
  broken: '0213243502132435',
  cascade: '7654321076543210',
} satisfies Record<string, string>;

export type ArpPatternName = keyof typeof ARP_PATTERNS;

/** Chord stabs (brass-like hits) on the same grid; any hit character plays. */
export const STAB_PATTERNS = {
  push: 'X..x..x...x..x..',
  offbeat: '..x...x...x...x.',
} satisfies Record<string, string>;

export type StabPatternName = keyof typeof STAB_PATTERNS;
