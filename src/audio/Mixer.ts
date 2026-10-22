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
// About 0.37 s at 44.1 kHz: long enough for a level that doesn't flicker with every beat
const METER_FFT_SIZE = 16384;
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
 * music → hitDuck ─┐
 * sfx ─────────────┼─ sum → limiter → clipper → destination
 * menu ────────────┘                        └─ meter
 * ```
 */
export class Mixer {
  public readonly context: AudioContext;
  public readonly music: GainNode;
  public readonly sfx: GainNode;
  public readonly menu: GainNode;
  private readonly hitDuck: GainNode;
  private readonly meter: AnalyserNode;
  private meterData: Float32Array<ArrayBuffer> | null = null;

  constructor(context: AudioContext, destination: AudioNode = context.destination) {
    this.context = context;
    const ac = context;

    this.music = ac.createGain();
    this.sfx = ac.createGain();
    this.menu = ac.createGain();
    this.hitDuck = ac.createGain();
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

    this.music.connect(this.hitDuck);
    this.hitDuck.connect(sum);
    this.sfx.connect(sum);
    this.menu.connect(sum);
    sum.connect(limiter);
    limiter.connect(clipper.input);
    clipper.output.connect(destination);
    clipper.output.connect(this.meter);
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

  /** The master's level now, for the listening stand. */
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
