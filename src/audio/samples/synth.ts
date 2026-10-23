/**
 * Building blocks for sounds rendered offline (SampleRecipe.build). Nothing here plays live:
 * the graphs can afford many oscillators and filters, since each is rendered once.
 */

/** A buffer of white noise from the seeded `random`, so every render of a variant is the same. */
export function noise(ctx: BaseAudioContext, seconds: number, random: () => number): AudioBuffer {
  const length = Math.max(1, Math.ceil(seconds * ctx.sampleRate));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1;
  return buffer;
}

/** A noise source started at `time`, its buffer as long as the render. */
export function noiseSource(
  ctx: OfflineAudioContext,
  random: () => number,
  time = 0,
): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = noise(ctx, ctx.length / ctx.sampleRate, random);
  source.start(time);
  return source;
}

/** A gain that jumps to `peak` at `time` and dies away exponentially over `decay` seconds. */
export function hit(
  ctx: BaseAudioContext,
  peak: number,
  decay: number,
  time = 0,
  attack = 0.001,
): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(peak, time + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  return gain;
}

/** An oscillator whose pitch falls from `from` to `to` Hz over `glide` seconds. */
export function sweep(
  ctx: BaseAudioContext,
  type: OscillatorType,
  from: number,
  to: number,
  glide: number,
  time = 0,
): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, time);
  osc.frequency.exponentialRampToValueAtTime(to, time + glide);
  osc.start(time);
  return osc;
}

/** A filter of `type` at `frequency`, with resonance `q`. */
export function filter(
  ctx: BaseAudioContext,
  type: BiquadFilterType,
  frequency: number,
  q = 0.7,
): BiquadFilterNode {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  return node;
}

/** Overdrive: tanh saturation, harder the higher `amount`, its loudness kept near the input's. */
export function drive(ctx: BaseAudioContext, amount: number): WaveShaperNode {
  const shaper = ctx.createWaveShaper();
  const samples = 1024;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(amount * x) / Math.tanh(amount);
  }
  shaper.curve = curve;
  shaper.oversample = '4x';
  return shaper;
}

/** A small room for gated snares and claps: noise dying away over `decay` seconds. */
export function room(ctx: BaseAudioContext, decay: number, random: () => number): ConvolverNode {
  const length = Math.ceil(decay * ctx.sampleRate);
  const impulse = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = impulse.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (random() * 2 - 1) * Math.exp((-6.9 * i) / length);
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  return convolver;
}

/** Wires `nodes` one into the next and returns the last, for chains read left to right. */
export function chain(...nodes: AudioNode[]): AudioNode {
  for (let i = 1; i < nodes.length; i++) nodes[i - 1].connect(nodes[i]);
  return nodes[nodes.length - 1];
}

/** A value jittered by up to ±`share` of itself, for variants that differ a little. */
export const jitter = (random: () => number, value: number, share: number): number =>
  value * (1 + (random() * 2 - 1) * share);

/**
 * The 808's metal: six square waves at inharmonic ratios, the sound under its hats and cymbals.
 * @returns the oscillators' sum, started at `time` and stopped at the end of the render
 */
export function metalCluster(ctx: OfflineAudioContext, base: number, time = 0): GainNode {
  const sum = ctx.createGain();
  sum.gain.value = 1 / 6;
  for (const ratio of [2, 3, 4.16, 5.43, 6.79, 8.21]) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = base * ratio;
    osc.connect(sum);
    osc.start(time);
  }
  return sum;
}

/** A frequency moved by `amount` cents. */
export const cents = (hz: number, amount: number): number => hz * 2 ** (amount / 1200);

/** An oscillator of `type` at `frequency`, started at once. */
export function osc(
  ctx: BaseAudioContext,
  type: OscillatorType,
  frequency: number,
): OscillatorNode {
  const node = ctx.createOscillator();
  node.type = type;
  node.frequency.value = frequency;
  node.start();
  return node;
}

/** A gain fixed at `value`. */
export function level(ctx: BaseAudioContext, value: number): GainNode {
  const gain = ctx.createGain();
  gain.gain.value = value;
  return gain;
}

/**
 * A plucked string, by the Karplus–Strong model: a burst of noise circulating in a delay one
 * period long, smoothed a little on every pass, so it darkens and dies away as a string does.
 * Worked out sample by sample and played as a buffer: Web Audio's own feedback delay can't be
 * shorter than a render quantum (128 samples), too long a period for any note above ~350 Hz.
 * @param decay     share of the wave kept each period: nearer 1 rings longer
 * @param smoothing 0–1, how much each pass dulls it: 1 is the classic model, less is brighter
 * @param time      when it is plucked
 */
export function pluckedString(
  ctx: BaseAudioContext,
  random: () => number,
  frequency: number,
  decay = 0.996,
  smoothing = 1,
  time = 0,
): AudioBufferSourceNode {
  const rate = ctx.sampleRate;
  // An offline render's whole length; two seconds anywhere else
  const length = 'length' in ctx ? (ctx as OfflineAudioContext).length : Math.ceil(rate * 2);
  const buffer = ctx.createBuffer(1, length, rate);
  const out = buffer.getChannelData(0);
  // The smoothing averages two samples, half a sample's delay of its own
  const period = rate / frequency - 0.5 * smoothing;
  const burst = Math.ceil(rate / frequency);
  const at = (position: number) => {
    const i = Math.floor(position);
    const fraction = position - i;
    const a = i >= 0 ? out[i] : 0;
    const b = i + 1 >= 0 ? out[i + 1] : 0;
    return a + (b - a) * fraction;
  };
  for (let n = 0; n < length; n++) {
    const input = n < burst ? random() * 2 - 1 : 0;
    const now = at(n - period);
    const before = at(n - period - 1);
    out[n] = input + decay * (now * (1 - smoothing / 2) + before * (smoothing / 2));
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.start(time);
  return source;
}

/** A pulse wave of `duty` (0–1) as a band-limited periodic wave: the 8-bit consoles' tone. */
export function pulseWave(ctx: BaseAudioContext, duty: number, harmonics = 40): PeriodicWave {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let k = 1; k <= harmonics; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

/**
 * A waveshaper that rounds the signal to `levels` steps: a bit-crushed, lo-fi edge. Each step's
 * edge is a short slope, not a cliff, so a held note's loop still joins without a click: a
 * sample a hair different on either side of the join can't land a whole step apart.
 */
export function crush(ctx: BaseAudioContext, levels: number): WaveShaperNode {
  const shaper = ctx.createWaveShaper();
  const samples = 2048;
  const curve = new Float32Array(samples);
  const EDGE = 0.2; // share of a step the slope takes
  for (let i = 0; i < samples; i++) {
    const x = ((i / (samples - 1)) * 2 - 1) * levels;
    const floor = Math.floor(x);
    const rise = Math.min(1, Math.max(0, (x - floor - (1 - EDGE)) / EDGE));
    curve[i] = (floor + rise * rise * (3 - 2 * rise)) / levels;
  }
  shaper.curve = curve;
  return shaper;
}
