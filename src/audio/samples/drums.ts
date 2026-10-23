import { RENDER_RATE, SampleRecipe } from '@/audio/samples/SampleBank';
import {
  chain,
  drive,
  filter,
  hit,
  jitter,
  metalCluster,
  noiseSource,
  room,
  sweep,
} from '@/audio/samples/synth';

/**
 * The drum sounds, rendered from code (5.4a, docs/AUDIO.md): kicks for every genre of the
 * soundtrack, layered snares and claps, live hats, percussion and industrial metal. A kit
 * (audio/music/kits.ts) picks one of each for a song.
 */
export const DRUM_SAMPLES = {
  /** Synthwave's kick: a tight thump with a click on top, a little saturated for punch. */
  kickPunch: {
    maxRate: RENDER_RATE.MID,
    duration: 0.5,
    variants: 3,
    build: (ctx, random) => {
      const out = ctx.destination;
      const body = sweep(ctx, 'sine', jitter(random, 165, 0.03), 48, 0.09);
      chain(body, hit(ctx, 1, 0.38), drive(ctx, 1.6), out);
      const click = noiseSource(ctx, random);
      chain(click, filter(ctx, 'highpass', 2500), hit(ctx, 0.35, 0.006), out);
    },
  },
  /** The 808: a long sine tail gliding down, its overtones kept so a phone still hears it. */
  kick808: {
    maxRate: RENDER_RATE.LOW,
    duration: 1.6,
    variants: 2,
    // Its long tail is mostly sub: at full scale it would swamp a song
    level: -2,
    build: (ctx, random) => {
      const body = sweep(ctx, 'sine', jitter(random, 95, 0.02), 46, 0.32);
      chain(body, hit(ctx, 1, 1.45, 0, 0.002), drive(ctx, 3.5), ctx.destination);
      // A knock on the attack, an octave and more up: what a phone speaker plays of the 808
      const knock = sweep(ctx, 'triangle', jitter(random, 420, 0.03), 190, 0.06);
      chain(knock, hit(ctx, 0.45, 0.07), ctx.destination);
    },
  },
  /** Darksynth's kick: the punch driven hard into distortion, then the fizz taken off the top. */
  kickDistorted: {
    maxRate: RENDER_RATE.MID,
    duration: 0.45,
    variants: 3,
    build: (ctx, random) => {
      const out = filter(ctx, 'lowpass', 5500);
      out.connect(ctx.destination);
      const body = sweep(ctx, 'sine', jitter(random, 180, 0.03), 50, 0.08);
      chain(body, hit(ctx, 1, 0.32), drive(ctx, 7), out);
      chain(noiseSource(ctx, random), filter(ctx, 'bandpass', 3000, 1), hit(ctx, 0.5, 0.01), out);
    },
  },
  /** A snare in three layers: the stick's click, the drum's body, and the wires' rattle. */
  snare: {
    duration: 0.4,
    variants: 4,
    level: -1,
    build: (ctx, random) => {
      const out = ctx.destination;
      const tune = jitter(random, 1, 0.03);
      chain(sweep(ctx, 'triangle', 230 * tune, 165 * tune, 0.07), hit(ctx, 0.7, 0.12), out);
      chain(sweep(ctx, 'sine', 340 * tune, 300 * tune, 0.05), hit(ctx, 0.3, 0.07), out);
      const wires = chain(
        noiseSource(ctx, random),
        filter(ctx, 'highpass', 1400),
        filter(ctx, 'lowpass', 9000),
      );
      chain(wires, hit(ctx, 0.75, jitter(random, 0.2, 0.15)), out);
      chain(noiseSource(ctx, random), filter(ctx, 'highpass', 5000), hit(ctx, 0.4, 0.004), out);
    },
  },
  /** The 80s gated snare: the snare in a big room whose tail is cut off dead. */
  snareGated: {
    duration: 0.36,
    variants: 3,
    level: -1,
    build: (ctx, random) => {
      const gate = ctx.createGain();
      gate.gain.setValueAtTime(1, 0);
      gate.gain.setValueAtTime(1, 0.2);
      gate.gain.linearRampToValueAtTime(0, 0.26);
      gate.connect(ctx.destination);

      const snare = ctx.createGain();
      chain(sweep(ctx, 'triangle', 210, 160, 0.08), hit(ctx, 0.8, 0.12), snare);
      chain(noiseSource(ctx, random), filter(ctx, 'highpass', 1200), hit(ctx, 0.8, 0.18), snare);
      const wet = ctx.createGain();
      wet.gain.value = 0.9;
      chain(snare, room(ctx, 0.9, random), wet, gate);
      snare.connect(gate);
    },
  },
  /** A clap: several hands a few milliseconds apart, then the room they clap in. */
  clap: {
    duration: 0.4,
    variants: 4,
    level: -1,
    build: (ctx, random) => {
      const band = filter(ctx, 'bandpass', jitter(random, 1250, 0.08), 0.9);
      band.connect(ctx.destination);
      const source = noiseSource(ctx, random);
      const hands = ctx.createGain();
      hands.gain.setValueAtTime(0, 0);
      for (let i = 0; i < 4; i++) {
        const at = i * 0.009 + random() * 0.003;
        hands.gain.setValueAtTime(i === 3 ? 0.9 : 0.75, at);
        hands.gain.exponentialRampToValueAtTime(0.15, at + 0.008);
      }
      hands.gain.exponentialRampToValueAtTime(0.0001, 0.2);
      chain(source, hands, band);
      const tail = ctx.createGain();
      tail.gain.value = 0.35;
      chain(hands, room(ctx, 0.3, random), tail, band);
    },
  },
  /** Closed hat: the 808's metal and a breath of noise, bright and short. */
  hat: {
    duration: 0.14,
    variants: 4,
    level: -2,
    build: (ctx, random) => {
      const out = filter(ctx, 'highpass', 7000);
      out.connect(ctx.destination);
      const metal = metalCluster(ctx, jitter(random, 40, 0.02));
      chain(metal, filter(ctx, 'bandpass', 10000, 1), hit(ctx, 1, jitter(random, 0.05, 0.2)), out);
      chain(noiseSource(ctx, random), hit(ctx, 0.3, 0.04), out);
    },
  },
  /** Open hat: the closed one left to ring. */
  open: {
    duration: 0.5,
    variants: 3,
    level: -2,
    build: (ctx, random) => {
      const out = filter(ctx, 'highpass', 6500);
      out.connect(ctx.destination);
      const metal = metalCluster(ctx, jitter(random, 40, 0.02));
      chain(metal, filter(ctx, 'bandpass', 9500, 0.8), hit(ctx, 1, jitter(random, 0.33, 0.1)), out);
      chain(noiseSource(ctx, random), hit(ctx, 0.25, 0.25), out);
    },
  },
  /** Shaker: a swish of noise that swells in, not a hit. */
  shaker: {
    duration: 0.15,
    variants: 4,
    level: -3,
    build: (ctx, random) => {
      const swish = hit(ctx, 1, jitter(random, 0.08, 0.2), 0, jitter(random, 0.018, 0.3));
      chain(noiseSource(ctx, random), filter(ctx, 'bandpass', 6500, 1.2), swish, ctx.destination);
    },
  },
  /** Crash: the metal and noise washing out over a second and a half. */
  crash: {
    duration: 1.6,
    variants: 2,
    level: -2,
    build: (ctx, random) => {
      const out = filter(ctx, 'highpass', 3000);
      out.connect(ctx.destination);
      const metal = metalCluster(ctx, jitter(random, 52, 0.03));
      chain(metal, hit(ctx, 0.7, 1.25), out);
      chain(noiseSource(ctx, random), hit(ctx, 0.8, 1.45), out);
    },
  },
  /** A tom, tuned mid; fills play it faster or slower for the high and low ones. */
  tom: {
    maxRate: RENDER_RATE.MID,
    duration: 0.5,
    variants: 3,
    build: (ctx, random) => {
      const tune = jitter(random, 1, 0.02);
      chain(
        sweep(ctx, 'sine', 190 * tune, 115 * tune, 0.25),
        hit(ctx, 1, 0.38),
        drive(ctx, 1.5),
        ctx.destination,
      );
      chain(
        noiseSource(ctx, random),
        filter(ctx, 'lowpass', 2500),
        hit(ctx, 0.3, 0.03),
        ctx.destination,
      );
    },
  },
  /** Taiko: a deep skin dropping in pitch under the slap of the stick. */
  taiko: {
    maxRate: RENDER_RATE.LOW,
    duration: 0.9,
    variants: 3,
    build: (ctx, random) => {
      const out = ctx.destination;
      const tune = jitter(random, 1, 0.03);
      const body = ctx.createOscillator();
      body.frequency.setValueAtTime(110 * tune, 0);
      body.frequency.exponentialRampToValueAtTime(78 * tune, 0.06);
      body.frequency.exponentialRampToValueAtTime(62 * tune, 0.7);
      body.start();
      chain(body, hit(ctx, 1, 0.75), drive(ctx, 1.8), out);
      chain(noiseSource(ctx, random), filter(ctx, 'lowpass', 450), hit(ctx, 0.6, 0.2), out);
      chain(noiseSource(ctx, random), filter(ctx, 'bandpass', 1800, 1), hit(ctx, 0.5, 0.035), out);
      // The skin's overtone, so the drum still reads on a phone speaker
      chain(sweep(ctx, 'triangle', 240 * tune, 165 * tune, 0.12), hit(ctx, 0.6, 0.16), out);
    },
  },
  /** Rimshot: a woody click, for sparse grooves. */
  rim: {
    duration: 0.1,
    variants: 3,
    level: -3,
    build: (ctx, random) => {
      const out = ctx.destination;
      chain(sweep(ctx, 'triangle', jitter(random, 1700, 0.03), 1600, 0.02), hit(ctx, 1, 0.03), out);
      chain(noiseSource(ctx, random), filter(ctx, 'bandpass', 1000, 3), hit(ctx, 0.6, 0.025), out);
    },
  },
  /**
   * Industrial clang: a struck steel bar — partials at a free bar's inharmonic ratios, the high
   * ones dying first — over the strike's noise.
   */
  clang: {
    duration: 1.4,
    variants: 2,
    level: -2,
    build: (ctx, random) => {
      const out = drive(ctx, 1.4);
      out.connect(ctx.destination);
      const base = jitter(random, 410, 0.06);
      const partials = [
        [1, 1, 1.2],
        [2.76, 0.7, 0.8],
        [5.4, 0.5, 0.45],
        [8.93, 0.35, 0.25],
        [13.34, 0.25, 0.15],
      ];
      for (const [ratio, level, decay] of partials) {
        const osc = ctx.createOscillator();
        osc.frequency.value = base * ratio * jitter(random, 1, 0.005);
        osc.start();
        chain(osc, hit(ctx, level * 0.4, jitter(random, decay, 0.15)), out);
      }
      chain(noiseSource(ctx, random), filter(ctx, 'highpass', 2000), hit(ctx, 0.5, 0.02), out);
    },
  },
  /** Industrial impact: a crushed noise burst over a low thump and a short ring of metal. */
  impact: {
    duration: 0.7,
    variants: 3,
    level: -1,
    build: (ctx, random) => {
      const out = ctx.destination;
      chain(sweep(ctx, 'sine', 120, 45, 0.15), hit(ctx, 1, 0.45), drive(ctx, 3), out);
      const crush = chain(
        noiseSource(ctx, random),
        filter(ctx, 'lowpass', jitter(random, 3500, 0.15)),
      );
      chain(crush, hit(ctx, 0.9, 0.18), drive(ctx, 6), out);
      const ring = ctx.createOscillator();
      ring.frequency.value = jitter(random, 640, 0.05);
      ring.start();
      chain(ring, hit(ctx, 0.25, 0.3), out);
    },
  },
} satisfies Record<string, SampleRecipe>;

export type DrumSampleId = keyof typeof DRUM_SAMPLES;
