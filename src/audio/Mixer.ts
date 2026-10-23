import { createSoftClipper, dbToGain, gainToDb } from '@/audio/curves';
import { clamp } from '@/shared/math';

// The master's safety: a fast compressor catches peaks, a soft clipper rounds off what slips past
const LIMITER = {
  THRESHOLD: -3, // dB
  KNEE: 0, // dB
  RATIO: 20,
  ATTACK: 0.002, // s
  RELEASE: 0.1, // s
  CEILING: 0.89, // linear, about -1 dBFS: nothing leaves the master louder
} as const;
// The music dips under a strong hit so it punches through: strength 1 is the full depth
const HIT_DUCK = {
  DEPTH: -4, // dB at full strength
  ATTACK: 0.004, // s, time constant into the dip
  HOLD: 0.08, // s the dip holds
  RELEASE: 0.07, // s, time constant back up
} as const;
// Every paddle hit carves its own place out of the music for a moment: the band the hit's click
// and body sit in dips, so the hit is heard over a song's loudest part without being louder, and
// without the whole music pumping on every hit of a long rally
const HIT_CARVE = {
  FREQUENCY: 2500, // Hz, the middle of the 1-4 kHz the hits sit in
  Q: 0.8,
  DEPTH: -5, // dB at full strength
  ATTACK: 0.003, // s, time constant into the dip
  HOLD: 0.04, // s the dip holds
  RELEASE: 0.05, // s, time constant back up
} as const;
// About 0.37 s at 44.1 kHz: long enough for a level that doesn't flicker with every beat
const METER_FFT_SIZE = 16384;
// The meter hears roughly as the ear does (the K-weighting of LUFS): the deep lows count less,
// the presence range a little more, so a song's 808 tail doesn't read as loudness
export const K_WEIGHTING = { LOW_CUT: 38, SHELF_FREQUENCY: 1681, SHELF_GAIN: 4 } as const;
const SILENCE_DB = -96;

/** How loud the master is: over the meter's last window, and its loudest sample there. */
export interface MasterLevels {
  rms: number; // dBFS
  peak: number; // dBFS
}

/**
 * The master: every sound of the game ends here — music, action sounds and menu sounds each on
 * its own bus — and leaves through a limiter that keeps the sum from ever clipping, however many
 * sounds pile up.
 *
 * ```
 * music → hitCarve → hitDuck ─┐
 * sfx ────────────────────────┼─ sum → limiter → clipper → destination
 * menu ───────────────────────┘                        └─ K-weighting → meter
 * ```
 */
export class Mixer {
  public readonly context: AudioContext;
  public readonly music: GainNode;
  public readonly sfx: GainNode;
  public readonly menu: GainNode;
  private readonly hitDuck: GainNode;
  private readonly hitCarve: BiquadFilterNode;
  private readonly meter: AnalyserNode;
  private meterData: Float32Array<ArrayBuffer> | null = null;

  constructor(context: AudioContext, destination: AudioNode = context.destination) {
    this.context = context;
    const ac = context;

    this.music = ac.createGain();
    this.sfx = ac.createGain();
    this.menu = ac.createGain();
    this.hitDuck = ac.createGain();
    this.hitCarve = ac.createBiquadFilter();
    this.hitCarve.type = 'peaking';
    this.hitCarve.frequency.value = HIT_CARVE.FREQUENCY;
    this.hitCarve.Q.value = HIT_CARVE.Q;
    this.hitCarve.gain.value = 0;
    this.meter = ac.createAnalyser();
    this.meter.fftSize = METER_FFT_SIZE;

    const sum = ac.createGain();
    const limiter = ac.createDynamicsCompressor();
    limiter.threshold.value = LIMITER.THRESHOLD;
    limiter.knee.value = LIMITER.KNEE;
    limiter.ratio.value = LIMITER.RATIO;
    limiter.attack.value = LIMITER.ATTACK;
    limiter.release.value = LIMITER.RELEASE;
    const clipper = createSoftClipper(ac, LIMITER.CEILING);

    this.music.connect(this.hitCarve);
    this.hitCarve.connect(this.hitDuck);
    this.hitDuck.connect(sum);
    this.sfx.connect(sum);
    this.menu.connect(sum);
    sum.connect(limiter);
    limiter.connect(clipper.input);
    clipper.output.connect(destination);

    const lowCut = ac.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = K_WEIGHTING.LOW_CUT;
    lowCut.Q.value = 0.5;
    const presence = ac.createBiquadFilter();
    presence.type = 'highshelf';
    presence.frequency.value = K_WEIGHTING.SHELF_FREQUENCY;
    presence.gain.value = K_WEIGHTING.SHELF_GAIN;
    clipper.output.connect(lowCut);
    lowCut.connect(presence);
    presence.connect(this.meter);
  }

  /** A strong hit: the music dips for a moment under it, deeper the stronger, `strength` in [0, 1]. */
  public duckMusic(strength: number): void {
    const now = this.context.currentTime;
    const level = dbToGain(HIT_DUCK.DEPTH * clamp(strength, 0, 1));
    try {
      const gain = this.hitDuck.gain;
      // A dip already running is cut short where it stands, so a new one never waits for it
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(level, now, HIT_DUCK.ATTACK);
      gain.setTargetAtTime(1, now + HIT_DUCK.HOLD, HIT_DUCK.RELEASE);
    } catch {
      // Play on undipped rather than break audio
    }
  }

  /**
   * A paddle hit: the band it sits in dips out of the music for a moment, deeper the stronger the
   * hit, `strength` in [0, 1].
   */
  public carveForHit(strength: number): void {
    const now = this.context.currentTime;
    try {
      const gain = this.hitCarve.gain;
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(HIT_CARVE.DEPTH * clamp(strength, 0, 1), now, HIT_CARVE.ATTACK);
      gain.setTargetAtTime(0, now + HIT_CARVE.HOLD, HIT_CARVE.RELEASE);
    } catch {
      // Play on uncarved rather than break audio
    }
  }

  /** The master's level now, K-weighted, for the listening stand. */
  public getLevels(): MasterLevels {
    this.meterData ??= new Float32Array(this.meter.fftSize);
    const data = this.meterData;
    this.meter.getFloatTimeDomainData(data);
    let sum = 0;
    let peak = 0;
    for (const sample of data) {
      sum += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
    }
    const toDb = (gain: number) => Math.max(SILENCE_DB, gainToDb(gain));
    return { rms: toDb(Math.sqrt(sum / data.length)), peak: toDb(peak) };
  }
}
