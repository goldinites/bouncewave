import { Instruments, TOM_RATES } from '@/audio/music/Instruments';
import { DrumKit, DrumRole, KITS } from '@/audio/music/kits';
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
  STAB_PATTERNS,
} from '@/audio/music/patterns';
import {
  chordAt,
  LeadVoice,
  MelodyNote,
  Section,
  Song,
  STEPS_PER_BAR,
  Tier,
} from '@/audio/music/score';
import { Chord, placeAbove, voiceChord } from '@/audio/music/theory';
import { DifficultyLevel } from '@/match/difficulty';
import { clamp } from '@/shared/math';

/**
 * The parts the listening stand can silence one by one: drums (crashes included), bass, pads
 * (and stabs), arpeggio (and the climax sparkle), lead, counter-melody, and fx (risers and a
 * song's faults).
 */
export const MUSIC_LAYERS = ['drums', 'bass', 'pads', 'arp', 'lead', 'counter', 'fx'] as const;

export type MusicLayer = (typeof MUSIC_LAYERS)[number];

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
  /** 0..1: how hot the game is right now; the mix fills out and brightens as it rises. */
  intensity: number;
  /** 0..1: rally climax build-up; fades the climax-only layers in. */
  climaxLevel: number;
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

// In a groove section some layers wait for the rally to heat up
const GROOVE_ARP_INTENSITY = 0.4;
const GROOVE_EXTRA_HATS_INTENSITY = 0.45;
const GROOVE_COUNTER_INTENSITY = 0.55;

// Peak levels; most scale with intensity on top
const LEAD_VOLUME: Record<LeadVoice, number> = {
  saw: 0.075,
  square: 0.06,
  bell: 0.11,
  pluck: 0.09,
  koto: 0.1,
  flute: 0.085,
};
const COUNTER_SHARE = 0.55;
const ARP_VOLUME = 0.045;
const PAD_VOLUME = 0.022;
const STAB_VOLUME = 0.05;
const BASS_VOLUME = 0.15;
const RISER_VOLUME = 0.07;
// Transitions, peak levels; the tonal riser joins the noise one only once the match is hot
const TRANSITION_VOLUME = {
  REVERSE_CRASH: 0.09,
  RISER_TONE: 0.05,
  RISER_TONE_INTENSITY: 0.5,
  DOWNLIFTER: 0.08,
  NOISE_WAVE: 0.05,
  BOOM: 0.5,
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
  /** Layers the listening stand has silenced; read live on every step. */
  private readonly muted: ReadonlySet<MusicLayer>;

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

  public playStep(context: StepContext): void {
    const { stepInBar: s, section, bar, stepDuration, song, intensity: I } = context;
    const sectionStep = bar * STEPS_PER_BAR + s;
    const chord = chordAt(section, sectionStep);
    // Swing pushes the off-beat 16ths late
    const time = context.time + (s % 2 ? song.swing * stepDuration : 0);
    const isGroove = section.tier === 'groove';
    this.kit = KITS[song.kit ?? 'synthwave'];

    if (sectionStep === 0) {
      // A crash marks every new section except the quiet ones
      if (section.tier !== 'calm' && this.has('drums')) this.drum('crash', time, 0.12);
      if (this.has('fx')) this.playTransitions(time, context);
    }

    if (this.has('pads')) this.playHarmony(time, sectionStep, chord, context);
    if (this.has('bass')) this.playBass(time, chord, context);

    if (section.arp && (!isGroove || I > GROOVE_ARP_INTENSITY) && this.has('arp')) {
      this.playArp(time, chord, context);
    }

    const leadVoice = section.leadVoice ?? song.voices.lead;
    if (this.has('lead')) {
      this.playMelody(time, section.lead?.[sectionStep], leadVoice, 1, context);
    }
    if ((!isGroove || I > GROOVE_COUNTER_INTENSITY) && this.has('counter')) {
      this.playMelody(
        time,
        section.counter?.[sectionStep],
        song.voices.counter,
        COUNTER_SHARE,
        context,
      );
    }

    if (this.has('drums')) this.playDrums(time, context);

    if (context.climaxLevel > 0.01) {
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
    const { section, stepDuration, intensity: I, previousTier } = context;
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
    if (!previousTier) return;
    const change = TIER_HEAT[section.tier] - TIER_HEAT[previousTier];
    if (change < 0 && TIER_HEAT[previousTier] >= TIER_HEAT.rise) {
      this.play.transition('downlifter', time, TRANSITION_VOLUME.DOWNLIFTER);
    } else if (previousTier === 'calm' && section.tier === 'groove') {
      this.play.transition('noiseWave', time, TRANSITION_VOLUME.NOISE_WAVE);
    }
  }

  /** One-shot impact when the build-up peaks: crash, heavy kick and a long held bass note. */
  public playDrop(time: number, chord: Chord, stepDuration: number): void {
    if (this.has('drums')) {
      this.drum('crash', time, 0.22);
      this.drum('kick', time, 1.0);
      this.play.impact(this.kit, time, 0.8);
    }
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

      if (section.pad !== 'none') {
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
          700 + I * 1800,
          section.pad === 'swell',
        );
      }
    }

    if (section.stabs && this.voicing && STAB_PATTERNS[section.stabs][s] !== '.') {
      this.play.stab(this.voicing, time, stepDuration * 1.5, STAB_VOLUME * (0.7 + 0.3 * I));
    }
  }

  private playBass(time: number, chord: Chord, context: StepContext): void {
    const { section, stepInBar: s, stepDuration, intensity: I, song } = context;
    const pattern = BASS_PATTERNS[section.bass];
    // The approach note aims at the chord after this one: halfway through the bar, or the next bar
    const next = s < 8 ? chordAt(section, context.bar * STEPS_PER_BAR + 8) : context.nextBarChord;
    const note = bassNote(pattern[s], chord, next);
    if (note === null) return;

    this.play.bass(
      song.voices.bass,
      note,
      time,
      stepDuration * (heldSteps(pattern, s) - 0.1),
      BASS_VOLUME + 0.08 * I,
      this.bass,
      450 + I * 1500,
    );
  }

  private playArp(time: number, chord: Chord, context: StepContext): void {
    const { section, stepInBar: s, stepDuration, intensity: I, song, difficulty } = context;
    const token = ARP_PATTERNS[section.arp!][s];
    if (token === '.') return;

    const signature = DIFFICULTY_SIGNATURES[difficulty];
    const note = arpNote(chord, Number(token));
    const volume = ARP_VOLUME * (0.5 + 0.5 * I);
    const cutoff = (1400 + I * 2600) * signature.leadBrightness;
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
  ): void {
    if (!melodyNote) return;
    const { stepDuration, intensity: I, difficulty } = context;
    const brightness = DIFFICULTY_SIGNATURES[difficulty].leadBrightness;

    this.play.lead(
      voice,
      melodyNote.note,
      time,
      melodyNote.steps * stepDuration * 0.95,
      LEAD_VOLUME[voice] * share * (0.65 + 0.35 * I),
      this.melody,
      (1800 + I * 2200) * brightness,
    );
  }

  /** The section's beat, the fill in the second half of a last bar, and hats that heat up. */
  private playDrums(time: number, context: StepContext): void {
    const { section, stepInBar: s, intensity: I, isLastBar } = context;
    const hit = (line: string | undefined, index: number) =>
      HIT_VELOCITY[line?.[index] ?? '.'] ?? 0;

    const fill: DrumFill | null =
      isLastBar && s >= 8 && section.fill ? DRUM_FILLS[section.fill] : null;
    if (fill) {
      const i = s - 8;
      this.playKick(time, hit(fill.kick, i), I);
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
    this.playKick(time, hit(beat.kick, s), I);
    this.playTaiko(time, hit(beat.taiko, s), I);

    const snare = hit(beat.snare, s);
    if (snare) this.drum('snare', time, snare * (0.18 + 0.12 * I));
    const clap = hit(beat.clap, s);
    if (clap) this.drum('clap', time, clap * (0.22 + 0.1 * I));

    const hat = hit(beat.hat, s);
    if (hat) {
      this.drum('hat', time, hat * (0.05 + 0.05 * I));
    } else if (section.tier === 'groove' && I > GROOVE_EXTRA_HATS_INTENSITY && s % 2 === 0) {
      this.drum('hat', time, clamp((I - 0.4) * 0.08, 0, 0.035));
    }
    const open = hit(beat.open, s);
    if (open) this.drum('open', time, open * (0.05 + 0.04 * I));
    const metal = hit(beat.metal, s);
    if (metal) this.drum('metal', time, metal * (0.08 + 0.06 * I));
    const perc = hit(beat.perc, s);
    if (perc) this.drum('perc', time, perc * (0.06 + 0.05 * I));
  }

  private drum(role: DrumRole, time: number, volume: number, rate = 1): void {
    this.play.drum(this.kit, role, time, volume, rate);
  }

  private playKick(time: number, velocity: number, intensity: number): void {
    if (velocity) this.drum('kick', time, velocity * (0.4 + 0.35 * intensity));
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
