import { DrumSampleId } from '@/audio/samples/drums';

/** What a drum part plays, whatever the kit: the arrangement asks for roles, a kit names sounds. */
export type DrumRole =
  'kick' | 'snare' | 'clap' | 'hat' | 'open' | 'crash' | 'tom' | 'taiko' | 'metal' | 'perc';

/** A song's drums: a sound for every role, and an extra hit under the drop if it has one. */
export interface DrumKit extends Record<DrumRole, DrumSampleId> {
  impact?: DrumSampleId;
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
} satisfies Record<string, DrumKit>;

export type KitName = keyof typeof KITS;
