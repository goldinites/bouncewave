import { RENDER_RATE, SampleRecipe } from '@/audio/samples/SampleBank';
import {
  chain,
  drive,
  filter,
  hit,
  jitter,
  level,
  metalCluster,
  noise,
  noiseSource,
  osc,
  pluckedString,
  pulseWave,
  room,
  sweep,
} from '@/audio/samples/synth';

/**
 * The wider palette's percussion (5.6), for the backdrops' kits to come — Japan's drums and
 * wood, the hand drums, the Khmer temple's cymbals and drums, the factory's metal and steam — rendered only once a song's kit
 * uses them or the stand asks, so they take no memory before.
 */
export const EXTRA_DRUMS = {
  /**
   * A timpani tuned to E (E2), the cathedral's orchestra: a stretched skin's inharmonic partials
   * blooming after the mallet, its pitch settling a little as it rings.
   */
  kickTimpani: {
    maxRate: RENDER_RATE.MID,
    duration: 1.2,
    variants: 2,
    build: (ctx, random) => {
      const out = ctx.destination;
      const root = jitter(random, 82.4, 0.005);
      const partials: [number, number, number][] = [
        [1, 1, 0.9],
        [1.5, 0.45, 0.6],
        [1.99, 0.3, 0.45],
        [2.44, 0.15, 0.3],
      ];
      for (const [ratio, peak, decay] of partials) {
        chain(
          sweep(ctx, 'sine', root * ratio * 1.04, root * ratio, 0.08),
          hit(ctx, peak, decay, 0, 0.003),
          out,
        );
      }
      chain(noiseSource(ctx, random), filter(ctx, 'bandpass', 400, 1.2), hit(ctx, 0.35, 0.03), out);
    },
  },
  /** A temple gong: inharmonic partials blooming slowly and ringing for seconds. */
  gong: {
    maxRate: RENDER_RATE.MID,
    duration: 4.5,
    variants: 2,
    level: -2,
    build: (ctx, random) => {
      const base = jitter(random, 98, 0.03);
      const out = level(ctx, 0.3);
      out.connect(ctx.destination);
      for (const [ratio, decay] of [
        [1, 4.2],
        [1.48, 3],
        [2.1, 2.2],
        [2.76, 1.6],
        [3.52, 1],
      ]) {
        const partial = sweep(ctx, 'sine', base * ratio * 1.01, base * ratio, 1.5);
        chain(partial, hit(ctx, 1, decay, 0, 0.03), out);
      }
      chain(noiseSource(ctx, random), filter(ctx, 'lowpass', 900), hit(ctx, 0.6, 0.15), out);
    },
  },
  /** A wood block: a hollow, dry knock. */
  woodblock: {
    duration: 0.2,
    variants: 3,
    level: -3,
    build: (ctx, random) => {
      chain(osc(ctx, 'sine', jitter(random, 1150, 0.03)), hit(ctx, 1, 0.06), ctx.destination);
      chain(
        noiseSource(ctx, random),
        filter(ctx, 'bandpass', 2400, 6),
        hit(ctx, 0.5, 0.02),
        ctx.destination,
      );
    },
  },
  /** Hyoshigi: two hardwood clappers struck together, a sharp, ringing crack. */
  hyoshigi: {
    duration: 0.3,
    variants: 2,
    level: -3,
    build: (ctx, random) => {
      const out = ctx.destination;
      chain(osc(ctx, 'sine', jitter(random, 2300, 0.02)), hit(ctx, 1, 0.12), out);
      chain(noiseSource(ctx, random), filter(ctx, 'bandpass', 3200, 8), hit(ctx, 0.8, 0.04), out);
      // The second clapper a hair behind
      chain(osc(ctx, 'sine', jitter(random, 2600, 0.02)), hit(ctx, 0.5, 0.08, 0.008), out);
    },
  },
  /** Odaiko: the great festival drum, deeper and longer than the taiko, felt as much as heard. */
  odaiko: {
    maxRate: RENDER_RATE.LOW,
    duration: 1.8,
    variants: 2,
    build: (ctx, random) => {
      const out = ctx.destination;
      const tune = jitter(random, 1, 0.03);
      chain(sweep(ctx, 'sine', 80 * tune, 42 * tune, 0.5), hit(ctx, 1, 1.6), drive(ctx, 2), out);
      chain(noiseSource(ctx, random), filter(ctx, 'lowpass', 300), hit(ctx, 0.7, 0.4), out);
      // The skin's overtone, for a phone speaker
      chain(sweep(ctx, 'triangle', 180 * tune, 120 * tune, 0.2), hit(ctx, 0.5, 0.3), out);
    },
  },
  /** Bongo: the small hand drum's high, quick pop. */
  bongo: {
    maxRate: RENDER_RATE.MID,
    duration: 0.3,
    variants: 3,
    level: -2,
    build: (ctx, random) => {
      const out = ctx.destination;
      chain(sweep(ctx, 'sine', jitter(random, 420, 0.04), 340, 0.05), hit(ctx, 1, 0.18), out);
      chain(noiseSource(ctx, random), filter(ctx, 'bandpass', 2000, 2), hit(ctx, 0.4, 0.015), out);
    },
  },
  /** Conga: the tall hand drum, a rounder tone and the slap of the palm. */
  conga: {
    maxRate: RENDER_RATE.MID,
    duration: 0.5,
    variants: 3,
    level: -2,
    build: (ctx, random) => {
      const out = ctx.destination;
      chain(sweep(ctx, 'sine', jitter(random, 230, 0.04), 195, 0.08), hit(ctx, 1, 0.35), out);
      chain(noiseSource(ctx, random), filter(ctx, 'bandpass', 1400, 1.5), hit(ctx, 0.5, 0.02), out);
    },
  },
  /** Udu: a clay pot drum struck over its hole — a deep "oong" bending up, like water. */
  udu: {
    maxRate: RENDER_RATE.LOW,
    duration: 0.8,
    variants: 2,
    build: (ctx, random) => {
      const tone = sweep(ctx, 'sine', jitter(random, 110, 0.05), 190, 0.25);
      chain(
        tone,
        filter(ctx, 'bandpass', 160, 1.5),
        hit(ctx, 1, 0.7, 0, 0.01),
        drive(ctx, 1.5),
        ctx.destination,
      );
      chain(
        noiseSource(ctx, random),
        filter(ctx, 'lowpass', 600),
        hit(ctx, 0.3, 0.04),
        ctx.destination,
      );
    },
  },
  /**
   * Chhing: the pair of small bronze cups that keeps time in a Khmer pinpeat ensemble, struck
   * and let ring — a high, glassy "chhing" of inharmonic partials.
   */
  chhing: {
    duration: 1.1,
    variants: 3,
    level: -4,
    build: (ctx, random) => {
      const out = filter(ctx, 'highpass', 1800);
      out.connect(ctx.destination);
      const base = jitter(random, 2650, 0.02);
      for (const [ratio, peak, decay] of [
        [1, 0.6, 0.9],
        [1.53, 0.45, 0.7],
        [2.37, 0.3, 0.5],
        [3.11, 0.2, 0.35],
      ]) {
        chain(osc(ctx, 'sine', base * ratio), hit(ctx, peak, decay), out);
      }
      // The second cup a hair behind, a little sharp: the pair beats against itself
      chain(osc(ctx, 'sine', base * 1.012), hit(ctx, 0.35, 0.8, 0.004), out);
      chain(noiseSource(ctx, random), filter(ctx, 'bandpass', 7000, 2), hit(ctx, 0.4, 0.01), out);
    },
  },
  /** Chhap: the same cups struck and pressed together, the ring stopped short. */
  chhap: {
    duration: 0.15,
    variants: 3,
    level: -4,
    build: (ctx, random) => {
      const out = filter(ctx, 'highpass', 1800);
      out.connect(ctx.destination);
      const base = jitter(random, 2650, 0.02);
      chain(osc(ctx, 'sine', base), hit(ctx, 0.5, 0.05), out);
      chain(osc(ctx, 'sine', base * 1.53), hit(ctx, 0.3, 0.04), out);
      chain(noiseSource(ctx, random), filter(ctx, 'bandpass', 5000, 1.5), hit(ctx, 0.6, 0.03), out);
    },
  },
  /** Skor thom: the pinpeat's great barrel drum, struck with a stick — a deep, round thud. */
  skor: {
    maxRate: RENDER_RATE.LOW,
    duration: 0.9,
    variants: 2,
    build: (ctx, random) => {
      const out = ctx.destination;
      const tune = jitter(random, 1, 0.03);
      chain(
        sweep(ctx, 'sine', 120 * tune, 78 * tune, 0.12),
        hit(ctx, 1, 0.7),
        drive(ctx, 1.6),
        out,
      );
      // The skin's overtone and the stick's knock, for a phone speaker
      chain(sweep(ctx, 'triangle', 240 * tune, 200 * tune, 0.1), hit(ctx, 0.35, 0.2), out);
      chain(noiseSource(ctx, random), filter(ctx, 'bandpass', 1200, 2), hit(ctx, 0.45, 0.02), out);
    },
  },
  /**
   * Sampho: the pinpeat's small two-headed drum, played with the hands — a tuned, ringing tone
   * on the small head, a dry slap of the palm on top.
   */
  sampho: {
    maxRate: RENDER_RATE.MID,
    duration: 0.4,
    variants: 3,
    level: -2,
    build: (ctx, random) => {
      const out = ctx.destination;
      const tune = jitter(random, 1, 0.05);
      chain(sweep(ctx, 'sine', 330 * tune, 290 * tune, 0.04), hit(ctx, 1, 0.25), out);
      chain(osc(ctx, 'sine', 660 * tune), hit(ctx, 0.2, 0.08), out);
      chain(noiseSource(ctx, random), filter(ctx, 'bandpass', 1800, 2), hit(ctx, 0.5, 0.012), out);
    },
  },
  /** Rain stick: seeds trickling down a hollow cactus, a long rustle of tiny clicks. */
  rainstick: {
    maxRate: RENDER_RATE.MID,
    duration: 2.4,
    variants: 2,
    level: -3,
    build: (ctx, random) => {
      const buffer = noise(ctx, 2.4, random);
      const data = buffer.getChannelData(0);
      // Sparse grains: most of the noise silenced, the rest swelling and fading over the
      // trickle, done well before the end so the room's ring has died away too
      const trickle = Math.floor(data.length * 0.8);
      for (let i = 0; i < data.length; i++) {
        const keep = i < trickle && random() < 0.012;
        const fade = Math.sin((Math.PI * i) / trickle) ** 2;
        data[i] = keep ? data[i] * fade : 0;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.start();
      chain(source, filter(ctx, 'bandpass', 4500, 1.2), room(ctx, 0.15, random), ctx.destination);
    },
  },
  /** A chain's rattle: a few links of metal knocking in a quick, uneven run. */
  chain: {
    duration: 0.6,
    variants: 2,
    level: -3,
    build: (ctx, random) => {
      const out = filter(ctx, 'highpass', 1800);
      out.connect(ctx.destination);
      let time = 0;
      for (let link = 0; link < 6; link++) {
        chain(metalCluster(ctx, jitter(random, 260, 0.2), time), hit(ctx, 0.5, 0.06, time), out);
        time += jitter(random, 0.05, 0.5);
      }
    },
  },
  /** Steam: a pneumatic valve's hiss, sharp on the attack and blowing out. */
  steam: {
    maxRate: RENDER_RATE.MID,
    duration: 0.9,
    variants: 2,
    level: -3,
    build: (ctx, random) => {
      const band = filter(ctx, 'highpass', 1500);
      band.frequency.exponentialRampToValueAtTime(4000, 0.8);
      chain(noiseSource(ctx, random), band, hit(ctx, 1, 0.8, 0, 0.008), ctx.destination);
    },
  },
  /** A synth cymbal: the Simmons era's electronic crash, metal clusters and noise, a little hollow. */
  synthCymbal: {
    duration: 1.6,
    variants: 2,
    level: -3,
    build: (ctx, random) => {
      const out = filter(ctx, 'highpass', 5000);
      out.connect(ctx.destination);
      chain(metalCluster(ctx, jitter(random, 70, 0.03)), hit(ctx, 0.6, 1.4), out);
      chain(noiseSource(ctx, random), filter(ctx, 'bandpass', 9000, 0.8), hit(ctx, 0.8, 1.2), out);
    },
  },
} satisfies Record<string, SampleRecipe>;

export type ExtraDrumId = keyof typeof EXTRA_DRUMS;

/**
 * One-shot sounds a section can strike on a pattern (`SectionDef.hits`), on the fx layer: the
 * backdrops' signals — a siren, a modem's handshake, a radio between stations, an 8-bit chirp —
 * and a harp's glissando and a brass fanfare for the finales.
 */
export const FX_HITS = {
  /** A siren rising and falling twice. */
  siren: {
    maxRate: RENDER_RATE.MID,
    duration: 2.4,
    variants: 1,
    level: -4,
    build: (ctx) => {
      const tone = ctx.createOscillator();
      tone.type = 'sawtooth';
      tone.frequency.setValueAtTime(600, 0);
      for (const [at, hz] of [
        [0.55, 1150],
        [1.1, 600],
        [1.65, 1150],
        [2.2, 600],
      ]) {
        tone.frequency.linearRampToValueAtTime(hz, at);
      }
      tone.start();
      chain(tone, filter(ctx, 'lowpass', 2500), hit(ctx, 1, 2.3, 0, 0.05), ctx.destination);
    },
  },
  /** A dial-up modem's handshake: an answer tone, warbling tones, then a screech of noise. */
  modem: {
    maxRate: RENDER_RATE.MID,
    duration: 1.6,
    variants: 1,
    level: -5,
    build: (ctx, random) => {
      const out = ctx.destination;
      const answer = osc(ctx, 'sine', 2100);
      const gate = ctx.createGain();
      gate.gain.setValueAtTime(0.5, 0);
      gate.gain.setValueAtTime(0, 0.35);
      chain(answer, gate, out);
      const warble = ctx.createOscillator();
      warble.frequency.setValueAtTime(1300, 0.35);
      for (let i = 0; i < 14; i++)
        warble.frequency.setValueAtTime(i % 2 ? 2100 : 1300, 0.35 + i * 0.03);
      warble.start(0.35);
      warble.stop(0.8);
      chain(warble, level(ctx, 0.4), out);
      const screech = filter(ctx, 'bandpass', 1200, 3);
      screech.frequency.setValueAtTime(800, 0.8);
      screech.frequency.exponentialRampToValueAtTime(3500, 1.5);
      chain(noiseSource(ctx, random, 0.8), screech, hit(ctx, 0.9, 0.7, 0.8, 0.02), out);
    },
  },
  /** A radio between stations: crackling static and a tuning whistle sliding past. */
  radioStatic: {
    maxRate: RENDER_RATE.MID,
    duration: 1.4,
    variants: 2,
    level: -5,
    build: (ctx, random) => {
      const out = ctx.destination;
      const swell = ctx.createGain();
      swell.gain.setValueAtTime(0, 0);
      swell.gain.linearRampToValueAtTime(1, 0.3);
      swell.gain.linearRampToValueAtTime(0, 1.35);
      chain(noiseSource(ctx, random), filter(ctx, 'bandpass', 1600, 0.6), swell, out);
      const whistle = sweep(ctx, 'sine', jitter(random, 900, 0.2), 2400, 1.2);
      chain(whistle, level(ctx, 0.15), swell);
    },
  },
  /** An 8-bit chirp: a pulse arpeggio racing up an octave and a half. */
  chirp: {
    duration: 0.35,
    variants: 1,
    level: -4,
    build: (ctx) => {
      const tone = ctx.createOscillator();
      tone.setPeriodicWave(pulseWave(ctx, 0.25));
      [1047, 1319, 1568, 2093, 2637].forEach((hz, i) =>
        tone.frequency.setValueAtTime(hz, i * 0.05),
      );
      tone.start();
      chain(tone, hit(ctx, 0.6, 0.3, 0, 0.002), ctx.destination);
    },
  },
  /** A harp's glissando: strings plucked up a pentatonic scale in a rush. */
  harpGliss: {
    maxRate: RENDER_RATE.MID,
    duration: 2.6,
    variants: 1,
    level: -3,
    build: (ctx, random) => {
      const out = filter(ctx, 'lowpass', 5000);
      out.connect(ctx.destination);
      const scale = [0, 2, 4, 7, 9];
      for (let i = 0; i < 12; i++) {
        const semitones = scale[i % 5] + 12 * Math.floor(i / 5);
        const time = i * 0.055;
        const string = pluckedString(ctx, random, 262 * 2 ** (semitones / 12), 0.998, 1, time);
        chain(string, hit(ctx, 0.35, 2.3 - time, time, 0.002), out);
      }
    },
  },
  /** A brass fanfare: two short blasts and a long one on a major chord. */
  fanfare: {
    maxRate: RENDER_RATE.MID,
    duration: 1.8,
    variants: 1,
    level: -3,
    build: (ctx) => {
      const out = level(ctx, 0.25);
      out.connect(ctx.destination);
      const blasts = [
        [0, 0.14],
        [0.18, 0.14],
        [0.36, 1.3],
      ];
      for (const hz of [262, 330, 392, 523]) {
        for (const [at, length] of blasts) {
          const tone = ctx.createOscillator();
          tone.type = 'sawtooth';
          tone.frequency.value = hz;
          tone.start(at);
          tone.stop(at + length + 0.05);
          const blare = filter(ctx, 'lowpass', 700, 1.2);
          blare.frequency.setValueAtTime(700, at);
          blare.frequency.exponentialRampToValueAtTime(3500, at + 0.04);
          blare.frequency.exponentialRampToValueAtTime(1500, at + length);
          chain(tone, blare, hit(ctx, 1, length, at, 0.01), out);
        }
      }
    },
  },
} satisfies Record<string, SampleRecipe>;

export type FxHitId = keyof typeof FX_HITS;
