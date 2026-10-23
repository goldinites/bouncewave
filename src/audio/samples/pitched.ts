import { PitchedRecipe } from '@/audio/samples/SampleBank';
import { cents, chain, drive, filter, hit, level, osc } from '@/audio/samples/synth';

// A sustained sound loops over one second after a quarter-second settling: long enough that the
// beating of its detuned voices has room to move, short enough to keep memory down. The render
// runs a little past the loop, so a check can see that the loop joins seamlessly.
export const LOOP = { start: 0.25, length: 1 } as const;
export const LOOPED = LOOP.start + LOOP.length + 0.05; // s rendered

// Roots, MIDI: the notes each register is rendered at, a few semitones apart
export const BASS_ROOTS = [29, 35, 41, 47]; // F1–B2: the bass plays E1 to about D#3
const LEAD_ROOTS = [58, 64, 70, 76, 82, 88]; // A#3–E6: melodies and counter-melodies
const ARP_ROOTS = [58, 64, 70, 76, 82, 88]; // arpeggios reach a little higher
export const PAD_ROOTS = [52, 58, 64, 70]; // pad voicings sit in E3–C5
export const STAB_ROOTS = [64, 70, 76, 82]; // stabs play the voicing an octave up

/** Voices spread across the stereo field, from hard left to hard right in order. */
export function spread(
  ctx: BaseAudioContext,
  voices: AudioNode[],
  width: number,
  into: AudioNode,
): void {
  voices.forEach((voice, i) => {
    const panner = ctx.createStereoPanner();
    panner.pan.value = voices.length === 1 ? 0 : (i / (voices.length - 1)) * 2 * width - width;
    chain(voice, panner, into);
  });
}

/**
 * The pitched instruments (5.4b, docs/AUDIO.md): basses, leads, plucks, stabs and pads, each
 * rendered at a few roots. The arrangement plays them through a live envelope and filter, so a
 * note's length and brightness still follow the song and the match.
 */
export const PITCHED_SAMPLES = {
  /** Synthwave's bass: two saws a cycle apart and a square, warmly driven. */
  bassSaw: {
    roots: BASS_ROOTS,
    duration: LOOPED,
    loop: LOOP,
    build: (ctx, _random, f, tune) => {
      const sum = level(ctx, 0.4);
      osc(ctx, 'sawtooth', f).connect(sum);
      osc(ctx, 'sawtooth', tune(f + 1)).connect(sum);
      chain(osc(ctx, 'square', f), level(ctx, 0.5), sum);
      chain(sum, filter(ctx, 'lowpass', 2600), drive(ctx, 2), ctx.destination);
    },
  },
  /** Reese: two saws beating against each other over a sine, the darksynth growl. */
  bassReese: {
    roots: BASS_ROOTS,
    duration: LOOPED,
    loop: LOOP,
    build: (ctx, _random, f, tune) => {
      const sum = level(ctx, 0.45);
      osc(ctx, 'sawtooth', tune(f - 1)).connect(sum);
      osc(ctx, 'sawtooth', tune(f + 1)).connect(sum);
      chain(osc(ctx, 'sine', f), level(ctx, 0.8), sum);
      chain(sum, filter(ctx, 'lowpass', 1300), drive(ctx, 1.8), ctx.destination);
    },
  },
  /** FM bass: a bright, rubbery attack settling into a round tone. */
  bassFm: {
    roots: BASS_ROOTS,
    duration: LOOPED,
    loop: LOOP,
    build: (ctx, _random, f) => {
      const carrier = osc(ctx, 'sine', f);
      const modulator = osc(ctx, 'sine', f * 2);
      const index = ctx.createGain();
      index.gain.setValueAtTime(f * 4, 0);
      index.gain.exponentialRampToValueAtTime(f * 1.1, 0.2);
      chain(modulator, index);
      index.connect(carrier.frequency);
      chain(carrier, drive(ctx, 1.5), ctx.destination);
    },
  },
  /** 808 sub: a long sine, driven so its overtones carry it on a phone speaker. */
  bass808: {
    roots: BASS_ROOTS,
    duration: 1.8,
    build: (ctx, _random, f) => {
      chain(osc(ctx, 'sine', f), hit(ctx, 1, 1.7, 0, 0.003), drive(ctx, 2.6), ctx.destination);
    },
  },
  /** Supersaw: seven detuned saws spread wide, the anthem lead. */
  supersaw: {
    roots: LEAD_ROOTS,
    duration: LOOPED,
    loop: LOOP,
    channels: 2,
    build: (ctx, _random, f, tune) => {
      const sum = filter(ctx, 'lowpass', 9000);
      sum.connect(ctx.destination);
      const voices = [-22, -14, -7, 0, 7, 14, 22].map((detune) =>
        chain(osc(ctx, 'sawtooth', detune ? tune(cents(f, detune)) : f), level(ctx, 0.25)),
      );
      spread(ctx, voices, 0.8, sum);
    },
  },
  /** A hollow square lead with a slow chorus, for chiptune and arcade melodies. */
  squareLead: {
    roots: LEAD_ROOTS,
    duration: LOOPED,
    loop: LOOP,
    build: (ctx, _random, f, tune) => {
      const sum = level(ctx, 0.4);
      osc(ctx, 'square', f).connect(sum);
      // Detuned both ways, so the chorus doesn't pull the pitch sharp
      chain(osc(ctx, 'square', tune(cents(f, 9))), level(ctx, 0.3), sum);
      chain(osc(ctx, 'square', tune(cents(f, -9))), level(ctx, 0.3), sum);
      chain(osc(ctx, 'triangle', f * 2), level(ctx, 0.3), sum);
      chain(sum, filter(ctx, 'lowpass', 7000), ctx.destination);
    },
  },
  /** Pluck: a bright snap of saw and square, its brightness falling as it rings out. */
  pluck: {
    roots: LEAD_ROOTS,
    duration: 1.1,
    build: (ctx, _random, f) => {
      const tone = filter(ctx, 'lowpass', f * 14, 2);
      tone.frequency.exponentialRampToValueAtTime(f * 2, 0.35);
      const sum = level(ctx, 0.5);
      osc(ctx, 'sawtooth', f).connect(sum);
      osc(ctx, 'square', cents(f, 6)).connect(sum);
      chain(sum, tone, hit(ctx, 1, 0.95, 0, 0.002), ctx.destination);
    },
  },
  /** Arpeggio pulse: a short square blip with its octave, filtered down fast. */
  arpPulse: {
    roots: ARP_ROOTS,
    duration: 0.6,
    build: (ctx, _random, f) => {
      const tone = filter(ctx, 'lowpass', 7000, 1.5);
      tone.frequency.exponentialRampToValueAtTime(900, 0.2);
      const sum = level(ctx, 0.6);
      osc(ctx, 'square', f).connect(sum);
      chain(osc(ctx, 'square', f * 2), level(ctx, 0.3), sum);
      chain(sum, tone, hit(ctx, 1, 0.5, 0, 0.002), ctx.destination);
    },
  },
  /** Brass stab: detuned saws whose filter blares open and closes again. */
  brass: {
    roots: STAB_ROOTS,
    duration: 0.8,
    build: (ctx, _random, f) => {
      const blare = filter(ctx, 'lowpass', 600, 1.2);
      blare.frequency.setValueAtTime(600, 0);
      blare.frequency.exponentialRampToValueAtTime(4500, 0.035);
      blare.frequency.exponentialRampToValueAtTime(1200, 0.45);
      const sum = level(ctx, 0.35);
      for (const detune of [-8, 0, 8]) osc(ctx, 'sawtooth', cents(f, detune)).connect(sum);
      chain(sum, blare, hit(ctx, 1, 0.7, 0, 0.012), ctx.destination);
    },
  },
  /** Warm pad: six detuned saws spread across the stereo field, slowly beating. */
  pad: {
    roots: PAD_ROOTS,
    duration: LOOPED,
    loop: LOOP,
    channels: 2,
    build: (ctx, _random, f, tune) => {
      const sum = filter(ctx, 'lowpass', 5000);
      sum.connect(ctx.destination);
      const voices = [-12, -6, -2, 2, 6, 12].map((detune) =>
        chain(osc(ctx, 'sawtooth', tune(cents(f, detune))), level(ctx, 0.25)),
      );
      spread(ctx, voices, 0.7, sum);
    },
  },
} satisfies Record<string, PitchedRecipe>;

export type PitchedSampleId = keyof typeof PITCHED_SAMPLES;
