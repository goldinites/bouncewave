import { clamp } from '@/shared/math';

const MUSIC_MASTER_LEVEL = 0.3; // overall music volume when not muted
const MUSIC_DUCK_LEVEL = 0.25; // music level under the victory sting
// Low-pass cutoff of the music bus at full match-point drama (fully open at level 0)
const DRAMA_FILTER_MIN_FREQ = 550;
const DRAMA_FILTER_MAX_FREQ = 20000;

const ECHO_FEEDBACK = 0.4;
// Echo time follows the tempo, which drifts a little every step; smaller changes are skipped
const ECHO_TIME_TOLERANCE = 0.002; // s
const ANALYSER_FFT_SIZE = 256;
const ANALYSER_SMOOTHING = 0.75;
// Faults of a song that breaks down (GLITCH_PATTERNS)
const GLITCH = {
  EDGE: 0.004, // s the level takes to cut out and come back, short enough to sound like a drop
  REWIND_DEPTH: 0.15, // s the rewind's delay swells to: the pitch sags, then shrieks up
  REWIND_SAG: 0.7, // share of the rewind spent sagging; the rest is the shriek
  // s the held tape's delay swells to: over a 0.6 s hold the pitch sags by up to ~15%, then
  // runs as far sharp as the tape catches up
  HOLD_DEPTH: 0.03,
} as const;

/**
 * The music's audio graph and the effects applied to the whole mix.
 *
 * ```
 * aux ─┬─────────────────────────┐
 *      └─ echo ⇄ feedback ─ echo ─┤
 *                                 bus → toneFilter → compressor → dramaFilter
 *   → glitchDelay → tapeDelay → glitchGain → duckGain ─┬─ master → destination
 *                                                     └─ analyser
 * ```
 * - toneFilter follows the game state (muffled in menus and pause), set per step
 * - dramaFilter muffles on match point; separate so it never fights the tone filter
 * - tapeDelay sits at 0 ms until a tape stop sweeps it to bend the pitch down
 * - glitchDelay and glitchGain are the rewinds and drop-outs of a song that breaks down; their
 *   own nodes, so they never overlap the tape stop's automation
 * - duckGain dips the music under end-of-match stings, independent of the mute gain
 *
 * Parameters are only automated when their value changes: every automation call adds an event
 * to the parameter's timeline, and the scheduler would otherwise add dozens per second for as
 * long as the game runs.
 */
export class MusicGraph {
  public readonly context: AudioContext;
  /** Dry instruments: drums, bass, pads. */
  public readonly bus: GainNode;
  /** Instruments that also feed the echo: leads and arpeggios. */
  public readonly aux: GainNode;
  public readonly noiseBuffer: AudioBuffer;
  public readonly analyser: AnalyserNode;

  private readonly echo: DelayNode;
  private readonly toneFilter: BiquadFilterNode;
  private readonly dramaFilter: BiquadFilterNode;
  private readonly tapeDelay: DelayNode;
  private readonly glitchDelay: DelayNode;
  private readonly glitchGain: GainNode;
  private readonly duckGain: GainNode;
  private readonly master: GainNode;
  private dramaLevel = 0;
  // Last values handed to the audio graph; null until first set
  private isMuted: boolean | null = null;
  private toneFrequency: number | null = null;
  private echoTime: number | null = null;
  /** Audio-clock time the running tape stop's curves end; nothing may overlap them until then. */
  private tapeStopEndsAt = 0;

  constructor(context: AudioContext) {
    this.context = context;
    const ac = context;

    // One second of white noise for percussion (snare, hi-hat, crash)
    this.noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const channelData = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = Math.random() * 2 - 1;
    }

    this.bus = ac.createGain();
    this.aux = ac.createGain();
    this.echo = ac.createDelay(1);
    this.toneFilter = ac.createBiquadFilter();
    this.dramaFilter = ac.createBiquadFilter();
    this.tapeDelay = ac.createDelay(1);
    this.glitchDelay = ac.createDelay(1);
    this.glitchGain = ac.createGain();
    this.duckGain = ac.createGain();
    this.master = ac.createGain();
    this.analyser = ac.createAnalyser();

    const feedback = ac.createGain();
    const compressor = ac.createDynamicsCompressor();

    feedback.gain.value = ECHO_FEEDBACK;
    this.toneFilter.frequency.value = 2800;
    this.dramaFilter.frequency.value = DRAMA_FILTER_MAX_FREQ;
    this.tapeDelay.delayTime.value = 0;
    this.glitchDelay.delayTime.value = 0;
    this.master.gain.value = 0;
    this.analyser.fftSize = ANALYSER_FFT_SIZE;
    this.analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;

    this.aux.connect(this.bus);
    this.aux.connect(this.echo);
    this.echo.connect(feedback);
    feedback.connect(this.echo);
    this.echo.connect(this.bus);
    this.bus.connect(this.toneFilter);
    this.toneFilter.connect(compressor);
    compressor.connect(this.dramaFilter);
    this.dramaFilter.connect(this.glitchDelay);
    this.glitchDelay.connect(this.tapeDelay);
    this.tapeDelay.connect(this.glitchGain);
    this.glitchGain.connect(this.duckGain);
    this.duckGain.connect(this.master);
    this.duckGain.connect(this.analyser);
    this.master.connect(ac.destination);
  }

  private get now(): number {
    return this.context.currentTime;
  }

  public setMuted(isMuted: boolean): void {
    if (isMuted === this.isMuted) return;
    this.isMuted = isMuted;
    this.master.gain.setTargetAtTime(isMuted ? 0 : MUSIC_MASTER_LEVEL, this.now, 0.05);
  }

  /** Overall brightness of the mix, scheduled to change at `time`. */
  public setToneFilter(frequency: number, time: number): void {
    if (frequency === this.toneFrequency) return;
    this.toneFrequency = frequency;
    this.toneFilter.frequency.setTargetAtTime(frequency, time, 0.2);
  }

  /** Echo time for leads, kept in sync with the tempo. */
  public setEchoTime(seconds: number, time: number): void {
    if (this.echoTime !== null && Math.abs(seconds - this.echoTime) < ECHO_TIME_TOLERANCE) return;
    this.echoTime = seconds;
    this.echo.delayTime.setTargetAtTime(seconds, time, 0.1);
  }

  /** Muffle the music with a low-pass, level in [0, 1] (0 = fully open). */
  public setDramaLevel(level: number): void {
    const clamped = clamp(level, 0, 1);
    if (Math.abs(clamped - this.dramaLevel) < 0.01) return;

    this.dramaLevel = clamped;
    // Interpolate in log space so the sweep sounds even
    const frequency =
      DRAMA_FILTER_MAX_FREQ * Math.pow(DRAMA_FILTER_MIN_FREQ / DRAMA_FILTER_MAX_FREQ, clamped);
    this.dramaFilter.frequency.setTargetAtTime(frequency, this.now, 0.03);
  }

  /** The music cuts out from `time` for `duration` seconds, as a dropped connection does. */
  public cutOut(time: number, duration: number): void {
    try {
      const gain = this.glitchGain.gain;
      gain.setValueAtTime(1, time);
      gain.linearRampToValueAtTime(0, time + GLITCH.EDGE);
      gain.setValueAtTime(0, time + duration - GLITCH.EDGE);
      gain.linearRampToValueAtTime(1, time + duration);
    } catch {
      // Play on uncut rather than break audio
    }
  }

  /**
   * A tape rewind from `time` over `duration` seconds: the delay swells slowly, which sags the
   * pitch, then collapses, which shrieks it up, and is back at 0 when the next bar comes.
   */
  public rewind(time: number, duration: number): void {
    const steps = 32;
    const curve = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const share =
        t < GLITCH.REWIND_SAG
          ? (t / GLITCH.REWIND_SAG) ** 2
          : 1 - ((t - GLITCH.REWIND_SAG) / (1 - GLITCH.REWIND_SAG)) ** 2;
      curve[i] = GLITCH.REWIND_DEPTH * share;
    }
    try {
      this.glitchDelay.delayTime.setValueCurveAtTime(curve, time, duration);
    } catch {
      // Play on unbent rather than break audio
    }
  }

  /**
   * A tape held back by a finger for `duration` seconds from now, then let go: the delay swells
   * and falls back smoothly, so the pitch sags, then catches up.
   */
  public holdTape(duration: number): void {
    const steps = 32;
    const curve = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      curve[i] = GLITCH.HOLD_DEPTH * Math.sin((Math.PI * i) / (steps - 1)) ** 2;
    }
    try {
      this.glitchDelay.delayTime.setValueCurveAtTime(curve, this.now, duration);
    } catch {
      // A song's own rewind is running: it bends the music already
    }
  }

  /** Dip the music so the victory sting sits on top; stays down until `recover`. */
  public duck(): void {
    this.rampDuckGain(MUSIC_DUCK_LEVEL, 0.08);
  }

  /**
   * Tape stop: the delay time sweeps up quadratically, which bends the pitch from normal
   * down to zero (Doppler), while the level fades out.
   * @returns false if the browser rejected the automation (the effect is then skipped)
   */
  public tapeStop(duration: number): boolean {
    // d(t) = (T/2)·(t/T)² → pitch factor 1 − d'(t) falls linearly from 1 to 0
    const steps = 32;
    const delayCurve = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      delayCurve[i] = (duration / 2) * t * t;
    }

    try {
      const delay = this.tapeDelay.delayTime;
      delay.cancelScheduledValues(this.now);
      delay.setValueCurveAtTime(delayCurve, this.now, duration);

      const gain = this.duckGain.gain;
      gain.cancelScheduledValues(this.now);
      gain.setValueCurveAtTime(
        new Float32Array([gain.value, gain.value, 0.7, 0.3, 0]),
        this.now,
        duration,
      );
      this.tapeStopEndsAt = this.now + duration;
      return true;
    } catch {
      // Overlapping automation is rejected by some browsers; skip the effect rather than break audio
      return false;
    }
  }

  /** Undo `duck` / `tapeStop`. */
  public recover(): void {
    // Safari rejects automation that overlaps a running curve, which would leave the music
    // silent, so a tape stop that is still running (finale skipped) plays out first
    const at = this.afterTapeStop();
    try {
      const delay = this.tapeDelay.delayTime;
      delay.cancelScheduledValues(at);
      delay.setValueAtTime(0, at);
    } catch {
      // Leave the pitch bend as is rather than break audio
    }
    // After a tape stop the level is at 0, so the delay jump above is inaudible
    this.rampDuckGain(1, 0.6);
  }

  /** Earliest time new automation may start: now, or when a running tape stop ends. */
  private afterTapeStop(): number {
    return Math.max(this.now, this.tapeStopEndsAt);
  }

  /** Ramps the duck gain to `level` over `seconds`, after any running tape stop. */
  private rampDuckGain(level: number, seconds: number): void {
    const at = this.afterTapeStop();
    try {
      const gain = this.duckGain.gain;
      gain.cancelScheduledValues(at);
      // Without a running curve, start from the current level; otherwise from where it ends
      if (at === this.now) gain.setValueAtTime(gain.value, at);
      gain.linearRampToValueAtTime(level, at + seconds);
    } catch {
      // Keep the current level rather than break audio
    }
  }
}
