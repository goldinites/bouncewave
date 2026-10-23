import { DrumSampleId } from '@/audio/samples/drums';
import { ExtraDrumId } from '@/audio/samples/percussion';

/** What a drum part plays, whatever the kit: the arrangement asks for roles, a kit names sounds. */
export type DrumRole =
  'kick' | 'snare' | 'clap' | 'hat' | 'open' | 'crash' | 'tom' | 'taiko' | 'metal' | 'perc';

/** A drum sound: one of the core drums, or one of the wider palette's, rendered when needed. */
export type KitSampleId = DrumSampleId | ExtraDrumId;

/** A song's drums: a sound for every role, and an extra hit under the drop if it has one. */
export interface DrumKit extends Record<DrumRole, KitSampleId> {
  impact?: KitSampleId;
}

/** The kits the songs pick from (`kit` in songs.ts), by genre (docs/AUDIO.md, "Саундтрек"). */
export const KITS = {
  // Synthwave and outrun: a punchy kick, the 80s gated snare, crisp 808 hats
  synthwave: {
    kick: 'kickPunch',
    snare: 'snareGated',
    clap: 'clap',
    hat: 'hat',
    open: 'open',
    crash: 'crash',
    tom: 'tom',
    taiko: 'taiko',
    metal: 'clang',
    perc: 'rim',
  },
  // Witch house and night songs: the long 808, a dry snare, a shaker instead of a rim
  night: {
    kick: 'kick808',
    snare: 'snare',
    clap: 'clap',
    hat: 'hat',
    open: 'open',
    crash: 'crash',
    tom: 'tom',
    taiko: 'taiko',
    metal: 'clang',
    perc: 'shaker',
  },
  // Darksynth and industrial: a distorted kick, metal for percussion, an impact under the drop
  dark: {
    kick: 'kickDistorted',
    snare: 'snareGated',
    clap: 'clap',
    hat: 'hat',
    open: 'open',
    crash: 'crash',
    tom: 'tom',
    taiko: 'taiko',
    metal: 'clang',
    perc: 'rim',
    impact: 'impact',
  },
  // Neon Cathedral's: the dark kit with a timpani tuned to E for its kick, the cathedral's
  // orchestra, round where the distorted kick pounded
  cathedral: {
    kick: 'kickTimpani',
    snare: 'snareGated',
    clap: 'clap',
    hat: 'hat',
    open: 'open',
    crash: 'crash',
    tom: 'tom',
    taiko: 'taiko',
    metal: 'clang',
    perc: 'rim',
    impact: 'impact',
  },
  // City pop's band in a room: a punchy kick, a dry snare, a shaker in place of the rim
  band: {
    kick: 'kickPunch',
    snare: 'snare',
    clap: 'clap',
    hat: 'hat',
    open: 'open',
    crash: 'crash',
    tom: 'tom',
    taiko: 'taiko',
    metal: 'clang',
    perc: 'shaker',
  },
  // Outrun's own: the synthwave kit with the Simmons era's electronic crash
  outrun: {
    kick: 'kickPunch',
    snare: 'snareGated',
    clap: 'clap',
    hat: 'hat',
    open: 'open',
    crash: 'synthCymbal',
    tom: 'tom',
    taiko: 'taiko',
    metal: 'clang',
    perc: 'rim',
  },
  // Rain (neonCity): the long 808, a dry snare, steel for the metal, an industrial impact under
  // the drop, and a rain stick where a crash would be
  rain: {
    kick: 'kick808',
    snare: 'snare',
    clap: 'clap',
    hat: 'hat',
    open: 'open',
    crash: 'rainstick',
    tom: 'tom',
    taiko: 'taiko',
    metal: 'clang',
    perc: 'shaker',
    impact: 'impact',
  },
  // Japan (fuji, dojo): the great odaiko for the taiko, a gong for the crash, wood for the rest
  japan: {
    kick: 'kickPunch',
    snare: 'snare',
    clap: 'hyoshigi',
    hat: 'hat',
    open: 'open',
    crash: 'gong',
    tom: 'tom',
    taiko: 'odaiko',
    metal: 'gong',
    perc: 'woodblock',
  },
  // The jungle: hand drums — congas for the toms, bongos for the percussion, the udu's deep
  // bend for the big drum — and a rain stick for the crash
  tribal: {
    kick: 'kickPunch',
    snare: 'snare',
    clap: 'clap',
    hat: 'shaker',
    open: 'open',
    crash: 'rainstick',
    tom: 'conga',
    taiko: 'udu',
    metal: 'clang',
    perc: 'bongo',
  },
  // A Khmer temple (for the story's jungle temple to come), after the pinpeat ensemble of Angkor's courts: the chhing's
  // cups for the hats (struck and pressed, or let ring), the skor's barrel drum for the big one,
  // the sampho's hand drum for the toms and the small percussion, a temple gong for the crash
  khmer: {
    kick: 'kickPunch',
    snare: 'snare',
    clap: 'clap',
    hat: 'chhap',
    open: 'chhing',
    crash: 'gong',
    tom: 'sampho',
    taiko: 'skor',
    metal: 'gong',
    perc: 'sampho',
  },
  // The factory (warehouse, the boss): a distorted kick, chains for the metal, steam for the clap
  factory: {
    kick: 'kickDistorted',
    snare: 'snareGated',
    clap: 'steam',
    hat: 'hat',
    open: 'open',
    crash: 'synthCymbal',
    tom: 'tom',
    taiko: 'taiko',
    metal: 'chain',
    perc: 'rim',
    impact: 'impact',
  },
} satisfies Record<string, DrumKit>;

export type KitName = keyof typeof KITS;
