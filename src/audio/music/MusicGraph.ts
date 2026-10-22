import { createReverbImpulse, createSoftClipper, dbToGain } from '@/audio/curves';
import { clamp } from '@/shared/math';

// Overall music volume when not muted: the rendered instruments are fuller than the live
// synths were, so it sits lower to leave the action sounds on top (docs/AUDIO.md, "Микс")
const MUSIC_MASTER_LEVEL = 0.21;
const MUSIC_DUCK_LEVEL = 0.25; // music level under the victory sting
// Low-pass cutoff of the music bus at full match-point drama (fully open at level 0)
const DRAMA_FILTER_MIN_FREQ = 550;
const DRAMA_FILTER_MAX_FREQ = 20000;

const ECHO_FEEDBACK = 0.4;
// The echo bounces left and right, each repeat a little darker
const ECHO_PAN = 0.6;
const ECHO_DAMPING = 3500; // Hz, low-pass inside the feedback loop
// Saturation on the stems: below the knee a part passes clean, above it it bends and grows
// harmonics, which is also what lets a bass be heard on a phone speaker
const SATURATION = {
  BASS_KNEE: 0.22,
  BASS_MAKEUP: 1.25, // what the bend takes off the bass's peaks, given back
  DRUMS_KNEE: 0.55,
} as const;
// Every kick pushes the bass and pads down for a moment and lets them swell back: the
// "breathing" of the genre, done by automation on the kick's own time, not by a detector
const SIDECHAIN = {
  BASS_DEPTH: 0.55, // share the bass drops by under a full kick
  PADS_DEPTH: 0.45,
  ATTACK: 0.004, // s, time constant down
  HOLD: 0.03, // s at the bottom
  RELEASE: 0.08, // s, time constant back up
  FULL_KICK: 0.75, // kick volume that ducks by the full depth
} as const;
// One shared room for pads, melody and a little of the drums
const REVERB = {
  DECAY: 1.8, // s to -60 dB
  PRE_DELAY: 0.015, // s
  LOW_CUT: 300, // Hz: no kick or bass in the room, or it turns to mud
  RETURN: 0.35,
  PADS_SEND: 0.5,
  MELODY_SEND: 0.35,
  DRUMS_SEND: 0.12,
} as const;
// Pad voices spread across the stereo field
export const PAD_SPREAD = 0.5;
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
 * drums → saturation ───────────────────────┐
 * bass → saturation → pump ─────────────────┤
 * pads → pump ──────────────────────────────┤
 * melody ─┬─────────────────────────────────┤
 *         └─ echo L ⇄ echo R (ping-pong) ───┤
 * drums, pads, melody ─ sends → reverb ─────┤
 *                                           bus → songLevel → toneFilter → compressor
 *   → dramaFilter → glitchDelay → tapeDelay → glitchGain → duckGain ─┬─ master → output
 *                                                                   └─ analyser
 * ```
 * - each stem is a part of the arrangement: its own saturation, sidechain and sends
 * - the pumps duck the bass and pads under every kick (`pump`)
 * - songLevel evens out the songs' loudness (`setSongLevel`)
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
  /** Effects outside the stems (risers): straight into the mix. */
  public readonly bus: GainNode;
  public readonly drums: GainNode;
  public readonly bass: GainNode;
  /** Pads and stabs. */
  public readonly pads: GainNode;
  /** Leads and arpeggios, which also feed the echo. */
  public readonly melody: GainNode;
  public readonly noiseBuffer: AudioBuffer;
  public readonly analyser: AnalyserNode;

  private readonly echoes: DelayNode[];
  private readonly bassPump: GainNode;
  private readonly padsPump: GainNode;
  private readonly songLevel: GainNode;
  private songLevelDb: number | null = null;
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

  /** @param output where the music goes: the mixer's music bus */
  constructor(context: AudioContext, output: AudioNode = context.destination) {
    this.context = context;
    const ac = context;

    // One second of white noise for percussion (snare, hi-hat, crash)
    this.noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const channelData = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = Math.random() * 2 - 1;
    }

    this.bus = ac.createGain();
    this.drums = ac.createGain();
    this.bass = ac.createGain();
    this.pads = ac.createGain();
    this.melody = ac.createGain();
    this.bassPump = ac.createGain();
    this.padsPump = ac.createGain();
    this.songLevel = ac.createGain();
    this.toneFilter = ac.createBiquadFilter();
    this.dramaFilter = ac.createBiquadFilter();
    this.tapeDelay = ac.createDelay(1);
    this.glitchDelay = ac.createDelay(1);
    this.glitchGain = ac.createGain();
    this.duckGain = ac.createGain();
    this.master = ac.createGain();
    this.analyser = ac.createAnalyser();

    const compressor = ac.createDynamicsCompressor();

    this.toneFilter.frequency.value = 2800;
    this.dramaFilter.frequency.value = DRAMA_FILTER_MAX_FREQ;
    this.tapeDelay.delayTime.value = 0;
    this.glitchDelay.delayTime.value = 0;
    this.master.gain.value = 0;
    this.analyser.fftSize = ANALYSER_FFT_SIZE;
    this.analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;

    const drumsSaturation = createSoftClipper(ac, SATURATION.DRUMS_KNEE);
    this.drums.connect(drumsSaturation.input);
    drumsSaturation.output.connect(this.bus);

    const bassSaturation = createSoftClipper(ac, SATURATION.BASS_KNEE);
    const bassMakeup = ac.createGain();
    bassMakeup.gain.value = SATURATION.BASS_MAKEUP;
    this.bass.connect(bassSaturation.input);
    bassSaturation.output.connect(bassMakeup);
    bassMakeup.connect(this.bassPump);
    this.bassPump.connect(this.bus);

    this.pads.connect(this.padsPump);
    this.padsPump.connect(this.bus);
    this.melody.connect(this.bus);
    this.echoes = this.buildEcho(ac);
    this.buildReverb(ac);

    this.bus.connect(this.songLevel);
    this.songLevel.connect(this.toneFilter);
    this.toneFilter.connect(compressor);
    compressor.connect(this.dramaFilter);
    this.dramaFilter.connect(this.glitchDelay);
    this.glitchDelay.connect(this.tapeDelay);
    this.tapeDelay.connect(this.glitchGain);
    this.glitchGain.connect(this.duckGain);
    this.duckGain.connect(this.master);
    this.duckGain.connect(this.analyser);
    this.master.connect(output);
  }

  /** Ping-pong echo on the melody: repeats alternate left and right, darker each time. */
  private buildEcho(ac: AudioContext): DelayNode[] {
    const echoes = [-ECHO_PAN, ECHO_PAN].map((pan) => {
      const delay = ac.createDelay(1);
      const panner = ac.createStereoPanner();
      panner.pan.value = pan;
      delay.connect(panner);
      panner.connect(this.bus);
      return delay;
    });
    const [left, right] = echoes;
    const feedback = (from: DelayNode, to: DelayNode) => {
      const damping = ac.createBiquadFilter();
      const gain = ac.createGain();
      damping.frequency.value = ECHO_DAMPING;
      gain.gain.value = ECHO_FEEDBACK;
      from.connect(damping);
      damping.connect(gain);
      gain.connect(to);
    };
    this.melody.connect(left);
    feedback(left, right);
    feedback(right, left);
    return echoes;
  }

  /** The shared room: pads, melody and a touch of drums are sent in, the low end kept out. */
  private buildReverb(ac: AudioContext): void {
    const send = ac.createGain();
    const lowCut = ac.createBiquadFilter();
    const room = ac.createConvolver();
    const ret = ac.createGain();
    lowCut.type = 'highpass';
    lowCut.frequency.value = REVERB.LOW_CUT;
    room.buffer = createReverbImpulse(ac, REVERB.DECAY, REVERB.PRE_DELAY);
    ret.gain.value = REVERB.RETURN;

    const sources: [AudioNode, number][] = [
      [this.padsPump, REVERB.PADS_SEND],
      [this.melody, REVERB.MELODY_SEND],
      [this.drums, REVERB.DRUMS_SEND],
    ];
    for (const [source, level] of sources) {
      const amount = ac.createGain();
      amount.gain.value = level;
      source.connect(amount);
      amount.connect(send);
    }
    send.connect(lowCut);
    lowCut.connect(room);
    room.connect(ret);
    ret.connect(this.bus);
  }

  /**
   * A kick at `time`: the bass and pads dip under it and swell back, deeper the harder the kick.
   * Kicks come in time order, so each one's automation lands after the last one's.
   */
  public pump(time: number, kickVolume: number): void {
    const strength = clamp(kickVolume / SIDECHAIN.FULL_KICK, 0, 1);
    const duck = (gain: AudioParam, depth: number) => {
      gain.setTargetAtTime(1 - depth * strength, time, SIDECHAIN.ATTACK);
      gain.setTargetAtTime(1, time + SIDECHAIN.HOLD, SIDECHAIN.RELEASE);
    };
    try {
      duck(this.bassPump.gain, SIDECHAIN.BASS_DEPTH);
      duck(this.padsPump.gain, SIDECHAIN.PADS_DEPTH);
    } catch {
      // Play on without the breathing rather than break audio
    }
  }

  /** The song's own level in dB, from `time`: songs are evened out so none jumps out. */
  public setSongLevel(db: number, time: number): void {
    if (db === this.songLevelDb) return;
    this.songLevelDb = db;
    this.songLevel.gain.setTargetAtTime(dbToGain(db), time, 0.05);
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
    this.echoes.forEach((echo) => echo.delayTime.setTargetAtTime(seconds, time, 0.1));
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
