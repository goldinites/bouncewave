import { PitchedRecipe, RENDER_RATE, SampleRecipe } from '@/audio/samples/SampleBank';
import {
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

/** The characters a paddle hit can have, auditioned on the stand (`?sfx=`). */
export const HIT_STYLES = ['steel', 'neon', 'glass'] as const;
export type HitStyle = (typeof HIT_STYLES)[number];
export const isHitStyle = (value: string): value is HitStyle =>
  (HIT_STYLES as readonly string[]).includes(value);

// The rally's notes run from about E3 to C6 (sfx/harmony.ts): roots three semitones either side
const BODY_ROOTS = [55, 61, 67, 73, 79];
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
    roots: BODY_ROOTS,
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
  // A glass struck: near-harmonic sines, clear and quick
  'body.glass': {
    roots: BODY_ROOTS,
    maxRate: BODY_RATE,
    duration: 0.7,
    build: (ctx, _random, f) => {
      partials(
        ctx,
        f * 2,
        [1, 2.02, 3.01, 4.2],
        [1, 0.45, 0.3, 0.15],
        [0.6, 0.3, 0.18, 0.1],
        ctx.destination,
      );
      chain(osc(ctx, 'sine', f), hit(ctx, 0.5, 0.35), ctx.destination);
    },
  },
  // The opponent's: a wooden bar, a marimba's fourth and tenth partials
  'body.glass.cpu': {
    roots: BODY_ROOTS,
    maxRate: BODY_RATE,
    duration: 0.7,
    build: (ctx, _random, f) => {
      partials(ctx, f, [1, 4, 10], [1, 0.4, 0.15], [0.4, 0.12, 0.05], ctx.destination);
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
  'click.neon': {
    duration: 0.05,
    variants: 4,
    build: (ctx, random) => {
      chain(
        osc(ctx, 'square', jitter(random, 2200, 0.05)),
        hit(ctx, 0.5, 0.005),
        filter(ctx, 'lowpass', 7000),
        ctx.destination,
      );
      chain(burst(ctx, random, 3000, 0.7, 0.003), ctx.destination);
    },
  },
  'click.glass': {
    duration: 0.04,
    variants: 4,
    build: (ctx, random) => {
      chain(osc(ctx, 'sine', jitter(random, 5200, 0.06)), hit(ctx, 1, 0.003), ctx.destination);
      chain(burst(ctx, random, 6000, 1.2, 0.002), level(ctx, 0.5), ctx.destination);
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
