import { BASS_ROOTS, LOOP, LOOPED, PAD_ROOTS, spread, STAB_ROOTS } from '@/audio/samples/pitched';
import { PitchedRecipe, RENDER_RATE } from '@/audio/samples/SampleBank';
import {
  cents,
  chain,
  drive,
  filter,
  hit,
  level,
  noiseSource,
  osc,
  pluckedString,
} from '@/audio/samples/synth';

/**
 * The wider palette's basses, pads and chord comps (5.6), beside the core instruments
 * (pitched.ts): rendered only once a song plays them or the stand asks, so a sound no track in
 * play uses takes no memory and no render time.
 */
export const EXTRA_PITCHED = {
  /** Slap bass: the thumb's pop on a string, a bright FM bite settling into a round thump. */
  bassSlap: {
    maxRate: RENDER_RATE.MID,
    roots: BASS_ROOTS,
    duration: 0.9,
    build: (ctx, random, f) => {
      const out = drive(ctx, 1.4);
      out.connect(ctx.destination);
      chain(osc(ctx, 'sine', f), hit(ctx, 1, 0.8, 0, 0.002), out);
      const carrier = osc(ctx, 'sine', f * 2);
      const index = ctx.createGain();
      index.gain.setValueAtTime(f * 6, 0);
      index.gain.exponentialRampToValueAtTime(f * 0.3, 0.05);
      chain(osc(ctx, 'sine', f * 3), index);
      index.connect(carrier.frequency);
      chain(carrier, hit(ctx, 0.45, 0.25, 0, 0.001), out);
      chain(noiseSource(ctx, random), filter(ctx, 'highpass', 3000), hit(ctx, 0.3, 0.005), out);
    },
  },
  /** Growl: two saws through a filter that wobbles four times a second, driven hard. */
  bassGrowl: {
    maxRate: RENDER_RATE.LOW,
    roots: BASS_ROOTS,
    duration: LOOPED,
    loop: LOOP,
    build: (ctx, _random, f, tune) => {
      const sum = level(ctx, 0.4);
      osc(ctx, 'sawtooth', f).connect(sum);
      osc(ctx, 'sawtooth', tune(cents(f, 9))).connect(sum);
      const wobble = filter(ctx, 'lowpass', 600, 6);
      // Four wobbles in the one-second loop, so it joins seamlessly
      chain(osc(ctx, 'sine', 4), level(ctx, 450)).connect(wobble.frequency);
      chain(sum, wobble, drive(ctx, 4), filter(ctx, 'lowpass', 3000), ctx.destination);
    },
  },
  /** String pad: an ensemble's saws spread wide and softened, the Juno's strings. */
  padStrings: {
    maxRate: RENDER_RATE.MID,
    roots: PAD_ROOTS,
    duration: LOOPED,
    loop: LOOP,
    channels: 2,
    build: (ctx, _random, f, tune) => {
      const sum = filter(ctx, 'lowpass', 3500, 0.8);
      sum.connect(ctx.destination);
      const voices = [-14, -7, -3, 3, 7, 14].map((detune) =>
        chain(osc(ctx, 'sawtooth', tune(cents(f, detune))), level(ctx, 0.2)),
      );
      spread(ctx, voices, 0.8, sum);
    },
  },
  /**
   * Reverse pad: a chord that swells from nothing to full, like a tape run back, then falls
   * away. Mono and three seconds — it is a swell, not a bed — so it costs a fraction of a pad.
   */
  padReverse: {
    maxRate: RENDER_RATE.MID,
    roots: PAD_ROOTS,
    duration: 3,
    build: (ctx, _random, f) => {
      // Swelling for most of it, then falling away fast: a chord change cuts it sooner anyway
      const swell = ctx.createGain();
      swell.gain.setValueAtTime(0.001, 0);
      swell.gain.exponentialRampToValueAtTime(1, 2.4);
      swell.gain.exponentialRampToValueAtTime(0.001, 2.95);
      chain(swell, filter(ctx, 'lowpass', 4000), ctx.destination);
      for (const detune of [-8, 0, 8]) {
        chain(osc(ctx, 'sawtooth', cents(f, detune)), level(ctx, 0.3), swell);
      }
    },
  },
  /** Rhodes comp: a short electric-piano chord tone, for comping the chords in rhythm. */
  stabRhodes: {
    maxRate: RENDER_RATE.MID,
    roots: STAB_ROOTS,
    duration: 0.9,
    build: (ctx, _random, f) => {
      const carrier = osc(ctx, 'sine', f);
      const index = ctx.createGain();
      index.gain.setValueAtTime(f * 1.6, 0);
      index.gain.exponentialRampToValueAtTime(f * 0.2, 0.3);
      chain(osc(ctx, 'sine', f), index);
      index.connect(carrier.frequency);
      chain(carrier, hit(ctx, 1, 0.85, 0, 0.003), ctx.destination);
    },
  },
  /** Guitar comp: a chord's string plucked short and muted, the cutting guitar's chop. */
  stabGuitar: {
    maxRate: RENDER_RATE.MID,
    roots: STAB_ROOTS,
    duration: 0.5,
    build: (ctx, random, f) => {
      const string = pluckedString(ctx, random, f, 0.985, 0.6);
      chain(string, filter(ctx, 'highpass', 250), hit(ctx, 1, 0.45, 0, 0.001), ctx.destination);
    },
  },
  /** String stabs: the ensemble bowed short and hard, staccato. */
  stabStrings: {
    maxRate: RENDER_RATE.MID,
    roots: STAB_ROOTS,
    duration: 0.6,
    build: (ctx, _random, f) => {
      const sum = level(ctx, 0.3);
      for (const detune of [-10, 0, 10]) osc(ctx, 'sawtooth', cents(f, detune)).connect(sum);
      chain(sum, filter(ctx, 'lowpass', 3000), hit(ctx, 1, 0.5, 0, 0.01), ctx.destination);
    },
  },
} satisfies Record<string, PitchedRecipe>;

export type ExtraPitchedId = keyof typeof EXTRA_PITCHED;
