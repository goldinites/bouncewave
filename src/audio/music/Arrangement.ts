import { Instruments } from '@/audio/music/Instruments';
import { MusicGraph } from '@/audio/music/MusicGraph';
import { TrackConfig, CHORD_TYPES, BASS_PATTERNS } from '@/audio/music/tracks';
import { clamp } from '@/shared/math';

/** Everything that decides what one 16th-note step plays. */
export interface StepContext {
  time: number;
  /** Absolute step counter; 16 steps per bar, 4 bars per chord loop, 256 per song. */
  step: number;
  stepDuration: number;
  track: TrackConfig;
  /** 0..1: how hot the game is right now; more layers join as it rises. */
  intensity: number;
  /** 0..1: rally climax build-up; fades the climax-only layers in. */
  climaxLevel: number;
}

/**
 * The composition: which instruments play on which step at which intensity.
 * Layers enter in order as intensity rises: pad, bass, kick and hats always;
 * snare above 0.2, lead arpeggio above 0.25, extra hats above 0.45, melody above 0.6;
 * and climax layers on top while a long rally builds.
 */
export class Arrangement {
  private readonly play: Instruments;
  private readonly bus: AudioNode;
  private readonly aux: AudioNode;

  constructor(instruments: Instruments, graph: MusicGraph) {
    this.play = instruments;
    this.bus = graph.bus;
    this.aux = graph.aux;
  }

  public playStep({
    time,
    step,
    stepDuration,
    track,
    intensity: I,
    climaxLevel,
  }: StepContext): void {
    const bar = (step >> 4) & 3;
    const stepInBar = step & 15;
    const root = track.rootNotes[bar];
    const triad = CHORD_TYPES[track.chordTypes[bar]];

    // Crash at the top of every song
    if (step % 256 === 0) {
      this.play.noise(time, 1.2, 0.14, 3000);
    }

    if (stepInBar === 0) {
      this.play.pad(
        triad.map((x) => root + 12 + x),
        time,
        stepDuration * 16,
        0.03 + 0.03 * I,
        700 + I * 1800,
      );
    }

    if (BASS_PATTERNS[track.bassPatternIndex][stepInBar] === '1') {
      const bassNote = root + (stepInBar % 8 === 6 ? 12 : 0);
      this.play.note(
        'sawtooth',
        bassNote,
        time,
        stepDuration * 1.8,
        0.16 + 0.1 * I,
        this.bus,
        500 + I * 1800,
      );
    }

    if (stepInBar % 4 === 0) {
      this.play.kick(time, 0.3 + 0.4 * I);
    }

    // Snare on 2 and 4
    if ((stepInBar === 4 || stepInBar === 12) && I > 0.2) {
      this.play.noise(time, 0.25, 0.2 + 0.15 * I, 1200);
    }

    // Hi-hats: off-beat 16ths, plus the remaining 8ths once it heats up
    if (stepInBar % 2) {
      this.play.noise(time, 0.05, 0.04 + 0.05 * I, 7000);
    } else if (I > 0.45 && stepInBar % 4) {
      this.play.noise(time, 0.03, clamp((I - 0.4) * 0.08, 0, 0.035), 8000);
    }

    if (I > 0.25) {
      const arpeggioIndex = track.arpeggioPattern[stepInBar];
      const leadNote = root + 24 + triad[arpeggioIndex % 3] + (arpeggioIndex > 2 ? 12 : 0);
      this.play.note(
        track.arpeggioWave,
        leadNote,
        time,
        stepDuration * 1.6,
        clamp((I - 0.22) * 0.14, 0, 0.07),
        this.aux,
        1500 + I * 2500,
      );
    }

    if (I > 0.6 && stepInBar % 4 === 0) {
      const chordIndex = (stepInBar >> 2) % 3;
      const melodyNote = root + 36 + triad[chordIndex];
      this.play.note(
        'sawtooth',
        melodyNote,
        time,
        stepDuration * 3.5,
        clamp((I - 0.55) * 0.14, 0, 0.055),
        this.aux,
        2500,
      );
    }

    if (climaxLevel > 0.01) {
      this.playClimaxLayers(time, stepInBar, stepDuration, root, triad, track, climaxLevel);
    }
  }

  /** One-shot impact when the build-up peaks: crash, heavy kick and a long held bass note. */
  public playDrop(time: number, root: number, stepDuration: number): void {
    this.play.noise(time, 1.6, 0.22, 2500);
    this.play.kick(time, 1.0);
    // Bass root register (not an octave lower) so it stays audible on phone speakers
    this.play.note('sawtooth', root, time, stepDuration * 8, 0.22, this.bus, 900);
  }

  /** Extra layers that only play during the climax, on top of the full-intensity mix. */
  private playClimaxLayers(
    time: number,
    stepInBar: number,
    stepDuration: number,
    root: number,
    triad: number[],
    track: TrackConfig,
    mix: number,
  ): void {
    // Crash on every bar
    if (stepInBar === 0) {
      this.play.noise(time, 0.9, 0.12 * mix, 4000);
    }

    // Open hats on the off-beats
    if (stepInBar % 4 === 2) {
      this.play.noise(time, 0.12, 0.07 * mix, 9000);
    }

    // Sparkle arpeggio an octave above the lead
    const arpeggioIndex = track.arpeggioPattern[(stepInBar + 2) & 15];
    const sparkleNote = root + 36 + triad[arpeggioIndex % 3] + (arpeggioIndex > 2 ? 12 : 0);
    this.play.note('square', sparkleNote, time, stepDuration * 0.9, 0.025 * mix, this.aux, 6000);
  }
}
