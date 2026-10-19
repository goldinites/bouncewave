import {
  ArpPatternName,
  BassPatternName,
  DrumFillName,
  DrumPatternName,
  GlitchPatternName,
  StabPatternName,
} from '@/audio/music/patterns';
import { Chord, parseChord, parseNote } from '@/audio/music/theory';
import { SceneId } from '@/shared/scenes';

export const STEPS_PER_BAR = 16;
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
  bass: BassPatternName;
  arp?: ArpPatternName;
  drums: DrumPatternName;
  /** Played in the second half of the section's last bar. */
  fill?: DrumFillName;
  pad: 'swell' | 'hold' | 'none';
  stabs?: StabPatternName;
  /** A noise sweep rising over the whole section, into what follows. */
  riser?: boolean;
  /** Faults on the whole mix over the section's last bar, for a song that breaks down. */
  glitch?: GlitchPatternName;
}

export interface SongDef {
  title: string;
  bpm: number;
  /** Share of a step the off-beat 16ths are pushed late by, for a laid-back groove. */
  swing: number;
  voices: { lead: LeadVoice; counter: LeadVoice; arp: OscillatorType; bass: OscillatorType };
  /**
   * The backdrop this song belongs to: it plays only behind that one, and first whenever that
   * backdrop comes up. Songs without one play behind any backdrop.
   */
  scene?: SceneId;
  sections: SectionDef[];
}

/** A melody note starting on some step. */
export interface MelodyNote {
  note: number;
  /** Length in steps. */
  steps: number;
}

export interface Section extends Omit<SectionDef, 'chords' | 'lead' | 'counter'> {
  bars: number;
  /** Chord of every half bar. */
  chords: Chord[];
  /** Per step of the section: the note starting there, if any. */
  lead: (MelodyNote | null)[] | null;
  counter: (MelodyNote | null)[] | null;
}

export interface Song extends Omit<SongDef, 'sections'> {
  sections: Section[];
}

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
  const sections = def.sections.map(({ chords, lead, counter, ...rest }): Section => {
    const compiled = compileChords(chords);
    const bars = compiled.length / 2;
    return {
      ...rest,
      bars,
      chords: compiled,
      lead: lead ? compileMelody(lead, bars) : null,
      counter: counter ? compileMelody(counter, bars) : null,
    };
  });
  return { ...def, sections };
}

/** The chord sounding on `step` of a section. */
export function chordAt(section: Section, step: number): Chord {
  return section.chords[Math.floor(step / STEPS_PER_CHORD_SLOT) % section.chords.length];
}
