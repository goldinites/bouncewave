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
  /** The kit's metal: industrial clangs. */
  metal?: string;
  /** The kit's small percussion: a rim or a shaker. */
  perc?: string;
}

export const DRUM_PATTERNS = {
  none: {},
  // A soft heartbeat for intros and the menu
  pulse: { kick: 'x.......x.......', hat: '....o.......o...' },
  // The last chord of a finale's sting: one hit, then it rings
  coda: { kick: 'X...............' },
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
  // A straight beat with a taiko answering the kick, like a festival drum line: the drum's
  // "don" and, on the rim, its "ka"
  matsuri: {
    kick: 'X.......X.......',
    snare: '....X.......X...',
    hat: '..x...x...x...x.',
    taiko: '......x.....x.xX',
    perc: '..x.x.....x.x.x.',
  },
  // The chorus's half-time with the odaiko leading it, the hats running eighths over it: Japan's
  // drum carrying a pop chorus, neither a festival nor a straight synthwave beat
  dawn: {
    kick: 'X.........x.....',
    snare: '........X.......',
    hat: 'x.x.x.x.x.x.x.x.',
    open: '..............x.',
    taiko: 'X.....x.X.......',
  },
  // A temple bell (bonshō), struck once and left to ring; with a half-time feel, every two bars
  bonsho: { metal: 'X...............' },
  // The kabuki's clappers (hyoshigi) striking ever faster, as they do before the curtain, over
  // the odaiko
  kabuki: {
    kick: 'X.......X.......',
    clap: 'x.......x...x.xx',
    taiko: 'x.....x...x.x.xX',
    hat: '..x...x...x...x.',
  },
  // Darksynth: a four-on-the-floor under restless sixteenth hats and a clap doubling the snare
  darkdrive: {
    kick: 'X...X...X...X...',
    snare: '....X.......X...',
    clap: '....x.......x...',
    hat: 'x.xxx.xxx.xxx.xx',
    open: '......x.......x.',
  },
  // Darksynth's verse without the four-on-the-floor: the kick on one, a push and three, so the
  // floor is the peak's to earn
  darkbreak: {
    kick: 'X.....x...X.....',
    snare: '....X.......X...',
    hat: 'x.x.x.x.x.x.x.x.',
    open: '..............x.',
  },
  // The same, restless: a second push, a clap on the snare, the hats in sixteenths
  darkbreak2: {
    kick: 'X.....x.x.X.....',
    snare: '....X.......X...',
    clap: '....x.......x...',
    hat: 'x.xxx.xxx.xxx.xx',
  },
  // Darksynth's peak: the four-on-the-floor opened up — straight eighth hats and an open hat on
  // every offbeat, the lift a verse's restless sixteenths never have
  darkpeak: {
    kick: 'X...X...X...X...',
    snare: '....X.......X...',
    clap: '....X.......X...',
    hat: 'x.x.x.x.x.x.x.x.',
    open: '..x...x...x...x.',
  },
  // Outrun: a straight kick, the hats accented on the eighths like a revving engine
  outrun: {
    kick: 'X...X...X...X...',
    snare: '....X.......X...',
    hat: 'xoxoxoxoxoxoxoxo',
    open: '..............x.',
  },
  // Outrun idling at the lights: a kick on one and three, the hats on the off-beats, no snare yet
  cruise: {
    kick: 'X.......X.......',
    hat: '..x...x...x...x.',
  },
  // The synthwave anthem: a kick on one and three, a huge gated snare on two and four, the kick
  // pushing into the bar's second half
  anthem: {
    kick: 'X.......X.x.....',
    snare: '....X.......X...',
    hat: 'x.x.x.x.x.x.x.x.',
    open: '..............x.',
  },
  // Witch house in half-time: the snare on the third beat, so 140 feels like 70, under trap hats
  // rolling into the bar's end, and a pipe somewhere in the street ringing when struck
  witch: {
    kick: 'X......x..X.....',
    snare: '........X.......',
    clap: '........x.......',
    hat: 'x.x.x.x.x.x.xxxx',
    open: '......x.........',
    metal: '...........o....',
  },
  // The city's iron at the peak (Kabukicho Rain's chorus), after Cyberpunk 2077: out of the
  // verses' half-time, the snare on two and four and the hats in sixteenths, so the peak runs at
  // the full 140 the verses only hint at; steel struck across it, a taiko under the off-beats
  neonIron: {
    kick: 'X..x....X.x..x..',
    snare: '....X.......X...',
    clap: '....x.......x...',
    hat: 'x.xxx.xxx.xxx.xx',
    open: '......x.......x.',
    metal: '...x..o....x.x..',
    taiko: '..x.......x...xX',
  },
  // Rain on the window: hats and the shaker ticking, no kick, no snare
  witchIntro: {
    hat: 'x...x...x...x...',
    perc: '..o...o...o...o.',
  },
  // Euclidean: five kicks spread over the bar, a rim and hats in even spreads of their own
  euclid: {
    kick: 'X..x..x..X..x...',
    snare: '....X.......X...',
    hat: 'x.xx.x.xx.x.xx.x',
    perc: '..x....x..x....x',
  },
  // EBM's march (Front 242, Nitzer Ebb): the kick on one and three, the steam's clap on two and
  // four, chains on the last eighths
  ebm: {
    kick: 'X.......X.......',
    clap: '....X.......X...',
    hat: '..x...x...x...x.',
    metal: '......o.......x.',
  },
  // The shift change: the kick gone, the chains and the steam left
  shift: { clap: '....o.......x...', metal: '..o.......x...o.' },
  ebmHot: {
    kick: 'X.......X.......',
    clap: '....X.......X...',
    hat: 'xxxxxxxxxxxxxxxx',
    open: '..x...x...x...x.',
    metal: '...o..x....o..X.',
  },
  // A taiko ensemble's kata (Kodo's "Monochrome"): the nagado's "don" and the odaiko once a bar,
  // sticks on the rims, the atarigane keeping time; then the shime rolling the ground rhythm
  // under them and the hats in eighths, and the peak with everything doubled
  kata: {
    kick: 'X..x..X...x.X...',
    taiko: 'X...............',
    perc: '...x.......x..x.',
    metal: '..x...x...x...x.',
  },
  kata2: {
    kick: 'X..x..X...x.X...',
    snare: 'x.o.x.ooX.o.x.oo',
    taiko: 'X...............',
    hat: 'x.x.x.x.x.x.x.x.',
    perc: '...x...x...x..x.',
    metal: '..x...x...x...x.',
  },
  kataHot: {
    kick: 'X..x..X.X.x.X.x.',
    snare: 'xoxoxoxoXoxoxoxX',
    taiko: 'X.......X.....x.',
    perc: '.x.x...x.x.x..x.',
    metal: 'x.x.x.x.x.x.x.x.',
    open: '..............x.',
  },
  // The hall filling: the odaiko once a bar, the sticks and the bell, no nagado yet
  kataIntro: {
    taiko: 'X...............',
    perc: '...x.......x..x.',
    metal: '..o...o...o...o.',
  },
  // The oroshi into the peak: the odaiko on every beat, the sticks in eighths, the shime rolling
  // up to the drop
  oroshi: {
    taiko: 'X...X...X...X...',
    kick: '..x...x...x...x.',
    snare: 'o.o.o.o.x.x.xxXX',
    perc: 'x.x.x.x.x.x.x.x.',
  },
  // Mokuso, the meditation: the odaiko once a bar, the bell and a stick between
  mokuso: {
    taiko: 'x...............',
    metal: '....o.......o...',
    perc: '..........o.....',
  },
  // A factory floor: the drive with metal struck on the off-beats and a rim ticking between
  foundry: {
    kick: 'X...X...X...X.x.',
    snare: '....X.......X...',
    hat: 'x.x.x.x.x.x.x.x.',
    metal: '..o....x..o...X.',
    perc: '.o.....o.o.....o',
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
  // Darksynth: straight sixteenths, the octave on the last one leading on
  pulse16: 'RRRRRRRRRRRRRROA',
  // City pop: a slap line, root and octave dancing around the fifth and third
  funk: 'R..O.R5.R..O3RA.',
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
  // Three notes against four beats: the hypnotic cross-rhythm of darksynth arpeggios
  triplet: '0240240240240240',
} satisfies Record<string, string>;

export type ArpPatternName = keyof typeof ARP_PATTERNS;

/** Chord stabs (brass-like hits) on the same grid; any hit character plays. */
export const STAB_PATTERNS = {
  push: 'X..x..x...x..x..',
  offbeat: '..x...x...x...x.',
  // City pop's electric-piano comp: chords pushed ahead of the beat, never on the one
  comp: '...x..x....x..x.',
  // A string section pulsing in eighths under a melody
  eighths: 'x.x.x.x.x.x.x.x.',
  // A fanfare on the chord: two short blasts and a long one (- holds the stab)
  fanfare: 'x.x.X-----------',
} satisfies Record<string, string>;

export type StabPatternName = keyof typeof STAB_PATTERNS;

/** The chopped pad's gate (`pad: 'chop'`): the chord sounding only on these sixteenths. */
export const PAD_CHOP = 'x.x.xx.x.x.xx.x.';

/**
 * Signal faults on the whole mix, over a section's last bar (16 steps), for a song that
 * breaks down: x cuts the music out for that step, as a dropped connection does; r rewinds
 * the tape from that step, the pitch sagging and then shrieking up, over the steps marked -
 * after it; . plays as written.
 */
export const GLITCH_PATTERNS = {
  // The line drops out twice before the next section
  dropout: '..........xx.xxx',
  // Chopped to pieces on the last beats
  stutter: '........x.x.x.xx',
  // A rewind into the next section
  rewind: '........r-------',
} satisfies Record<string, string>;

export type GlitchPatternName = keyof typeof GLITCH_PATTERNS;
