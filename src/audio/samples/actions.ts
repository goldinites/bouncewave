import { PitchedRecipe, RENDER_RATE, SampleRecipe } from '@/audio/samples/SampleBank';
import {
  cents,
  chain,
  drive,
  filter,
  hit,
  jitter,
  level,
  noiseSource,
  osc,
  room,
  sweep,
} from '@/audio/samples/synth';

/**
 * The action sounds' layers (5.7, docs/AUDIO.md "Звуки действий"), rendered from code like the
 * instruments and mixed when an action happens: a click for the instant of contact, a tuned body
 * that rings in the chord the music is on, a thump for weight, sparks, and for the perfect hit a
 * boom and a ringing tail — the layers a hit is felt through, as a parry in Sekiro is.
 */

/**
 * The paddle hit's tuned bodies, mixed (chosen by ear with the user, 24.10.2026, over steel, neon
 * and glass alone): the neon paddle's ring with a blade's edge on its attack — the bite of a
 * parry, then the paddle's light. A body with `cut` is heard only as its attack, faded out after
 * that many seconds. The opponent plays each body's `.cpu` twin; the perfect hit's octave is the
 * first body's.
 */
export const HIT_BODIES: readonly { id: string; gain: number; cut?: number }[] = [
  { id: 'body.neon', gain: 0.9 },
  { id: 'body.steel', gain: 0.6, cut: 0.12 },
];
/** The click of contact, the blade's. */
export const HIT_CLICK = 'click.steel';

// The rally's notes keep to E4-D#5 (sfx/harmony.ts), roots three semitones either side; what also
// plays an octave up (the neon's perfect hit, the meter's chime, the neon tube) reaches C6 and past
const BODY_ROOTS = [64, 70, 76];
const OCTAVE_ROOTS = [64, 70, 76, 82, 88];
// The partials reach about 9 kHz: a rate above twice that keeps them, at two thirds the memory
const BODY_RATE = RENDER_RATE.HIGH;

/** A struck body: partials at `ratios` of `f`, each dying away over its own time. */
function partials(
  ctx: OfflineAudioContext,
  f: number,
  ratios: readonly number[],
  gains: readonly number[],
  decays: readonly number[],
  into: AudioNode,
): void {
  ratios.forEach((ratio, i) => {
    if (f * ratio > ctx.sampleRate / 2) return;
    chain(osc(ctx, 'sine', f * ratio), hit(ctx, gains[i], decays[i]), into);
  });
}

/** A tuned body for each hit style, the player's and the opponent's: a call and its answer. */
export const ACTION_PITCHED: Record<string, PitchedRecipe> = {
  // A sword's blade struck: a free bar's inharmonic partials, a pair beating a hair apart
  'body.steel': {
    roots: BODY_ROOTS,
    maxRate: BODY_RATE,
    duration: 1,
    build: (ctx, _random, f) => {
      const out = drive(ctx, 1.3);
      out.connect(ctx.destination);
      partials(ctx, f, [1, 2.76, 5.4, 8.93], [1, 0.6, 0.4, 0.25], [0.9, 0.45, 0.25, 0.14], out);
      partials(ctx, f * 1.004, [1, 2.76], [0.5, 0.3], [0.8, 0.4], out);
    },
  },
  // The opponent's iron: a darker bell, its partials closer, so the two blades answer each other
  'body.steel.cpu': {
    roots: BODY_ROOTS,
    maxRate: BODY_RATE,
    duration: 1,
    build: (ctx, _random, f) => {
      const input = filter(ctx, 'lowpass', 6000);
      chain(input, drive(ctx, 1.3), ctx.destination);
      partials(ctx, f, [1, 2.4, 4.6, 7.1], [1, 0.7, 0.35, 0.2], [0.7, 0.4, 0.2, 0.1], input);
    },
  },
  // FM: a bright bite that settles into a sine, an octave ringing over it
  'body.neon': {
    roots: OCTAVE_ROOTS,
    maxRate: BODY_RATE,
    duration: 0.75,
    build: (ctx, _random, f) => {
      const carrier = osc(ctx, 'sine', f);
      const index = ctx.createGain();
      index.gain.setValueAtTime(f * 6, 0);
      index.gain.exponentialRampToValueAtTime(f * 0.4, 0.15);
      chain(osc(ctx, 'sine', f), index);
      index.connect(carrier.frequency);
      chain(carrier, hit(ctx, 1, 0.6), drive(ctx, 1.6), ctx.destination);
      chain(osc(ctx, 'sine', f * 2), hit(ctx, 0.3, 0.35), ctx.destination);
    },
  },
  // The opponent's: the same bite on a metallic ratio, hollower
  'body.neon.cpu': {
    roots: BODY_ROOTS,
    maxRate: BODY_RATE,
    duration: 0.75,
    build: (ctx, _random, f) => {
      const carrier = osc(ctx, 'sine', f);
      const index = ctx.createGain();
      index.gain.setValueAtTime(f * 4, 0);
      index.gain.exponentialRampToValueAtTime(f * 0.3, 0.12);
      chain(osc(ctx, 'sine', f * 3.5), index);
      index.connect(carrier.frequency);
      chain(carrier, hit(ctx, 1, 0.5), drive(ctx, 1.6), ctx.destination);
    },
  },
  // The Overdrive's laser shot, its lead voice: a saw and a square diving from far above onto the
  // note, a filter closing over them, a click dispersed into a chirp under them — the blaster's
  pew: {
    roots: BODY_ROOTS,
    maxRate: RENDER_RATE.HIGH,
    duration: 0.45,
    build: (ctx, random, f) => {
      const fall = 0.16; // s, from far above onto the note
      const close = filter(ctx, 'lowpass', 12000, 4);
      close.frequency.setValueAtTime(12000, 0);
      close.frequency.exponentialRampToValueAtTime(2000, 0.3);
      chain(sweep(ctx, 'sawtooth', f * 12, f, fall), close);
      chain(sweep(ctx, 'square', f * 8, f / 2, fall), level(ctx, 0.5), close);
      chain(close, drive(ctx, 2.5), hit(ctx, 1, 0.4, 0, 0.001), ctx.destination);
      const [input, output] = disperse(ctx, f * 5, 40);
      chain(noiseSource(ctx, random), hit(ctx, 1, 0.002), input);
      chain(output, filter(ctx, 'highpass', f), level(ctx, 0.6), ctx.destination);
    },
  },
  // An electric arc, a Tesla coil's: a buzzing square on the note torn into crackles
  arc: {
    roots: BODY_ROOTS,
    maxRate: RENDER_RATE.HIGH,
    duration: 0.7,
    build: (ctx, random, f) => {
      const tear = ctx.createGain();
      tear.gain.setValueAtTime(0, 0);
      for (let t = 0; t < 0.6; t += 1 / 70) tear.gain.setValueAtTime(0.3 + 0.7 * random(), t);
      const sum = level(ctx, 0.5);
      chain(osc(ctx, 'square', f), sum);
      chain(osc(ctx, 'sawtooth', cents(f, 14)), level(ctx, 0.6), sum);
      chain(
        sum,
        tear,
        filter(ctx, 'bandpass', f * 4, 0.8),
        drive(ctx, 3),
        hit(ctx, 1, 0.55, 0, 0.002),
        ctx.destination,
      );
      // Sparks off the arc, crackling as it buzzes
      chain(
        noiseSource(ctx, random),
        filter(ctx, 'highpass', 5000),
        hit(ctx, 0.25, 0.4),
        ctx.destination,
      );
    },
  },
  // A neon tube lighting: the strike's spark, a flicker as the gas catches, then its ring
  tube: {
    roots: OCTAVE_ROOTS,
    maxRate: RENDER_RATE.HIGH,
    duration: 0.7,
    build: (ctx, random, f) => {
      const flicker = ctx.createGain();
      flicker.gain.setValueAtTime(0, 0);
      for (let t = 0; t < 0.18; t += 1 / 40)
        flicker.gain.setValueAtTime(random() < 0.6 ? 1 : 0.15, t);
      flicker.gain.setValueAtTime(1, 0.18);
      const hum = level(ctx, 0.5);
      chain(osc(ctx, 'sine', f), hum);
      chain(osc(ctx, 'sine', f * 2), level(ctx, 0.5), hum);
      chain(osc(ctx, 'square', f), filter(ctx, 'bandpass', f * 3, 2), level(ctx, 0.3), hum);
      chain(hum, flicker, hit(ctx, 1, 0.6, 0, 0.003), ctx.destination);
      chain(burst(ctx, random, 5000, 0.8, 0.004), ctx.destination);
    },
  },
  // A wall: a muted knock on the chord's fifth, low and short, under the paddles' ring
  wall: {
    roots: [47, 53, 59],
    maxRate: RENDER_RATE.MID,
    duration: 0.4,
    build: (ctx, random, f) => {
      const out = filter(ctx, 'lowpass', 1800);
      out.connect(ctx.destination);
      chain(osc(ctx, 'sine', f), hit(ctx, 1, 0.18), out);
      chain(osc(ctx, 'triangle', f * 2), hit(ctx, 0.35, 0.08), out);
      chain(burst(ctx, random, 900, 0.8, 0.012), level(ctx, 0.5), out);
    },
  },
};

/** The noise a click is cut from, `decay` seconds, through a band at `hz`. */
function burst(
  ctx: OfflineAudioContext,
  random: () => number,
  hz: number,
  q: number,
  decay: number,
) {
  return chain(noiseSource(ctx, random), filter(ctx, 'bandpass', hz, q), hit(ctx, 1, decay));
}

/** A cascade of allpass filters at `hz`: what turns a click into a spring's dispersed chirp. */
function disperse(ctx: OfflineAudioContext, hz: number, stages: number): [AudioNode, AudioNode] {
  const first = filter(ctx, 'allpass', hz, 0.7);
  let last: AudioNode = first;
  for (let i = 1; i < stages; i++) last = chain(last, filter(ctx, 'allpass', hz, 0.7));
  return [first, last];
}

export const ACTION_SAMPLES: Record<string, SampleRecipe> = {
  // The instant of contact, in 2-5 kHz where a hit stands out of the music
  'click.steel': {
    duration: 0.06,
    variants: 4,
    build: (ctx, random) => {
      chain(burst(ctx, random, jitter(random, 4200, 0.1), 0.9, 0.006), ctx.destination);
      chain(osc(ctx, 'sine', jitter(random, 3100, 0.05)), hit(ctx, 0.6, 0.004), ctx.destination);
    },
  },
  // Weight: a punch dropping fast from 180 Hz, which a phone still plays, into the low end
  thump: {
    duration: 0.25,
    maxRate: RENDER_RATE.LOW,
    variants: 3,
    build: (ctx, random) => {
      const from = jitter(random, 180, 0.08);
      chain(
        sweep(ctx, 'sine', from, 55, 0.06),
        hit(ctx, 1, 0.12),
        drive(ctx, 1.8),
        ctx.destination,
      );
      chain(burst(ctx, random, 700, 0.6, 0.03), level(ctx, 0.4), ctx.destination);
    },
  },
  // Sparks flying off a hard hit: a crackling sizzle up high
  spark: {
    duration: 0.15,
    variants: 4,
    build: (ctx, random) => {
      const crackle = ctx.createGain();
      crackle.gain.setValueAtTime(0, 0);
      for (let t = 0; t < 0.1; t += 0.004) crackle.gain.setValueAtTime(random() ** 2, t);
      crackle.gain.setValueAtTime(0, 0.1);
      chain(
        noiseSource(ctx, random),
        filter(ctx, 'highpass', 5000),
        crackle,
        hit(ctx, 1, 0.09),
        ctx.destination,
      );
    },
  },
  // The perfect hit's floor dropping out: a sub boom, driven so a phone hears its edge
  boom: {
    duration: 0.6,
    maxRate: RENDER_RATE.LOW,
    variants: 2,
    build: (ctx, random) => {
      chain(
        sweep(ctx, 'sine', jitter(random, 110, 0.05), 38, 0.3),
        hit(ctx, 1, 0.45, 0, 0.002),
        drive(ctx, 2.2),
        ctx.destination,
      );
    },
  },
  // The sound barrier broken: an N-wave's double crack and a tearing hiss
  crack: {
    duration: 0.2,
    maxRate: RENDER_RATE.HIGH,
    variants: 3,
    build: (ctx, random) => {
      const length = Math.round(jitter(random, 0.004, 0.15) * ctx.sampleRate);
      const wave = ctx.createBuffer(1, length + 1, ctx.sampleRate);
      const data = wave.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = 1 - (2 * i) / length;
      const source = ctx.createBufferSource();
      source.buffer = wave;
      source.start();
      chain(source, ctx.destination);
      chain(
        noiseSource(ctx, random),
        filter(ctx, 'highpass', 2000),
        hit(ctx, 0.7, 0.05),
        drive(ctx, 2),
        ctx.destination,
      );
    },
  },
  // The Overdrive charged: a capacitor's whine rising fast, rippling, crackling as it climbs
  whine: {
    duration: 0.4,
    maxRate: RENDER_RATE.HIGH,
    variants: 2,
    build: (ctx, random) => {
      const ripple = ctx.createGain();
      ripple.gain.value = 0.6;
      chain(osc(ctx, 'sine', 32), level(ctx, 0.4)).connect(ripple.gain);
      const swell = ctx.createGain();
      swell.gain.setValueAtTime(0.0001, 0);
      swell.gain.exponentialRampToValueAtTime(1, 0.28);
      swell.gain.exponentialRampToValueAtTime(0.0001, 0.36);
      chain(
        sweep(ctx, 'sine', jitter(random, 500, 0.05), 4500, 0.3),
        ripple,
        swell,
        drive(ctx, 1.6),
        ctx.destination,
      );
      const crackle = ctx.createGain();
      crackle.gain.setValueAtTime(0, 0);
      for (let t = 0.05; t < 0.3; t += 0.006)
        crackle.gain.setValueAtTime(random() ** 3 * (t / 0.3), t);
      crackle.gain.setValueAtTime(0, 0.3);
      chain(
        noiseSource(ctx, random),
        filter(ctx, 'highpass', 4000),
        crackle,
        level(ctx, 0.5),
        ctx.destination,
      );
    },
  },
  // The Overdrive's small explosion: a dark breath of noise falling from 2.5 kHz, debris crackling
  // in it, a short room — under the shot, not over it
  blast: {
    duration: 0.9,
    maxRate: RENDER_RATE.MID,
    variants: 2,
    build: (ctx, random) => {
      const fall = filter(ctx, 'lowpass', 2500, 0.7);
      fall.frequency.setValueAtTime(2500, 0);
      fall.frequency.exponentialRampToValueAtTime(180, 0.4);
      const debris = ctx.createGain();
      debris.gain.setValueAtTime(0, 0);
      for (let t = 0; t < 0.35; t += 0.008)
        debris.gain.setValueAtTime(0.5 + 0.5 * random() ** 2, t);
      chain(
        noiseSource(ctx, random),
        fall,
        debris,
        hit(ctx, 1, 0.45, 0, 0.01),
        drive(ctx, 1.5),
        ctx.destination,
      );
      chain(
        burst(ctx, random, 600, 0.6, 0.06),
        room(ctx, 0.5, random),
        level(ctx, 0.4),
        ctx.destination,
      );
    },
  },
  // The air ringing after a perfect hit: bright noise in a long room
  tail: {
    duration: 1.4,
    maxRate: RENDER_RATE.MID,
    variants: 2,
    build: (ctx, random) => {
      chain(
        burst(ctx, random, 7000, 0.5, 0.02),
        room(ctx, 1.2, random),
        filter(ctx, 'highpass', 2500),
        ctx.destination,
      );
    },
  },
};
