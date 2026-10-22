import {
  ArpPatternName,
  BassPatternName,
  DrumFillName,
  DrumPatternName,
  GlitchPatternName,
  StabPatternName,
} from '@/audio/music/patterns';
import { KitName } from '@/audio/music/kits';
import { Chord, parseChord, parseNote } from '@/audio/music/theory';
import { SceneId } from '@/shared/scenes';

export const STEPS_PER_BAR = 16;

/**
 * The parts of the arrangement, each coming in with the heat (`SectionDef.layers`) and each
 * silenced on its own on the listening stand: drums (crashes included), bass, pads (and stabs),
 * arpeggio (and the climax sparkle), lead, counter-melody, and fx (transitions and a song's
 * faults).
 */
export const MUSIC_LAYERS = ['drums', 'bass', 'pads', 'arp', 'lead', 'counter', 'fx'] as const;

export type MusicLayer = (typeof MUSIC_LAYERS)[number];

/** A section's feel: as written, half-time (the beat stretched over two bars) or double-time. */
export type Feel = 'half' | 'double';
const STEPS_PER_CHORD_SLOT = 8; // chords may change on the bar or halfway through it

/**
 * What a section is for, which decides when the conductor plays it:
 * calm in the menu, groove during play, rise as the build-up into a high, climactic chorus.
 */
export type Tier = 'calm' | 'groove' | 'rise' | 'high';

/**
 * Synth voices a melody can be played on. Koto is a plucked string that snaps up into pitch;
 * flute is a breathy, shakuhachi-like sine that scoops into each note.
 */
export type LeadVoice = 'saw' | 'square' | 'bell' | 'pluck' | 'koto' | 'flute';

/** The rendered basses (audio/samples/pitched.ts); a plain oscillator type plays live. */
export type BassVoice = 'bassSaw' | 'bassReese' | 'bassFm' | 'bass808';

/** The rendered arpeggio voices; a plain oscillator type plays live. */
export type ArpVoice = 'arpPulse' | 'pluck';

/**
 * One part of a song, as written.
 *
 * Chords: bars split by `|`, one chord per bar or two (changing halfway).
 * Melodies: the same bars, each with 8 tokens (8th notes) or 16 (16th notes) — a note name
 * such as `E5`, `-` to hold the previous note, `.` to rest. A melody shorter than the chords
 * repeats.
 */
export interface SectionDef {
  name: string;
  tier: Tier;
  chords: string;
  lead?: string;
  /** Overrides the song's lead voice for this section. */
  leadVoice?: LeadVoice;
  /** A second, quieter line on the song's counter voice. */
  counter?: string;
  /** The bass as a pattern relative to the chord; or written out note by note (`bassLine`). */
  bass?: BassPatternName;
  /**
   * The bass written out, in the melody notation: a riff of its own, which is what carries a
   * darksynth or outrun track. Takes the place of `bass`.
   */
  bassLine?: string;
  arp?: ArpPatternName;
  /** The arpeggio written out, in the melody notation: an ostinato of its own. Takes the place of `arp`. */
  arpLine?: string;
  drums: DrumPatternName;
  /** Played in the second half of the section's last bar. */
  fill?: DrumFillName;
  pad: 'swell' | 'hold' | 'none';
  stabs?: StabPatternName;
  /** A noise sweep rising over the whole section, into what follows. */
  riser?: boolean;
  /**
   * The intensity (0–1) each layer comes in from in this section, so a part sounds sparse while
   * serving and full in a hot rally; a layer not named plays always. Left out, a groove brings
   * its arpeggio in from 0.4 and its counter-melody from 0.55.
   */
  layers?: Partial<Record<MusicLayer, number>>;
  /**
   * Half-time or double-time: the kick, snare, clap, taiko and metal stretched over two bars or
   * squeezed into half of one, the hats kept in time. As written if left out.
   */
  feel?: Feel;
  /**
   * The section's sound opening (or closing) as it goes: the arpeggio's and the pads' filter
   * moved from the first factor at its start to the second at its end — how a repeated
   * ostinato keeps evolving. As set by the heat alone if left out.
   */
  sweep?: { arp?: [number, number]; pads?: [number, number] };
  /** Steps of silence that end the section: everything stops, then the next section hits. */
  silence?: number;
  /** The section opens with a drop: crash, kick, the kit's impact and a boom. */
  drop?: boolean;
  /** Faults on the whole mix over the section's last bar, for a song that breaks down. */
  glitch?: GlitchPatternName;
}

export interface SongDef {
  title: string;
  bpm: number;
  /** Share of a step the off-beat 16ths are pushed late by, for a laid-back groove. */
  swing: number;
  voices: {
    lead: LeadVoice;
    counter: LeadVoice;
    arp: OscillatorType | ArpVoice;
    bass: OscillatorType | BassVoice;
  };
  /**
   * The backdrop this song belongs to: it plays only behind that one, and first whenever that
   * backdrop comes up. Songs without one play behind any backdrop.
   */
  scene?: SceneId;
  /**
   * The order the song's sections play in, by name; a section may come more than once. The
   * conductor walks it, jumping to its peaks (builds and choruses) only on a hot rally. The
   * sections in the order written if left out.
   */
  form?: string[];
  /**
   * A sketch for the listening stand: a few bars of a hook to choose between, never played by
   * the game.
   */
  sketch?: boolean;
  /** The song's drums (audio/music/kits.ts); synthwave if left out. */
  kit?: KitName;
  /**
   * dB the song is turned up or down by, so the songs sound equally loud: read off the listening
   * stand's meter (its average over the verse and chorus) against the others. 0 if left out.
   */
  level?: number;
  sections: SectionDef[];
}

/** A melody note starting on some step. */
export interface MelodyNote {
  note: number;
  /** Length in steps. */
  steps: number;
}

export interface Section extends Omit<
  SectionDef,
  'chords' | 'lead' | 'counter' | 'bassLine' | 'arpLine'
> {
  bars: number;
  /** Chord of every half bar. */
  chords: Chord[];
  /** Per step of the section: the note starting there, if any. */
  lead: (MelodyNote | null)[] | null;
  counter: (MelodyNote | null)[] | null;
  bassLine: (MelodyNote | null)[] | null;
  arpLine: (MelodyNote | null)[] | null;
}

export interface Song extends Omit<SongDef, 'sections' | 'form'> {
  /** The form as section indices. */
  form: number[];
  /** The title in lower case with dashes, for links to it (`?song=night-drive`). */
  id: string;
  sections: Section[];
}

/** A song's id from its title: "Night Drive" → "night-drive". */
export const songId = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const splitBars = (text: string) => text.split('|').map((bar) => bar.trim().split(/\s+/));

function compileChords(text: string): Chord[] {
  return splitBars(text).flatMap((bar) => {
    if (bar.length < 1 || bar.length > 2) {
      throw new Error(`A bar holds one or two chords: "${bar.join(' ')}"`);
    }
    const chords = bar.map(parseChord);
    return chords.length === 1 ? [chords[0], chords[0]] : chords;
  });
}

function compileMelody(text: string, bars: number): (MelodyNote | null)[] {
  const written = splitBars(text);
  if (bars % written.length !== 0) {
    throw new Error(`A melody of ${written.length} bars doesn't repeat evenly over ${bars}`);
  }

  const steps: (MelodyNote | null)[] = [];
  let current: MelodyNote | null = null;
  for (const bar of written) {
    if (bar.length !== 8 && bar.length !== 16) {
      throw new Error(`A melody bar holds 8 or 16 tokens: "${bar.join(' ')}"`);
    }
    const stepsPerToken = STEPS_PER_BAR / bar.length;

    for (const token of bar) {
      let started: MelodyNote | null = null;
      if (token === '-') {
        if (current) current.steps += stepsPerToken;
      } else if (token === '.') {
        current = null;
      } else {
        started = current = { note: parseNote(token), steps: stepsPerToken };
      }
      steps.push(started, ...Array<null>(stepsPerToken - 1).fill(null));
    }
  }

  // Repeat to fill the section; repeats are separate notes so a hold never runs past the end
  const length = steps.length;
  for (let i = length; i < bars * STEPS_PER_BAR; i++) {
    const note = steps[i - length];
    steps.push(note && { ...note });
  }
  return steps;
}

/** Turns a written song into the per-step form the arrangement plays from. */
export function compileSong(def: SongDef): Song {
  const sections = def.sections.map(
    ({ chords, lead, counter, bassLine, arpLine, ...rest }): Section => {
      if (!rest.bass && !bassLine) {
        throw new Error(`"${def.title}" ${rest.name} has neither a bass pattern nor a bass line`);
      }
      const compiled = compileChords(chords);
      const bars = compiled.length / 2;
      return {
        ...rest,
        bars,
        chords: compiled,
        lead: lead ? compileMelody(lead, bars) : null,
        counter: counter ? compileMelody(counter, bars) : null,
        bassLine: bassLine ? compileMelody(bassLine, bars) : null,
        arpLine: arpLine ? compileMelody(arpLine, bars) : null,
      };
    },
  );
  const form = (def.form ?? def.sections.map((s) => s.name)).map((name) => {
    const index = def.sections.findIndex((s) => s.name === name);
    if (index < 0) throw new Error(`"${def.title}" has no section "${name}" for its form`);
    return index;
  });
  return { ...def, id: songId(def.title), sections, form };
}

/** The chord sounding on `step` of a section. */
export function chordAt(section: Section, step: number): Chord {
  return section.chords[Math.floor(step / STEPS_PER_CHORD_SLOT) % section.chords.length];
}
