import { StepScheduler } from '@/audio/music/StepScheduler';
import { midiToFrequency } from '@/shared/math';

const BPM = 92;
const STEP_SECONDS = 60 / BPM / 4; // 16th notes
const MASTER_LEVEL = 0.26;
const FADE_SECONDS = 0.4; // slow fade, like a menu screen's music easing in

const STEPS_PER_BAR = 16;
// i - VI - III - VII in A minor: the warm, slightly wistful loop late-90s menu screens ran on
const CHORD_ROOTS = [57, 53, 48, 55]; // A3, F3, C3, G3
const STEPS_PER_PROGRESSION = STEPS_PER_BAR * CHORD_ROOTS.length;
// Root, 5th, b7, 9th — no 3rd, so the same voicing reads fine over a major or minor root
const PAD_INTERVALS = [0, 7, 10, 14];

// Two bars (32 steps) of a soft, sparse lead over the progression — -1 holds silence
const LEAD_PATTERN: number[] = [
  69, -1, -1, 72, -1, -1, 76, -1, 74, -1, -1, 72, -1, -1, -1, -1, 67, -1, -1, 71, -1, -1, 74, -1,
  72, -1, -1, 69, -1, -1, -1, -1,
];

// A synthetic reverb tail, standing in for the SPU's own hardware reverb unit
const REVERB_SECONDS = 2.2;
const REVERB_DECAY = 2.5;
const REVERB_MIX = 0.38;

/**
 * A warm, reverb-washed loop for classic mode: detuned pad chords, a soft sine bass, a lead
 * with a little vibrato, and a laid-back half-time groove — the sound of a PS1-era menu
 * screen rather than an NES chiptune. Independent of MusicEngine, so the synthwave mix's own
 * graph never has to branch for it.
 */
export class Ps1MusicEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private dryBus: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private active = false;
  /** The active state last sent to the gain node, so `setActive` can skip redundant calls. */
  private appliedActive: boolean | null = null;
  private currentStep = 0;
  private scheduler: StepScheduler | null = null;

  /** Builds the audio graph and starts the scheduler; safe to call more than once. */
  public init(context: AudioContext): void {
    if (this.context) return;
    this.context = context;

    this.master = context.createGain();
    this.master.gain.value = 0;
    this.master.connect(context.destination);

    this.dryBus = context.createGain();
    this.dryBus.connect(this.master);

    const reverb = context.createConvolver();
    reverb.buffer = this.buildReverbImpulse(context);
    reverb.connect(this.master);

    this.reverbSend = context.createGain();
    this.reverbSend.gain.value = REVERB_MIX;
    this.reverbSend.connect(reverb);

    this.noiseBuffer = this.buildNoiseBuffer(context);

    // Only runs while the loop is on: switched back on later, the clock resyncs to the present
    // and the loop picks up where it stopped, rather than replaying every step it missed
    this.scheduler = new StepScheduler(context, {
      playStep: (time) => this.playStep(time),
      canRun: () => this.active,
    });
  }

  /**
   * Fades the loop in or out; switched off, it stops scheduling notes. Called every frame, so it only touches the gain node when the state actually flips —
   * otherwise it would pile up a fresh automation event on the gain param 60 times a second.
   */
  public setActive(active: boolean): void {
    this.active = active;
    if (!this.context || !this.master || this.appliedActive === active) return;

    this.appliedActive = active;
    this.master.gain.setTargetAtTime(
      active ? MASTER_LEVEL : 0,
      this.context.currentTime,
      FADE_SECONDS,
    );
  }

  public dispose(): void {
    this.scheduler?.dispose();
    this.scheduler = null;
  }

  private buildReverbImpulse(context: AudioContext): AudioBuffer {
    const length = Math.floor(context.sampleRate * REVERB_SECONDS);
    const impulse = context.createBuffer(2, length, context.sampleRate);

    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, REVERB_DECAY);
      }
    }

    return impulse;
  }

  private buildNoiseBuffer(context: AudioContext): AudioBuffer {
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** Plays the step at `time`. @returns its length in seconds */
  private playStep(time: number): number {
    const step = this.currentStep;
    const stepInLoop = step % STEPS_PER_PROGRESSION;
    const bar = Math.floor(stepInLoop / STEPS_PER_BAR);
    const stepInBar = stepInLoop % STEPS_PER_BAR;
    const root = CHORD_ROOTS[bar];

    if (stepInBar === 0) this.playPad(root, time);
    if (stepInBar === 0 || stepInBar === 8) this.playBass(root, time);

    const leadNote = LEAD_PATTERN[step % LEAD_PATTERN.length];
    if (leadNote >= 0) this.playLead(leadNote, time);

    // Half-time groove: kick on 1 and 3, snare on the backbeat, a soft constant 8th hat
    if (stepInBar === 0 || stepInBar === 8) this.playKick(time);
    if (stepInBar === 4 || stepInBar === 12) this.playSnare(time);
    if (stepInBar % 2 === 1) this.playHat(time);

    this.currentStep++;
    return STEP_SECONDS;
  }

  /** Slow-swelling detuned chord, the pad underneath everything else. */
  private playPad(root: number, time: number): void {
    if (!this.context || !this.dryBus || !this.reverbSend) return;
    const duration = STEP_SECONDS * STEPS_PER_BAR;

    for (const interval of PAD_INTERVALS) {
      for (const detune of [-6, 6]) {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        const filter = this.context.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.value = midiToFrequency(root + interval);
        osc.detune.value = detune;
        filter.type = 'lowpass';
        filter.frequency.value = 1600;

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.05, time + 0.6);
        gain.gain.linearRampToValueAtTime(0, time + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.dryBus);
        gain.connect(this.reverbSend);

        osc.start(time);
        osc.stop(time + duration + 0.05);
      }
    }
  }

  /** Smooth sine bass, legato under the half-time kick. */
  private playBass(root: number, time: number): void {
    if (!this.context || !this.dryBus) return;
    const duration = STEP_SECONDS * 8;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = 'sine';
    osc.frequency.value = midiToFrequency(root - 12);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.3, time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.dryBus);

    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  /** A soft lead with a little vibrato, sent to the reverb for an airy tail. */
  private playLead(note: number, time: number): void {
    if (!this.context || !this.dryBus || !this.reverbSend) return;
    const duration = STEP_SECONDS * 3;

    const osc = this.context.createOscillator();
    const vibrato = this.context.createOscillator();
    const vibratoGain = this.context.createGain();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.value = midiToFrequency(note);
    filter.type = 'lowpass';
    filter.frequency.value = 3200;

    vibrato.frequency.value = 5.5;
    vibratoGain.gain.value = 4;
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.detune);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.22, time + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.dryBus);
    gain.connect(this.reverbSend);

    vibrato.start(time);
    osc.start(time);
    osc.stop(time + duration + 0.05);
    vibrato.stop(time + duration + 0.05);
  }

  /** Soft pitch-dropping kick, gentler than an arcade thump. */
  private playKick(time: number): void {
    if (!this.context || !this.dryBus) return;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.frequency.setValueAtTime(110, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.18);

    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

    osc.connect(gain);
    gain.connect(this.dryBus);

    osc.start(time);
    osc.stop(time + 0.32);
  }

  /** Band-passed noise snare on the backbeat, with a touch of reverb. */
  private playSnare(time: number): void {
    if (!this.context || !this.dryBus || !this.reverbSend || !this.noiseBuffer) return;

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    source.buffer = this.noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.value = 1800;

    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.dryBus);
    gain.connect(this.reverbSend);

    source.start(time);
    source.stop(time + 0.2);
  }

  /** A brushed, high-passed tick — never loud enough to fight the pad. */
  private playHat(time: number): void {
    if (!this.context || !this.dryBus || !this.noiseBuffer) return;

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    source.buffer = this.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.value = 6000;

    gain.gain.setValueAtTime(0.05, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.dryBus);

    source.start(time);
    source.stop(time + 0.06);
  }
}
