import {
  ArpPatternName,
  BassPatternName,
  DrumFillName,
  DrumPatternName,
  GlitchPatternName,
  StabPatternName,
} from '@/audio/music/patterns';
import { KitName } from '@/audio/music/kits';
import { RoomName } from '@/audio/music/rooms';
import { Chord, parseChord, parseNote } from '@/audio/music/theory';
import { FxHitId } from '@/audio/samples/percussion';
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

/** How a song marks its turns: synth effects, cymbals and drums, or the band alone. */
export type TransitionStyle = 'synth' | 'drums' | 'band';

/** A section's feel: as written, half-time (the beat stretched over two bars) or double-time. */
export type Feel = 'half' | 'double';
const STEPS_PER_CHORD_SLOT = 8; // chords may change on the bar or halfway through it

/**
 * What a section is for, which decides when the conductor plays it:
 * calm in the menu, groove during play, rise as the build-up into a high, climactic chorus.
 */
export type Tier = 'calm' | 'groove' | 'rise' | 'high';

/**
 * dB each tier plays at against the grooves, after the music's compressor (docs/AUDIO.md,
 * "Микс"): a peak hits harder than the verses, a calm part sinks below them — the payoff of a
 * hot rally is heard, not only the extra layers the compressor would flatten.
 */
export const TIER_LEVEL: Record<Tier, number> = { calm: -4, groove: 0, rise: 0.5, high: 1.5 };

/** The level a section plays at against the song's grooves, dB. */
export const partLevel = (section: Pick<SectionDef, 'tier' | 'level'>): number =>
  TIER_LEVEL[section.tier] + (section.level ?? 0);

/**
 * Synth voices a melody can be played on. Koto is a plucked string that snaps up into pitch;
 * flute is a breathy, shakuhachi-like sine that scoops into each note.
 */
export type LeadVoice =
  | 'saw'
  | 'square'
  | 'bell'
  | 'pluck'
  | 'koto'
  | 'flute'
  // Auditioned on the stand (audio/samples/leads.ts): soft, brass, hard-sync and PWM leads
  | 'soft'
  | 'brass'
  | 'sync'
  | 'pwm'
  // A band's sounds, first for city pop: an FM electric piano, a sax, a muted funk guitar
  // and a vibraphone
  | 'epiano'
  | 'sax'
  | 'guitar'
  | 'vibes'
  // The wider palette for the backdrops' tracks to come (5.6): Japan's flute and lute, plucked
  // and struck sounds, strings, the 8-bit and broken digital leads (no choir: the game has no
  // voices, docs/AUDIO.md)
  | 'shakuhachi'
  | 'shamisen'
  | 'harp'
  | 'marimba'
  | 'kalimba'
  | 'gamelan'
  | 'celesta'
  | 'musicBox'
  | 'rhodes'
  | 'strings'
  | 'chip'
  | 'crush';

/** The rendered basses (audio/samples/pitched.ts); a plain oscillator type plays live. */
export type BassVoice = 'bassSaw' | 'bassReese' | 'bassFm' | 'bass808' | 'bassSlap' | 'bassGrowl';

/** The pad's sound: the synth's own, a string section, or swelling backwards. */
export type PadVoice = 'synth' | 'strings' | 'reverse';

/** What plays the chord stabs: a brass section, an electric piano, a guitar, staccato strings. */
export type StabVoice = 'brass' | 'rhodes' | 'guitar' | 'strings';

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
  /** Overrides the song's counter voice for this section. */
  counterVoice?: LeadVoice;
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
  /**
   * A lead voice the written arpeggio plays on, each note as long as written: a koto plucking
   * where a synth's arpeggio would run. The song's arpeggio voice if left out.
   */
  arpVoice?: LeadVoice;
  drums: DrumPatternName;
  /** Played in the second half of the section's last bar. */
  fill?: DrumFillName;
  /** The pad held, swelling in, gated into a rhythm (`chop`, witch house's chopped chords) or none. */
  pad: 'swell' | 'hold' | 'chop' | 'none';
  stabs?: StabPatternName;
  /** What plays the stabs in this section; brass if left out. */
  stabsVoice?: StabVoice;
  /**
   * One-shot sounds struck on a pattern, on the fx layer (audio/samples/percussion.ts, FX_HITS):
   * a character a sixteenth, the pattern repeating through the section — `X` accented, `x`
   * normal, `o` soft, `.` silent.
   */
  hits?: Partial<Record<FxHitId, string>>;
  /** A noise sweep rising over the whole section, into what follows. */
  riser?: boolean;
  /**
   * The intensity (0–1) each layer comes in from in this section, so a part sounds sparse while
   * serving and full in a hot rally; a layer not named plays always. Left out, a groove brings
   * its arpeggio in from 0.4 and its counter-melody from 0.55.
   */
  layers?: Partial<Record<MusicLayer, number>>;
  /**
   * The bar of the section each layer enters on, so a part builds as it plays: one instrument
   * leads, then another joins it, then a third (a layer not named plays from the first bar). The
   * heat still decides, on top, whether a layer that has entered plays.
   */
  enter?: Partial<Record<MusicLayer, number>>;
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
  /**
   * dB the section plays above or below its tier's level (`TIER_LEVEL`), for a part that should
   * stand apart from the others of its kind. 0 if left out.
   */
  level?: number;
  /**
   * dB the pads (stabs too), the melodic parts (lead, counter, arpeggio) and the bass play at
   * against the drums in this section, before the compressor: a peak that should sound fuller,
   * not only louder, or a drone held back under a quiet part. As balanced if left out.
   */
  mix?: { pads?: number; melody?: number; bass?: number };
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
    /** The pad's sound; the synth's if left out. */
    pad?: PadVoice;
    /**
     * Portamento on the bass, in seconds: a note following another slides in from it, the 808's
     * glide in witch house and trap. None if left out.
     */
    bassGlide?: number;
    /**
     * Portamento on the lead, in seconds: a note that follows another without a gap slides in
     * from it, so the line sings rather than steps. None if left out.
     */
    glide?: number;
    /**
     * Semitones the song's own lead falls by as a note ends before a rest, as a shakuhachi's
     * breath lets the note go at a phrase's end. None if left out; never on another section's
     * lead voice.
     */
    fall?: number;
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
  /**
   * How the song marks its turns (docs/AUDIO.md): 'synth' with noise risers, a reverse crash,
   * downlifters and a boom under the drop; 'drums' with the reverse crash alone, the drums doing
   * the rest; 'band' with nothing but what the band plays — fills, stabs, a crash. 'synth' if
   * left out.
   */
  transitions?: TransitionStyle;
  /** The space the song plays in (audio/music/rooms.ts); the plate if left out. */
  room?: RoomName;
  /**
   * How deep the bass and pads dip under the kick, as a share of the full sidechain: 1 for the
   * pumping of darksynth, 0 for a band that breathes by its own playing. 1 if left out.
   */
  pump?: number;
  /**
   * dB the bass is driven by into its saturation: 10 or more for one that tears, as an
   * industrial track's does; below 0 for a cleaner one than the mix's own bend. 0 if left out.
   */
  grit?: number;
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
  /** The title in lower case with dashes, for links to it (`?song=neon-cathedral`). */
  id: string;
  sections: Section[];
}

/** A song's id from its title: "Neon Cathedral" → "neon-cathedral". */
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
