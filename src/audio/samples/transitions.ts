import { RENDER_RATE, SampleRecipe } from '@/audio/samples/SampleBank';
import {
  chain,
  drive,
  filter,
  hit,
  jitter,
  level,
  metalCluster,
  noiseSource,
  room,
  sweep,
} from '@/audio/samples/synth';

// Seconds a swell takes to stop once it peaks: short enough to land on the downbeat, long enough
// not to click
const SWELL_STOP = 0.012;

/** A gain that swells from nothing to `peak` by `end`, then stops in SWELL_STOP. */
function swell(ctx: BaseAudioContext, peak: number, end: number): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, 0);
  gain.gain.exponentialRampToValueAtTime(peak, end - SWELL_STOP);
  gain.gain.linearRampToValueAtTime(0, end);
  return gain;
}

/**
 * The transitions (5.4c, docs/AUDIO.md): what marks the song's form — a build rising into the
 * chorus, the drop's boom, the music coming down after a hot rally, a whoosh into the groove.
 * A swell is played so that it ends on the downbeat it leads into. They come once a section at
 * most, so most have one variant: a second would cost memory nobody hears.
 */
export const TRANSITION_SAMPLES = {
  /** Noise riser: a band of noise sweeping up, fluttering faster as it climbs. */
  riser: {
    maxRate: RENDER_RATE.MID,
    duration: 4,
    variants: 1,
    shape: 'swell',
    build: (ctx, random) => {
      const band = filter(ctx, 'bandpass', 300, 3);
      band.frequency.exponentialRampToValueAtTime(9000, 4);
      // The flutter: the level shaken by a wobble that speeds up from 4 to 22 times a second
      const flutter = ctx.createGain();
      flutter.gain.value = 0.65;
      const wobble = sweep(ctx, 'sine', 4, 22, 4);
      const depth = level(ctx, 0.35);
      wobble.connect(depth);
      depth.connect(flutter.gain);
      chain(noiseSource(ctx, random), band, flutter, swell(ctx, 1, 4), ctx.destination);
    },
  },
  /** Tonal riser: detuned saws climbing three octaves as their filter opens. */
  riserTone: {
    maxRate: RENDER_RATE.MID,
    duration: 4,
    variants: 1,
    shape: 'swell',
    level: -2,
    build: (ctx) => {
      const tone = filter(ctx, 'lowpass', 400, 2);
      tone.frequency.exponentialRampToValueAtTime(8000, 4);
      const sum = level(ctx, 0.5);
      for (const detune of [-12, 12]) {
        const saw = ctx.createOscillator();
        saw.type = 'sawtooth';
        saw.detune.value = detune;
        saw.frequency.setValueAtTime(110, 0);
        saw.frequency.exponentialRampToValueAtTime(880, 4);
        saw.start();
        saw.connect(sum);
      }
      chain(sum, tone, drive(ctx, 1.5), swell(ctx, 1, 4), ctx.destination);
    },
  },
  /** Reverse crash: a cymbal played backwards, swelling into the hit it leads to. */
  reverseCrash: {
    duration: 2,
    variants: 2,
    shape: 'swell',
    reverse: true,
    level: -2,
    build: (ctx, random) => {
      const out = filter(ctx, 'highpass', 2500);
      out.connect(ctx.destination);
      chain(metalCluster(ctx, jitter(random, 52, 0.03)), hit(ctx, 0.6, 1.8), out);
      chain(noiseSource(ctx, random), hit(ctx, 0.9, 1.9), out);
    },
  },
  /** Reverse snare: a snare's ring run backwards, sucking in to the downbeat — outrun's turn. */
  reverseSnare: {
    duration: 1.2,
    // One variant: the transitions' memory is tight, and it is heard once a build
    variants: 1,
    shape: 'swell',
    reverse: true,
    level: -3,
    build: (ctx, random) => {
      const out = ctx.destination;
      chain(sweep(ctx, 'triangle', jitter(random, 220, 0.03), 170, 0.08), hit(ctx, 0.7, 0.3), out);
      chain(noiseSource(ctx, random), filter(ctx, 'bandpass', 4000, 0.7), hit(ctx, 1, 1.1), out);
    },
  },
  /** Downlifter: noise and a tone falling away, the music coming down after the heat. */
  downlifter: {
    maxRate: RENDER_RATE.MID,
    duration: 2.5,
    variants: 1,
    level: -2,
    build: (ctx, random) => {
      const band = filter(ctx, 'bandpass', 8000, 2);
      band.frequency.exponentialRampToValueAtTime(200, 2.3);
      chain(noiseSource(ctx, random), band, hit(ctx, 1, 2.3, 0, 0.01), ctx.destination);
      chain(
        sweep(ctx, 'sine', jitter(random, 420, 0.05), 60, 1.8),
        hit(ctx, 0.35, 1.9),
        ctx.destination,
      );
    },
  },
  /** Boom under the drop: a sub falling away, a burst of noise, and the room it fills. */
  boom: {
    maxRate: RENDER_RATE.LOW,
    duration: 2.6,
    variants: 1,
    build: (ctx, random) => {
      const out = ctx.destination;
      chain(
        sweep(ctx, 'sine', jitter(random, 72, 0.04), 32, 0.6),
        hit(ctx, 1, 2.3),
        drive(ctx, 2.2),
        out,
      );
      // A knock on top, so a phone speaker hears the boom too
      chain(sweep(ctx, 'triangle', 220, 80, 0.1), hit(ctx, 0.4, 0.12), out);
      const burst = chain(noiseSource(ctx, random), filter(ctx, 'lowpass', 1400));
      const dry = hit(ctx, 0.6, 0.4);
      chain(burst, dry, out);
      chain(dry, room(ctx, 2, random), level(ctx, 0.25), out);
    },
  },
  /** Noise wave: a whoosh rising and falling back, the music drawing breath into the groove. */
  noiseWave: {
    maxRate: RENDER_RATE.MID,
    duration: 3,
    variants: 1,
    level: -3,
    build: (ctx, random) => {
      const tone = filter(ctx, 'lowpass', 300, 1.5);
      tone.frequency.exponentialRampToValueAtTime(jitter(random, 6000, 0.1), 1.4);
      tone.frequency.exponentialRampToValueAtTime(300, 2.9);
      const wave = ctx.createGain();
      wave.gain.setValueAtTime(0.0001, 0);
      wave.gain.exponentialRampToValueAtTime(1, 1.4);
      wave.gain.exponentialRampToValueAtTime(0.0001, 2.95);
      chain(noiseSource(ctx, random), tone, wave, ctx.destination);
    },
  },
} satisfies Record<string, SampleRecipe>;

export type TransitionSampleId = keyof typeof TRANSITION_SAMPLES;
