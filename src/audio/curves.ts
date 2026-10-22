const CURVE_SAMPLES = 2048;

/** A gain in decibels as a linear factor. */
export const dbToGain = (db: number): number => 10 ** (db / 20);

/** A linear level as decibels; silence is -Infinity. */
export const gainToDb = (gain: number): number => 20 * Math.log10(gain);

/**
 * A soft clipper: below `knee` the signal passes almost untouched, above it it bends smoothly
 * toward `knee` and never past it — warmth and harmonics on a bass or drums, a safety ceiling on
 * the master. A wave shaper clamps its input to [-1, 1], so the input is scaled down by `range`
 * first and the curve scales it back: levels up to `range` are shaped, and small signals pass at
 * unity gain.
 */
export function createSoftClipper(
  ac: BaseAudioContext,
  knee: number,
  range = 4,
): { input: GainNode; output: WaveShaperNode } {
  const input = ac.createGain();
  const shaper = ac.createWaveShaper();
  input.gain.value = 1 / range;
  shaper.curve = softClipCurve(knee, range);
  // Oversampling keeps the harmonics the bend adds from folding back as harsh aliasing
  shaper.oversample = '2x';
  input.connect(shaper);
  return { input, output: shaper };
}

/** The clipper's curve: x in [-1, 1] stands for levels in [-range, range]. */
export function softClipCurve(knee: number, range: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(CURVE_SAMPLES);
  for (let i = 0; i < CURVE_SAMPLES; i++) {
    const x = ((i / (CURVE_SAMPLES - 1)) * 2 - 1) * range;
    curve[i] = knee * Math.tanh(x / knee);
  }
  return curve;
}

/**
 * A room's echo as an impulse response, generated rather than shipped: stereo noise dying away
 * exponentially (to -60 dB at `decay` seconds), each channel its own noise for width, and
 * darkening as it fades, the way the highs die first in a real room.
 */
export function createReverbImpulse(
  ac: BaseAudioContext,
  decay: number,
  preDelay: number,
  random: () => number = Math.random,
): AudioBuffer {
  const rate = ac.sampleRate;
  const length = Math.ceil((preDelay + decay) * rate);
  const impulse = ac.createBuffer(2, length, rate);
  const start = Math.floor(preDelay * rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let smoothed = 0;
    for (let i = start; i < length; i++) {
      const t = (i - start) / rate;
      // A one-pole low-pass whose cutoff falls as the tail goes on
      const darkness = Math.min(0.95, t / decay);
      smoothed = smoothed * darkness + (random() * 2 - 1) * (1 - darkness);
      data[i] = smoothed * Math.exp((-6.9 * t) / decay);
    }
  }
  return impulse;
}
