import { LeadVoice } from '@/audio/music/score';
import { LOOP, LOOPED } from '@/audio/samples/pitched';
import { PitchedRecipe } from '@/audio/samples/SampleBank';
import { cents, chain, drive, filter, hit, level, noiseSource, osc } from '@/audio/samples/synth';

// The melodies sit between G4 and D6: four roots cover it within three semitones
const ROOTS = [65, 71, 77, 83];
// The hard-sync wave: its slave oscillator runs this many times faster than the master and
// restarts with it, the bright, nasal tone of the 80s sync lead
const SYNC_RATIO = 2.6;
const SYNC_HARMONICS = 48;
// The vibraphone's motor: the fans in its resonators swell each note this often, this deep
const VIBES_TREMOLO = { RATE: 5, DEPTH: 0.25 } as const; // Hz, share of the volume

/**
 * One cycle of a hard-synced saw as a band-limited wave: its harmonics worked out from the
 * cycle, so it plays clean at any pitch, where a wave drawn sample by sample would alias.
 */
function syncWave(ctx: BaseAudioContext): PeriodicWave {
  const samples = 2048;
  const cycle = Array.from({ length: samples }, (_, i) => {
    const phase = (i / samples) * SYNC_RATIO;
    return 2 * (phase - Math.floor(phase)) - 1;
  });
  const real = new Float32Array(SYNC_HARMONICS + 1);
  const imag = new Float32Array(SYNC_HARMONICS + 1);
  for (let k = 1; k <= SYNC_HARMONICS; k++) {
    for (let i = 0; i < samples; i++) {
      const angle = (2 * Math.PI * k * i) / samples;
      real[k] += (cycle[i] * Math.cos(angle) * 2) / samples;
      imag[k] += (cycle[i] * Math.sin(angle) * 2) / samples;
    }
  }
  return ctx.createPeriodicWave(real, imag);
}

/**
 * Lead sounds beyond the core palette (5.6a), first auditioned on the listening stand: rendered
 * only when a song that plays them is coming up, or the stand asks, so a voice no song in play
 * uses takes no memory.
 */
export const EXTRA_LEADS = {
  /** Soft: a triangle and sines with a slow chorus, warm and round, after "Nightcall" and M83. */
  leadSoft: {
    roots: ROOTS,
    duration: LOOPED,
    loop: LOOP,
    build: (ctx, _random, f, tune) => {
      const sum = level(ctx, 0.5);
      osc(ctx, 'triangle', f).connect(sum);
      chain(osc(ctx, 'sine', f), level(ctx, 0.7), sum);
      chain(osc(ctx, 'sine', tune(cents(f, 7))), level(ctx, 0.35), sum);
      chain(sum, filter(ctx, 'lowpass', 3500), ctx.destination);
    },
  },
  /** Brass: a polysynth's warm saws, detuned both ways, a little growl, after the Jupiter-8. */
  leadBrass: {
    roots: ROOTS,
    duration: LOOPED,
    loop: LOOP,
    build: (ctx, _random, f, tune) => {
      const sum = level(ctx, 0.35);
      osc(ctx, 'sawtooth', f).connect(sum);
      osc(ctx, 'sawtooth', tune(cents(f, -7))).connect(sum);
      osc(ctx, 'sawtooth', tune(cents(f, 7))).connect(sum);
      chain(sum, filter(ctx, 'lowpass', 2400, 1.2), drive(ctx, 1.3), ctx.destination);
    },
  },
  /** Sync: a hard-synced saw, bright and nasal, the cutting lead of the 80s. */
  leadSync: {
    roots: ROOTS,
    duration: LOOPED,
    loop: LOOP,
    build: (ctx, _random, f, tune) => {
      const wave = syncWave(ctx);
      const voice = (frequency: number, gain: number) => {
        const node = ctx.createOscillator();
        node.setPeriodicWave(wave);
        node.frequency.value = frequency;
        node.start();
        return chain(node, level(ctx, gain));
      };
      const out = filter(ctx, 'lowpass', 7000);
      out.connect(ctx.destination);
      voice(f, 0.5).connect(out);
      voice(tune(cents(f, 5)), 0.3).connect(out);
    },
  },
  /**
   * PWM: a pulse whose width sways once a second, made as a saw minus itself delayed — the
   * delay swinging moves the pulse's width — living and shimmering, after the Prophet-5.
   */
  leadPwm: {
    roots: ROOTS,
    duration: LOOPED,
    loop: LOOP,
    build: (ctx, _random, f) => {
      const saw = osc(ctx, 'sawtooth', f);
      const delayed = ctx.createDelay(0.1);
      delayed.delayTime.value = 0.5 / f;
      // Once a second: a whole number of sways in the loop, so it joins seamlessly
      const sway = osc(ctx, 'sine', 1);
      const depth = level(ctx, 0.35 / f);
      sway.connect(depth);
      depth.connect(delayed.delayTime);
      const pulse = level(ctx, 0.5);
      saw.connect(pulse);
      chain(saw, delayed, level(ctx, -0.5), pulse);
      chain(pulse, filter(ctx, 'lowpass', 6000), ctx.destination);
    },
  },
  /**
   * Electric piano, after the DX7's: a sine carrier struck by a modulator at its own pitch, the
   * bark of the strike settling into a round tone, and a high tine ringing briefly on top.
   */
  leadEpiano: {
    roots: ROOTS,
    duration: 2.2,
    build: (ctx, _random, f) => {
      const out = hit(ctx, 1, 2, 0, 0.002);
      out.connect(ctx.destination);
      const fm = (ratio: number, from: number, to: number, settle: number, gain: number) => {
        const carrier = osc(ctx, 'sine', f);
        const index = ctx.createGain();
        index.gain.setValueAtTime(f * from, 0);
        index.gain.exponentialRampToValueAtTime(f * to, settle);
        chain(osc(ctx, 'sine', f * ratio), index);
        index.connect(carrier.frequency);
        chain(carrier, level(ctx, gain), out);
      };
      fm(1, 2.2, 0.3, 0.6, 0.8);
      fm(14, 3, 0.01, 0.08, 0.3);
    },
  },
  /**
   * Sax: a saw and a square through a reedy low-pass, a nasal formant beside it and a little
   * drive, held as long as the note is; it breathes in on the envelope's slow attack.
   */
  leadSax: {
    roots: ROOTS,
    duration: LOOPED,
    loop: LOOP,
    build: (ctx, _random, f, tune) => {
      const sum = level(ctx, 0.4);
      osc(ctx, 'sawtooth', f).connect(sum);
      chain(osc(ctx, 'square', tune(cents(f, 4))), level(ctx, 0.4), sum);
      const out = drive(ctx, 1.6);
      out.connect(ctx.destination);
      chain(sum, filter(ctx, 'lowpass', 2200, 0.8), out);
      chain(sum, filter(ctx, 'bandpass', 1400, 1.2), level(ctx, 0.6), out);
    },
  },
  /**
   * Muted funk guitar: a short, dull pluck, the palm damping its brightness at once, with the
   * pick's click on the attack.
   */
  leadGuitar: {
    roots: ROOTS,
    duration: 0.7,
    build: (ctx, random, f) => {
      const tone = filter(ctx, 'lowpass', f * 8, 1);
      tone.frequency.exponentialRampToValueAtTime(f * 1.5, 0.15);
      const out = hit(ctx, 1, 0.5, 0, 0.002);
      out.connect(ctx.destination);
      const sum = level(ctx, 0.5);
      osc(ctx, 'sawtooth', f).connect(sum);
      chain(osc(ctx, 'triangle', cents(f, -5)), level(ctx, 0.6), sum);
      chain(sum, tone, filter(ctx, 'highpass', 180), out);
      chain(noiseSource(ctx, random), filter(ctx, 'bandpass', 3000, 1.5), hit(ctx, 0.3, 0.02), out);
    },
  },
  /**
   * Vibraphone: a struck bar's sine with its fourth and tenth partials dying away faster, the
   * motor's tremolo swelling it as it rings.
   */
  leadVibes: {
    roots: ROOTS,
    duration: 2.6,
    build: (ctx, _random, f) => {
      const sum = level(ctx, 0.7);
      osc(ctx, 'sine', f).connect(sum);
      chain(osc(ctx, 'sine', f * 4), hit(ctx, 0.3, 0.6), sum);
      chain(osc(ctx, 'sine', f * 10), hit(ctx, 0.08, 0.15), sum);
      const tremolo = level(ctx, 1 - VIBES_TREMOLO.DEPTH);
      chain(osc(ctx, 'sine', VIBES_TREMOLO.RATE), level(ctx, VIBES_TREMOLO.DEPTH)).connect(
        tremolo.gain,
      );
      chain(sum, tremolo, hit(ctx, 1, 2.4, 0, 0.002), ctx.destination);
    },
  },
} satisfies Record<string, PitchedRecipe>;

export type ExtraLeadId = keyof typeof EXTRA_LEADS;

/** The lead voices played from an extra lead. */
export const EXTRA_LEAD_FOR: Partial<Record<LeadVoice, ExtraLeadId>> = {
  soft: 'leadSoft',
  brass: 'leadBrass',
  sync: 'leadSync',
  pwm: 'leadPwm',
  epiano: 'leadEpiano',
  sax: 'leadSax',
  guitar: 'leadGuitar',
  vibes: 'leadVibes',
};
