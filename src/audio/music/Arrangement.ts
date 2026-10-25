import { Instruments, TOM_RATES } from '@/audio/music/Instruments';
import { VoiceOverrides } from '@/audio/music/palette';
import { DrumKit, DrumRole, kickRate, KITS } from '@/audio/music/kits';
import { MusicGraph } from '@/audio/music/MusicGraph';
import {
  ARP_PATTERNS,
  BASS_PATTERNS,
  DRUM_FILLS,
  DRUM_PATTERNS,
  DrumFill,
  DrumPattern,
  GLITCH_PATTERNS,
  HIT_VELOCITY,
  PAD_CHOP,
  STAB_PATTERNS,
} from '@/audio/music/patterns';
import {
  chordAt,
  LeadVoice,
  MelodyNote,
  MUSIC_LAYERS,
  MusicLayer,
  Section,
  Song,
  STEPS_PER_BAR,
  Tier,
  TransitionStyle,
} from '@/audio/music/score';
import { Chord, placeAbove, voiceChord } from '@/audio/music/theory';
import { BarVariation, barVariation, feelStep } from '@/audio/music/variation';
import { DifficultyLevel } from '@/match/difficulty';
import { clamp } from '@/shared/math';

/** Everything that decides what one 16th-note step plays. */
export interface StepContext {
  time: number;
  stepDuration: number;
  song: Song;
  section: Section;
  /** Bar of the section, from 0. */
  bar: number;
  /** Step of the bar, 0–15. */
  stepInBar: number;
  /** Whether this bar leads into a new section, so its second half plays the fill. */
  isLastBar: boolean;
  /** The chord the next bar opens with. */
  nextBarChord: Chord;
  /** The tier of the section before this one, for the transition into it; null at the start. */
  previousTier?: Tier | null;
  /** How many times this section has played before in the song: 0 the first time. */
  pass?: number;
  /** 0..1: how hot the game is right now; the mix fills out and brightens as it rises. */
  intensity: number;
  /** 0..1: rally climax build-up; fades the climax-only layers in. */
  climaxLevel: number;
  /** 0..1: the deciding point's tension; the drums thin to the kick with it. 0 if left out. */
  dramaLevel?: number;
  /** Whether the rally has gone to overtime: the alarm plays over the music. */
  isOvertime?: boolean;
  difficulty: DifficultyLevel;
}

/** How the lead lines' character sharpens as the AI gets tougher. */
interface DifficultySignature {
  /** Multiplies the leads' filter cutoff: brighter and more biting the harder the level. */
  leadBrightness: number;
  /** An extra octave-up retrigger on the arpeggio's strong beats, for a nervous edge. */
  stutter: boolean;
}

const DIFFICULTY_SIGNATURES: Record<DifficultyLevel, DifficultySignature> = {
  [DifficultyLevel.EASY]: { leadBrightness: 1, stutter: false },
  [DifficultyLevel.NORMAL]: { leadBrightness: 1.3, stutter: false },
  [DifficultyLevel.HARD]: { leadBrightness: 1.6, stutter: true },
  [DifficultyLevel.INSANE]: { leadBrightness: 1.9, stutter: true },
};

// Registers: bass roots in E1–D#2 (the SFX tune to these too), arpeggios from A3
export const BASS_LOW = 28;
const ARP_LOW = 57;
const ARP_HIGH = 86; // higher arpeggio notes fold down an octave
const SPARKLE_HIGH = 96;

// Where a section doesn't say (`layers`), the intensity each layer comes in from: in a groove
// the arpeggio and the counter-melody wait for the rally to heat up, everything else plays
const DEFAULT_LAYER_FROM: Partial<Record<Tier, Partial<Record<MusicLayer, number>>>> = {
  groove: { arp: 0.4, counter: 0.55 },
};
// A layer that came in leaves only once intensity has fallen this far below where it came in,
// so one hovering at its threshold doesn't flicker in and out bar by bar
const LAYER_HYSTERESIS = 0.06;
const GROOVE_EXTRA_HATS_INTENSITY = 0.45;

// Peak levels; most scale with intensity on top
const LEAD_VOLUME: Record<LeadVoice, number> = {
  saw: 0.075,
  square: 0.06,
  bell: 0.11,
  pluck: 0.09,
  koto: 0.1,
  flute: 0.085,
  soft: 0.1,
  brass: 0.07,
  sync: 0.06,
  pwm: 0.07,
  epiano: 0.11,
  sax: 0.06,
  guitar: 0.1,
  vibes: 0.095,
  shakuhachi: 0.047,
  shamisen: 0.22,
  harp: 0.12,
  marimba: 0.11,
  kalimba: 0.09,
  gamelan: 0.085,
  celesta: 0.068,
  musicBox: 0.094,
  rhodes: 0.063,
  strings: 0.145,
  chip: 0.069,
  crush: 0.058,
};
const COUNTER_SHARE = 0.55;
// A written arpeggio on a lead's voice (`arpVoice`), against that voice's melody level
const ARP_LEAD_SHARE = 0.6;
const ARP_VOLUME = 0.045;
// Under a melody the arpeggio steps back, quieter and darker, so the ear doesn't knit its notes
// into the tune's
const ARP_UNDER_LEAD = { VOLUME: 0.6, BRIGHTNESS: 0.7 } as const;
// Portamento slides only between near notes, and quickly: a long slide, or one across a leap,
// starts every note out of tune
const GLIDE = { MAX_INTERVAL: 5, MAX_TIME: 0.04 } as const; // semitones, s
const PAD_VOLUME = 0.022;
// A chopped pad's notes are short: a little louder, so it sits as high as a held one
const CHOP_BOOST = 1.4;
const STAB_VOLUME = 0.05;
const BASS_VOLUME = 0.15;
// The 808 slides up to an octave: further, it sounds like a siren, not a bass
const BASS_GLIDE_MAX_INTERVAL = 12; // semitones
const RISER_VOLUME = 0.07;
// Transitions, peak levels; the tonal riser joins the noise one only once the match is hot
const TRANSITION_VOLUME = {
  REVERSE_CRASH: 0.09,
  REVERSE_SNARE: 0.07,
  RISER_TONE: 0.05,
  RISER_TONE_INTENSITY: 0.5,
  DOWNLIFTER: 0.08,
  NOISE_WAVE: 0.05,
  BOOM: 0.5,
} as const;
// A section's one-shot hits (siren, modem, fanfare…), at their accent
const FX_HIT_VOLUME = 0.12;
// A ghost note and a phrase fill, as shares of the snare's written level
const GHOST_SNARE = 0.3;
const PHRASE_FILL = { FROM_STEP: 14, VELOCITIES: [0.35, 0.75] } as const;
// On the deciding point, from this tension on, the drums play their kick alone (the pads and the
// melody fade out on the graph, MusicGraph's DRAMA_THIN_AT)
const DRAMA_KICK_ONLY = 0.25;
// Overtime's alarm (5.8): the chord's root in eighths, the octave on the off-beats, on the song's
// own arpeggio voice, straight into the mix, so neither the deciding point's thinning nor the
// climax buries it. It comes in on a crash and a kick, at once, as OVERTIME lights up
const OVERTIME = {
  VOLUME: 0.055,
  OFFBEAT: 0.65, // share of the volume on the off-beat octave
  CUTOFF: 4200, // Hz
  CRASH: 0.16,
  KICK: 0.9,
} as const;
// How hot each tier is, to tell the music going up from coming down
const TIER_HEAT: Record<Tier, number> = { calm: 0, groove: 1, rise: 2, high: 3 };

/** The bass note a pattern token stands for over `chord`; null for holds and rests. */
function bassNote(token: string, chord: Chord, next: Chord): number | null {
  const root = placeAbove(chord.root, BASS_LOW);
  switch (token) {
    case 'R':
      return root;
    case 'O':
      return root + 12;
    case '5':
      return root + 7;
    case '3':
      return root + chord.triad[1];
    case 'A':
      return placeAbove(next.root, BASS_LOW) - 1;
    default:
      return null;
  }
}

/** The factor a section's sweep sets a layer's filter to at `sectionStep`; 1 without a sweep. */
export function sweepAt(section: Section, layer: 'arp' | 'pads', sectionStep: number): number {
  const sweep = section.sweep?.[layer];
  if (!sweep) return 1;
  const [from, to] = sweep;
  // Log-even, as a filter is heard
  return from * (to / from) ** (sectionStep / (section.bars * STEPS_PER_BAR));
}

/** The arpeggio's `index`-th note: the chord's tones from the bottom up, octave after octave. */
function arpNote(chord: Chord, index: number): number {
  const base = placeAbove(chord.root, ARP_LOW);
  const ladder = [...new Set(chord.intervals.map((i) => i % 12))].sort((a, b) => a - b);
  let note = base + ladder[index % ladder.length] + 12 * Math.floor(index / ladder.length);
  while (note > ARP_HIGH) note -= 12;
  return note;
}

/** Steps a token in a pattern sounds for: itself plus the holds after it. */
function heldSteps(pattern: string, step: number): number {
  let steps = 1;
  while (pattern[step + steps] === '-') steps++;
  return steps;
}

/**
 * Plays the score: every part of the current section on every step — pad, stabs, bass,
 * arpeggio, melody, counter-melody, drums and fills — shaped by how hot the game is, plus the
 * climax layers on top while a long rally builds.
 */
export class Arrangement {
  private readonly play: Instruments;
  private readonly graph: MusicGraph;
  private readonly bass: AudioNode;
  private readonly melody: AudioNode;
  /** The pad's last voicing, so the next chord moves as little as possible from it. */
  private voicing: number[] | null = null;
  /** The drums of the song playing; the drop, which comes between steps, plays on them too. */
  private kit: DrumKit = KITS.synthwave;
  /** The chord of the step playing, for a tuned kick to keep clear of. */
  private chord: Chord | null = null;
  /** The lead's last note and when it ends, for a legato note to slide in from it. */
  private lastLead: { note: number; end: number } | null = null;
  private lastBass: { note: number; end: number } | null = null;
  /** The listening stand can switch portamento off, to hear the melody without it. */
  public isGlideOn = true;
  /** The listening stand can play the lead on another voice, to hear the tune in another sound. */
  /** The listening stand's swaps: another lead, bass, pad or kit on any song. */
  public overrides: VoiceOverrides = {};
  /** The layers the heat has brought in this bar (updateLayers). */
  private readonly layersIn = new Set<MusicLayer>();
  /** The section the layers were last decided for. */
  private layersSection: Section | null = null;
  /** How this bar plays differently from the written one (variation.ts), decided on its first step. */
  private variation: BarVariation = barVariation('', '', 0, 0);
  /** Layers the listening stand has silenced; read live on every step. */
  private readonly muted: ReadonlySet<MusicLayer>;
  /** Whether the last step was in overtime, to strike its entry once. */
  private wasOvertime = false;

  constructor(
    instruments: Instruments,
    graph: MusicGraph,
    muted: ReadonlySet<MusicLayer> = new Set(),
  ) {
    this.play = instruments;
    this.graph = graph;
    this.bass = graph.bass;
    this.melody = graph.melody;
    this.muted = muted;
  }

  private has(layer: MusicLayer): boolean {
    return !this.muted.has(layer);
  }

  /** Whether a layer plays now: the heat has brought it in, and the stand hasn't silenced it. */
  private plays(layer: MusicLayer): boolean {
    return this.has(layer) && this.layersIn.has(layer);
  }

  /**
   * Decides, on the bar line, which layers play this bar: each comes in once the section has
   * reached the bar it enters on and intensity reaches where the section has it come in, and
   * leaves a little below. A new section starts afresh.
   */
  private updateLayers(section: Section, bar: number, intensity: number, isFresh: boolean): void {
    const from = section.layers ?? DEFAULT_LAYER_FROM[section.tier] ?? {};
    for (const layer of MUSIC_LAYERS) {
      if (bar < (section.enter?.[layer] ?? 0)) {
        this.layersIn.delete(layer);
        continue;
      }
      const threshold = from[layer] ?? 0;
      const isIn = !isFresh && this.layersIn.has(layer);
      if (intensity >= (isIn ? threshold - LAYER_HYSTERESIS : threshold)) this.layersIn.add(layer);
      else this.layersIn.delete(layer);
    }
  }

  public playStep(context: StepContext): void {
    const { stepInBar: s, section, bar, stepDuration, song, intensity: I } = context;
    const sectionStep = bar * STEPS_PER_BAR + s;
    const chord = chordAt(section, sectionStep);
    // Swing pushes the off-beat 16ths late
    const time = context.time + (s % 2 ? song.swing * stepDuration : 0);
    this.kit = KITS[this.overrides.kit ?? song.kit ?? 'synthwave'];
    this.chord = chord;
    if (s === 0 || section !== this.layersSection) {
      this.updateLayers(section, bar, I, section !== this.layersSection || sectionStep === 0);
      this.layersSection = section;
      this.variation = barVariation(song.id, section.name, context.pass ?? 0, bar);
    }

    const isThin = (context.dramaLevel ?? 0) >= DRAMA_KICK_ONLY;
    this.playOvertime(time, chord, context);

    if (sectionStep === 0) {
      // A crash marks every new section except the quiet ones
      if (section.tier !== 'calm' && this.plays('drums') && !isThin) this.drum('crash', time, 0.12);
      if (this.has('fx')) this.playTransitions(time, context);
      if (section.drop) this.playDrop(time, chord, stepDuration, song.transitions);
    }

    // A break: the music stops dead for the section's last steps, then the next one hits
    if (section.silence) {
      const silenceFrom = section.bars * STEPS_PER_BAR - section.silence;
      if (sectionStep === silenceFrom)
        this.graph.cutOut(context.time, section.silence * stepDuration);
      if (sectionStep >= silenceFrom) return;
    }

    if (this.plays('pads')) this.playHarmony(time, sectionStep, chord, context);
    if (this.plays('bass')) this.playBass(time, chord, context);
    if ((section.arp || section.arpLine) && this.plays('arp')) this.playArp(time, chord, context);

    const leadVoice = this.overrides.lead ?? section.leadVoice ?? song.voices.lead;
    if (this.plays('lead')) {
      this.playMelody(time, section.lead?.[sectionStep], leadVoice, 1, context, true);
    }
    if (this.plays('counter')) {
      this.playMelody(
        time,
        section.counter?.[sectionStep] ?? this.response(context),
        section.counterVoice ?? song.voices.counter,
        COUNTER_SHARE,
        context,
      );
    }

    if (this.plays('drums')) this.playDrums(time, context, isThin);
    if (section.hits && this.plays('fx') && !isThin) this.playHits(time, sectionStep, section.hits);

    if (context.climaxLevel > 0.01 && !isThin) {
      this.playClimaxLayers(time, chord, context);
    }
    if (section.glitch && context.isLastBar && this.has('fx')) {
      this.playGlitch(context.time, context);
    }
  }

  /** The section's faults on the whole mix, over its last bar: drop-outs and a rewind. */
  private playGlitch(time: number, context: StepContext): void {
    const { section, stepInBar: s, stepDuration } = context;
    const pattern = GLITCH_PATTERNS[section.glitch!];
    // A fault and the steps it lasts for: a run of x is one drop-out, r holds over its -
    const fault = pattern[s];
    if ((fault !== 'x' && fault !== 'r') || (fault === 'x' && pattern[s - 1] === 'x')) return;
    const hold = fault === 'x' ? 'x' : '-';
    let steps = 1;
    while (pattern[s + steps] === hold) steps++;
    if (fault === 'x') {
      this.graph.cutOut(time, steps * stepDuration);
    } else {
      this.graph.rewind(time, steps * stepDuration);
    }
  }

  /**
   * What marks the start of a section: a build rises into what follows, ending on its downbeat
   * (noise riser, a tonal one when the match is hot, a reverse crash); the music coming down from
   * the heat falls away; coming up out of the calm, it draws breath with a whoosh.
   */
  private playTransitions(time: number, context: StepContext): void {
    const { section, stepDuration, intensity: I, previousTier, song } = context;
    const style = song.transitions ?? 'synth';
    // A band marks its turns with what it plays: no swells, no sweeps
    if (style === 'band') return;
    if (section.riser && style === 'drums') {
      // A reverse crash and a reverse snare sucking in to the downbeat, no noise
      const end = time + section.bars * STEPS_PER_BAR * stepDuration;
      this.play.transition('reverseCrash', time, TRANSITION_VOLUME.REVERSE_CRASH, end);
      this.play.transition('reverseSnare', time, TRANSITION_VOLUME.REVERSE_SNARE, end);
      return;
    }
    if (section.riser) {
      const end = time + section.bars * STEPS_PER_BAR * stepDuration;
      const volume = RISER_VOLUME * (0.6 + 0.4 * I);
      if (!this.play.transition('riser', time, volume, end)) {
        this.play.riser(time, end - time, volume);
      }
      if (I > TRANSITION_VOLUME.RISER_TONE_INTENSITY) {
        this.play.transition('riserTone', time, TRANSITION_VOLUME.RISER_TONE * I, end);
      }
      this.play.transition('reverseCrash', time, TRANSITION_VOLUME.REVERSE_CRASH, end);
      return;
    }
    if (!previousTier || style === 'drums') return;
    const change = TIER_HEAT[section.tier] - TIER_HEAT[previousTier];
    if (change < 0 && TIER_HEAT[previousTier] >= TIER_HEAT.rise) {
      this.play.transition('downlifter', time, TRANSITION_VOLUME.DOWNLIFTER);
    } else if (previousTier === 'calm' && section.tier === 'groove') {
      this.play.transition('noiseWave', time, TRANSITION_VOLUME.NOISE_WAVE);
    }
  }

  /** The one-shot sounds the section strikes on this step, each on its own pattern. */
  private playHits(time: number, sectionStep: number, hits: Partial<Record<string, string>>): void {
    for (const [id, pattern] of Object.entries(hits)) {
      if (!pattern) continue;
      const velocity = HIT_VELOCITY[pattern[sectionStep % pattern.length]] ?? 0;
      if (velocity > 0) this.play.fxHit(id, time, FX_HIT_VOLUME * velocity);
    }
  }

  /**
   * One-shot impact when the build-up peaks: crash, heavy kick and a long held bass note; a
   * band's drop is the crash and the kick alone.
   */
  public playDrop(
    time: number,
    chord: Chord,
    stepDuration: number,
    style: TransitionStyle = 'synth',
  ): void {
    if (this.has('drums')) {
      this.drum('crash', time, 0.22);
      this.drum('kick', time, 1.0);
      this.play.impact(this.kit, time, 0.8);
    }
    if (style === 'band') return;
    if (this.has('fx')) this.play.transition('boom', time, TRANSITION_VOLUME.BOOM);
    if (!this.has('bass')) return;
    // Bass root register (not an octave lower) so it stays audible on phone speakers
    const root = placeAbove(chord.root, BASS_LOW);
    this.play.note('sawtooth', root, time, stepDuration * 8, 0.22, this.bass, 900);
  }

  /** Pad on every chord change, and stabs on the section's stab pattern. */
  private playHarmony(time: number, sectionStep: number, chord: Chord, context: StepContext): void {
    const { section, stepInBar: s, stepDuration, intensity: I } = context;

    const isChordStart =
      s % 8 === 0 && (sectionStep === 0 || chordAt(section, sectionStep - 1) !== chord);
    if (isChordStart) {
      this.voicing = voiceChord(chord, this.voicing);

      if (section.pad !== 'none' && section.pad !== 'chop') {
        // Hold until the chord changes, within the section
        let length = 8;
        while (
          sectionStep + length < section.bars * STEPS_PER_BAR &&
          chordAt(section, sectionStep + length) === chord
        ) {
          length += 8;
        }
        this.play.pad(
          this.voicing,
          time,
          length * stepDuration,
          PAD_VOLUME + 0.02 * I,
          (700 + I * 1800) * sweepAt(section, 'pads', sectionStep),
          section.pad === 'swell',
          this.overrides.pad ?? context.song.voices.pad,
        );
      }
    }

    // A chopped pad: the chord cut into a rhythm, a short note on every gate step
    if (section.pad === 'chop' && this.voicing && PAD_CHOP[s] !== '.') {
      this.play.pad(
        this.voicing,
        time,
        stepDuration * 0.9,
        (PAD_VOLUME + 0.02 * I) * CHOP_BOOST,
        (700 + I * 1800) * sweepAt(section, 'pads', sectionStep),
        false,
        this.overrides.pad ?? context.song.voices.pad,
      );
    }

    const stabs = section.stabs ? STAB_PATTERNS[section.stabs] : '';
    if (this.voicing && stabs[s] && stabs[s] !== '.' && stabs[s] !== '-') {
      // A stab rings a little past its step, or as long as the pattern holds it
      const held = heldSteps(stabs, s);
      this.play.stab(
        this.voicing,
        time,
        stepDuration * (held > 1 ? held - 0.1 : 1.5),
        STAB_VOLUME * (0.7 + 0.3 * I),
        section.stabsVoice,
      );
    }
  }

  /**
   * Call and response: when the part comes back and the lead rests for a bar, the counter voice
   * answers with the lead's bar before, an octave up. Null where there is nothing to answer.
   */
  private response(context: StepContext): MelodyNote | null {
    const { section, bar, stepInBar: s } = context;
    const lead = section.lead;
    if (!lead || (context.pass ?? 0) < 1 || bar < 1) return null;
    const barStart = bar * STEPS_PER_BAR;
    const restsHere = lead.slice(barStart, barStart + STEPS_PER_BAR).every((note) => !note);
    if (!restsHere) return null;
    const call = lead[barStart - STEPS_PER_BAR + s];
    return call ? { note: call.note + 12, steps: call.steps } : null;
  }

  private playBass(time: number, chord: Chord, context: StepContext): void {
    const { section, stepInBar: s, stepDuration } = context;
    const line = section.bassLine;
    if (line) {
      // A written riff plays as written: it is the track's hook, not to be varied at random
      const written = line[context.bar * STEPS_PER_BAR + s];
      if (!written) return;
      this.playBassNote(written.note, time, stepDuration * (written.steps - 0.1), context);
      return;
    }
    const pattern = BASS_PATTERNS[section.bass ?? 'long'];
    // The approach note aims at the chord after this one: halfway through the bar, or the next bar
    const next = s < 8 ? chordAt(section, context.bar * STEPS_PER_BAR + 8) : context.nextBarChord;
    // On a repeat the root sometimes jumps up an octave
    const token = pattern[s] === 'R' && this.variation.bassOctaves.has(s) ? 'O' : pattern[s];
    const note = bassNote(token, chord, next);
    if (note === null) return;

    this.playBassNote(note, time, stepDuration * (heldSteps(pattern, s) - 0.1), context);
  }

  /** A bass note, sliding in from the one before when the song glides its bass and they join. */
  private playBassNote(note: number, time: number, duration: number, context: StepContext): void {
    const { stepDuration, intensity: I, song } = context;
    const last = this.lastBass;
    const isLegato = last !== null && time - last.end < stepDuration * 0.5;
    const interval = isLegato ? Math.abs(note - last.note) : 0;
    const glide =
      song.voices.bassGlide && interval > 0 && interval <= BASS_GLIDE_MAX_INTERVAL
        ? { from: last!.note, time: song.voices.bassGlide }
        : undefined;
    this.lastBass = { note, end: time + duration };
    this.play.bass(
      this.overrides.bass ?? song.voices.bass,
      note,
      time,
      duration,
      BASS_VOLUME + 0.08 * I,
      this.bass,
      450 + I * 1500,
      glide,
    );
  }

  private playArp(time: number, chord: Chord, context: StepContext): void {
    const { section, stepInBar: s, stepDuration, intensity: I, song, difficulty } = context;
    let note: number;
    if (section.arpLine) {
      // A written ostinato plays as written
      const written = section.arpLine[context.bar * STEPS_PER_BAR + s];
      if (!written) return;
      if (section.arpVoice) {
        // On a lead's voice, each note as long as it is written, under the melody's level
        const voice = section.arpVoice;
        this.play.lead(
          voice,
          written.note,
          time,
          written.steps * stepDuration * 0.95,
          LEAD_VOLUME[voice] * ARP_LEAD_SHARE * (0.65 + 0.35 * I),
          this.melody,
          (1800 + I * 2200) * DIFFICULTY_SIGNATURES[difficulty].leadBrightness,
        );
        return;
      }
      note = written.note;
    } else {
      // On a repeat the pattern is read a little ahead on every second bar
      const token = ARP_PATTERNS[section.arp!][(s + this.variation.arpShift) % STEPS_PER_BAR];
      if (token === '.') return;
      note = arpNote(chord, Number(token));
    }

    const signature = DIFFICULTY_SIGNATURES[difficulty];
    const underLead = section.lead && this.plays('lead');
    const volume = ARP_VOLUME * (0.5 + 0.5 * I) * (underLead ? ARP_UNDER_LEAD.VOLUME : 1);
    const sectionStep = context.bar * STEPS_PER_BAR + s;
    const cutoff =
      (1400 + I * 2600) *
      signature.leadBrightness *
      sweepAt(section, 'arp', sectionStep) *
      (underLead ? ARP_UNDER_LEAD.BRIGHTNESS : 1);
    this.play.arp(song.voices.arp, note, time, stepDuration * 1.6, volume, this.melody, cutoff);

    if (signature.stutter && s % 4 === 0) {
      const at = time + stepDuration * 0.5;
      this.play.arp(
        song.voices.arp,
        note + 12,
        at,
        stepDuration * 0.5,
        volume * 0.6,
        this.melody,
        cutoff,
      );
    }
  }

  private playMelody(
    time: number,
    melodyNote: MelodyNote | null | undefined,
    voice: LeadVoice,
    share: number,
    context: StepContext,
    isLead = false,
  ): void {
    if (!melodyNote) return;
    const { stepDuration, intensity: I, difficulty, song } = context;
    const brightness = DIFFICULTY_SIGNATURES[difficulty].leadBrightness;
    const duration = melodyNote.steps * stepDuration * 0.95;

    // A lead note straight after the last one, with no rest between, slides in from it
    const last = isLead ? this.lastLead : null;
    const isLegato = last !== null && time - last.end < stepDuration * 0.5;
    const interval = isLegato ? Math.abs(melodyNote.note - last.note) : 0;
    const glide =
      this.isGlideOn && song.voices.glide && interval > 0 && interval <= GLIDE.MAX_INTERVAL
        ? { from: last!.note, time: Math.min(song.voices.glide, GLIDE.MAX_TIME) }
        : undefined;
    if (isLead) this.lastLead = { note: melodyNote.note, end: time + duration };
    // A phrase's end: the song's own lead lets a note before a rest fall
    const sectionStep = context.bar * STEPS_PER_BAR + context.stepInBar;
    const isPhraseEnd =
      isLead &&
      voice === song.voices.lead &&
      !context.section.lead?.[sectionStep + melodyNote.steps];
    const fall = isPhraseEnd ? song.voices.fall : undefined;

    this.play.lead(
      voice,
      melodyNote.note,
      time,
      duration,
      LEAD_VOLUME[voice] * share * (0.65 + 0.35 * I),
      this.melody,
      (1800 + I * 2200) * brightness,
      glide,
      fall,
    );
  }

  /**
   * Overtime's alarm on the eighths, and its entry on the step it starts (OVERTIME); silent
   * while the stand has the fx muted.
   */
  private playOvertime(time: number, chord: Chord, context: StepContext): void {
    const isOvertime = context.isOvertime === true;
    const isEntry = isOvertime && !this.wasOvertime;
    this.wasOvertime = isOvertime;
    if (!isOvertime || !this.has('fx')) return;

    if (isEntry) {
      this.drum('crash', time, OVERTIME.CRASH);
      this.drum('kick', time, OVERTIME.KICK);
    }
    const { stepInBar: s, stepDuration, song } = context;
    if (s % 2 !== 0) return;
    const isOffbeat = s % 4 === 2;
    const root = placeAbove(chord.root, ARP_LOW);
    this.play.arp(
      song.voices.arp,
      isOffbeat ? root + 12 : root,
      time,
      stepDuration * 0.9,
      OVERTIME.VOLUME * (isOffbeat ? OVERTIME.OFFBEAT : 1),
      this.graph.bus,
      OVERTIME.CUTOFF,
    );
  }

  /**
   * The section's beat, the fill in the second half of a last bar, and hats that heat up; the
   * kick alone when `isThin` (the deciding point).
   */
  private playDrums(time: number, context: StepContext, isThin = false): void {
    const { section, stepInBar: s, intensity: I, isLastBar } = context;
    const hit = (line: string | undefined, index: number) =>
      HIT_VELOCITY[line?.[index] ?? '.'] ?? 0;

    const fill: DrumFill | null =
      isLastBar && s >= 8 && section.fill ? DRUM_FILLS[section.fill] : null;
    if (fill) {
      const i = s - 8;
      this.playKick(time, hit(fill.kick, i), I);
      if (isThin) return;
      const snare = hit(fill.snare, i);
      if (snare) this.drum('snare', time, snare * (0.18 + 0.12 * I));
      const tom = fill.tom?.[i];
      if (tom && tom !== '.') this.drum('tom', time, 0.35, TOM_RATES[tom]);
      const open = hit(fill.open, i);
      if (open) this.drum('open', time, open * 0.08);
      this.playTaiko(time, hit(fill.taiko, i), I);
      return;
    }

    const beat: DrumPattern = DRUM_PATTERNS[section.drums];
    // The feel stretches or squeezes the heavy drums; the hats keep the written time
    const step = feelStep(section.feel, s, context.bar);
    const felt = (line: string | undefined) => (step === null ? 0 : hit(line, step));
    this.playKick(time, felt(beat.kick), I);
    if (isThin) return;
    this.playTaiko(time, felt(beat.taiko), I);

    const snareLevel = 0.18 + 0.12 * I;
    const { variation } = this;
    const isPhraseFill = variation.phraseFill && !isLastBar && s >= PHRASE_FILL.FROM_STEP;
    const snare = isPhraseFill
      ? PHRASE_FILL.VELOCITIES[s - PHRASE_FILL.FROM_STEP]
      : felt(beat.snare) || (beat.snare && variation.ghostSnares.has(s) ? GHOST_SNARE : 0);
    if (snare) this.drum('snare', time, snare * snareLevel);
    const clap = felt(beat.clap);
    if (clap) this.drum('clap', time, clap * (0.22 + 0.1 * I));

    const hat = hit(beat.hat, s);
    if (hat) {
      this.drum('hat', time, hat * (0.05 + 0.05 * I));
    } else if (section.tier === 'groove' && I > GROOVE_EXTRA_HATS_INTENSITY && s % 2 === 0) {
      this.drum('hat', time, clamp((I - 0.4) * 0.08, 0, 0.035));
    }
    const open = hit(beat.open, s);
    if (open) this.drum('open', time, open * (0.05 + 0.04 * I));
    const metal = felt(beat.metal);
    if (metal) this.drum('metal', time, metal * (0.08 + 0.06 * I));
    const perc = hit(beat.perc, s);
    if (perc) this.drum('perc', time, perc * (0.06 + 0.05 * I));
  }

  private drum(role: DrumRole, time: number, volume: number, rate = 1): void {
    this.play.drum(this.kit, role, time, volume, rate);
  }

  private playKick(time: number, velocity: number, intensity: number): void {
    if (!velocity) return;
    const rate = this.chord ? kickRate(this.kit, this.chord) : 1;
    this.drum('kick', time, velocity * (0.4 + 0.35 * intensity), rate);
  }

  private playTaiko(time: number, velocity: number, intensity: number): void {
    if (velocity) this.drum('taiko', time, velocity * (0.35 + 0.25 * intensity));
  }

  /** Extra layers that only play during the climax, on top of the full mix. */
  private playClimaxLayers(time: number, chord: Chord, context: StepContext): void {
    const { stepInBar: s, stepDuration, climaxLevel: mix, section } = context;

    if (this.has('drums')) {
      // Crash on every bar
      if (s === 0) {
        this.drum('crash', time, 0.12 * mix);
      }

      // Open hats on the off-beats
      if (s % 4 === 2) {
        this.drum('open', time, 0.07 * mix);
      }
    }
    if (!this.has('arp')) return;

    // Sparkle arpeggio an octave above the chord, running ahead of the section's own
    const pattern = ARP_PATTERNS[section.arp ?? 'up'];
    const token = pattern[(s + 2) & 15];
    if (token !== '.') {
      let note = arpNote(chord, Number(token)) + 12;
      while (note > SPARKLE_HIGH) note -= 12;
      this.play.note('square', note, time, stepDuration * 0.9, 0.025 * mix, this.melody, 6000);
    }
  }
}
