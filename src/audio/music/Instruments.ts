import { DrumKit, DrumRole } from '@/audio/music/kits';
import { MusicGraph, PAD_SPREAD } from '@/audio/music/MusicGraph';
import { ArpVoice, BassVoice, LeadVoice } from '@/audio/music/score';
import { PitchedSampleId } from '@/audio/samples/pitched';
import { SampleBank } from '@/audio/samples/SampleBank';
import { TransitionSampleId } from '@/audio/samples/transitions';
import { midiToFrequency } from '@/shared/math';

const PAD_DETUNE_CENTS = [-9, 9];
const SUPERSAW_DETUNE_CENTS = [-12, 12];
// Vibrato on held lead notes: fades in after the attack, like a singer leaning into a note
const VIBRATO = { RATE: 5.5, DEPTH_CENTS: 14, DELAY: 0.25, MIN_DURATION: 0.45 } as const;
// FM bell: a sine modulated at an inharmonic ratio, its brightness dying away quickly
const BELL = { RATIO: 3.5, INDEX: 2.2, BRIGHTNESS_DECAY: 0.5, MIN_RING: 1.2 } as const;
// Koto: the string is plucked a little flat and snaps up into pitch, then rings out
const KOTO = { SNAP_CENTS: -70, SNAP_TIME: 0.04, MIN_RING: 0.5, RING_SHARE: 1.6 } as const;
// Shakuhachi-like flute: breath on the attack, a scoop up into the note, slow wide vibrato
const FLUTE = {
  ATTACK: 0.06,
  SCOOP_CENTS: -45,
  SCOOP_TIME: 0.12,
  BREATH: 0.35,
  VIBRATO_RATE: 4.5,
  VIBRATO_CENTS: 22,
} as const;
const TOM_PITCHES: Record<string, number> = { '1': 220, '2': 160, '3': 115 };
const TAIKO_PITCH = 78; // Hz: deep enough to read as a big drum, high enough for phone speakers
// The rendered tom is tuned mid; fills play it faster or slower for the high and low ones
export const TOM_RATES: Record<string, number> = { '1': 1.3, '2': 1, '3': 0.75 };
// No two hits alike: each drum sample is played a little louder or softer, higher or lower
const HUMANIZE = {
  VOLUME: 0.07, // ± share of the volume
  CENTS: { kick: 4, snare: 15, clap: 20, hat: 35, open: 25, perc: 25, default: 12 },
} as const;
// Rendered samples peak at full scale, the live synths they replace a little higher or lower:
// each role's sample is scaled so a song keeps its balance
const SAMPLE_GAIN: Partial<Record<DrumRole, number>> = {
  snare: 1.5,
  clap: 1.2,
  metal: 0.6,
  perc: 0.8,
};

/** One-shot synth voices, each scheduled at an exact audio-clock time. */
// What a rendered voice falls back to until it is rendered
const LIVE_BASS: Record<BassVoice, OscillatorType> = {
  bassSaw: 'sawtooth',
  bassReese: 'sawtooth',
  bassFm: 'square',
  bass808: 'sine',
};
const LIVE_ARP: Record<ArpVoice, OscillatorType> = { arpPulse: 'square', pluck: 'sawtooth' };
const OSCILLATOR_TYPES: readonly string[] = ['sine', 'square', 'sawtooth', 'triangle'];
// Lead voices that have a rendered instrument
const SAMPLED_LEADS: Partial<Record<LeadVoice, PitchedSampleId>> = {
  saw: 'supersaw',
  square: 'squareLead',
  pluck: 'pluck',
};
// A rendered note is played a touch louder or softer each time, never out of tune
const NOTE_HUMANIZE = 0.05; // ± share of the volume

/** How a rendered note is played: its envelope and the live filter over it. */
interface NoteShape {
  attack: number; // s
  /** Share of the volume the note settles to, `decay` seconds after the attack. */
  sustain?: number;
  decay?: number; // s
  release: number; // s, before the note's end
  /** The low-pass: from `from` at the attack to `to` by `over` seconds; none if left out. */
  cutoff?: { from: number; to: number; over: number };
  /** Vibrato fading in on held notes. */
  vibrato?: boolean;
  /** Portamento: the note slides in from this MIDI note over `glide.time` seconds. */
  glide?: { from: number; time: number };
}

export class Instruments {
  private readonly graph: MusicGraph;
  private readonly samples: SampleBank;

  /** @param samples the rendered sounds; until one is rendered its live synth plays instead */
  constructor(graph: MusicGraph, samples: SampleBank = new SampleBank()) {
    this.graph = graph;
    this.samples = samples;
  }

  /**
   * A drum of the song's kit, on the drums stem: its rendered sample, humanized, or, before the
   * samples are ready, the live synth. A kick makes the bass and pads breathe.
   * @param rate playback speed (a fill's high and low toms)
   */
  public drum(kit: DrumKit, role: DrumRole, time: number, volume: number, rate = 1): void {
    const buffer = this.samples.pick(kit[role]);
    if (!buffer) {
      this.liveDrum(role, time, volume, rate);
      return;
    }
    if (role === 'kick') this.graph.pump(time, volume);
    const cents = (HUMANIZE.CENTS as Record<string, number>)[role] ?? HUMANIZE.CENTS.default;
    this.sample(
      buffer,
      time,
      volume * (SAMPLE_GAIN[role] ?? 1) * (1 + (Math.random() * 2 - 1) * HUMANIZE.VOLUME),
      rate * 2 ** (((Math.random() * 2 - 1) * cents) / 1200),
      this.graph.drums,
    );
  }

  /**
   * A transition, from `time`: a swell is placed so that it ends at `end` (the downbeat it leads
   * into), starting part-way through when there isn't time for all of it. The boom plays with
   * the drums (their saturation and room), the rest straight into the mix.
   * @returns false if it isn't rendered yet
   */
  public transition(id: TransitionSampleId, time: number, volume: number, end?: number): boolean {
    const buffer = this.samples.pick(id);
    if (!buffer) return false;
    const destination = id === 'boom' ? this.graph.drums : this.graph.bus;
    const source = this.ac.createBufferSource();
    const gain = this.ac.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(destination);
    const start = end === undefined ? time : end - buffer.duration;
    if (start >= time) source.start(start);
    else source.start(time, time - start);
    return true;
  }

  /** A drum's extra hit under the drop, if its kit has one. */
  public impact(kit: DrumKit, time: number, volume: number): void {
    const buffer = kit.impact ? this.samples.pick(kit.impact) : null;
    if (buffer) this.sample(buffer, time, volume, 1, this.graph.drums);
  }

  /**
   * A note on a rendered instrument, through a live envelope and filter: the sample gives the
   * timbre, the envelope and filter its length and brightness in the song.
   * @returns false if the instrument isn't rendered yet (play the live synth instead)
   */
  private playNote(
    id: PitchedSampleId,
    midiNote: number,
    time: number,
    duration: number,
    volume: number,
    destination: AudioNode,
    shape: NoteShape,
  ): boolean {
    const note = this.samples.pickNote(id, midiNote);
    if (!note) return false;
    const end = time + duration;
    const peak = volume * (1 + (Math.random() * 2 - 1) * NOTE_HUMANIZE);
    const release = Math.min(shape.release, duration * 0.3);
    const attack = Math.min(shape.attack, duration * 0.5);

    const source = this.ac.createBufferSource();
    source.buffer = note.buffer;
    if (shape.glide) {
      // Slide from the note before, as a synth lead held over legato does
      const from = note.rate * 2 ** ((shape.glide.from - midiNote) / 12);
      source.playbackRate.setValueAtTime(from, time);
      source.playbackRate.exponentialRampToValueAtTime(note.rate, time + shape.glide.time);
    } else {
      source.playbackRate.value = note.rate;
    }
    if (note.loop) {
      source.loop = true;
      source.loopStart = note.loop.start;
      source.loopEnd = note.loop.end;
    }

    const gain = this.ac.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + attack);
    if (shape.sustain !== undefined && shape.decay) {
      const decay = Math.min(shape.decay, duration * 0.5);
      gain.gain.linearRampToValueAtTime(peak * shape.sustain, time + attack + decay);
      gain.gain.setValueAtTime(peak * shape.sustain, end - release);
    } else {
      gain.gain.setValueAtTime(peak, end - release);
    }
    gain.gain.linearRampToValueAtTime(0, end);

    let input: AudioNode = gain;
    if (shape.cutoff) {
      const { from, to, over } = shape.cutoff;
      const filter = this.ac.createBiquadFilter();
      filter.frequency.setValueAtTime(from, time);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(150, to),
        time + Math.min(over, duration),
      );
      filter.connect(gain);
      input = filter;
    }
    source.connect(input);
    gain.connect(destination);

    if (shape.vibrato && duration >= VIBRATO.MIN_DURATION) {
      const lfo = this.ac.createOscillator();
      const depth = this.ac.createGain();
      lfo.frequency.value = VIBRATO.RATE;
      depth.gain.setValueAtTime(0, time);
      depth.gain.setValueAtTime(0, time + VIBRATO.DELAY);
      depth.gain.linearRampToValueAtTime(VIBRATO.DEPTH_CENTS, end);
      lfo.connect(depth);
      depth.connect(source.detune);
      lfo.start(time);
      lfo.stop(end + 0.05);
    }

    source.start(time);
    source.stop(end + 0.05);
    return true;
  }

  /** A bass note: a rendered bass held for its length, or a live oscillator. */
  public bass(
    voice: OscillatorType | BassVoice,
    midiNote: number,
    time: number,
    duration: number,
    volume: number,
    destination: AudioNode,
    filterCutoff: number,
  ): void {
    if (!OSCILLATOR_TYPES.includes(voice)) {
      const bass = voice as BassVoice;
      // The 808 rings out on its own; the others hold, their filter snapping open on the attack
      const shape: NoteShape =
        bass === 'bass808'
          ? { attack: 0.003, release: 0.04 }
          : {
              attack: 0.004,
              release: 0.03,
              cutoff: { from: filterCutoff * 2.2, to: filterCutoff, over: 0.12 },
            };
      if (this.playNote(bass, midiNote, time, duration, volume, destination, shape)) return;
      voice = LIVE_BASS[bass];
    }
    this.note(voice as OscillatorType, midiNote, time, duration, volume, destination, filterCutoff);
  }

  /** An arpeggio note: a rendered blip whose filter closes over its length, or a live one. */
  public arp(
    voice: OscillatorType | ArpVoice,
    midiNote: number,
    time: number,
    duration: number,
    volume: number,
    destination: AudioNode,
    filterCutoff: number,
  ): void {
    if (!OSCILLATOR_TYPES.includes(voice)) {
      const arp = voice as ArpVoice;
      const shape: NoteShape = {
        attack: 0.002,
        release: 0.02,
        cutoff: { from: filterCutoff, to: filterCutoff * 0.2, over: duration },
      };
      if (this.playNote(arp, midiNote, time, duration, volume, destination, shape)) return;
      voice = LIVE_ARP[arp];
    }
    this.note(voice as OscillatorType, midiNote, time, duration, volume, destination, filterCutoff);
  }

  /** A rendered sound at `time`, as loud as `volume`, sped up or slowed by `rate`. */
  public sample(
    buffer: AudioBuffer,
    time: number,
    volume: number,
    rate: number,
    destination: AudioNode,
  ): void {
    const source = this.ac.createBufferSource();
    const gain = this.ac.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(destination);
    source.start(time);
  }

  /** The drums as they were before the samples: what plays until the samples are rendered. */
  private liveDrum(role: DrumRole, time: number, volume: number, rate: number): void {
    switch (role) {
      case 'kick':
        return this.kick(time, volume);
      case 'snare':
        return this.snare(time, volume);
      case 'clap':
        return this.clap(time, volume);
      case 'hat':
        return this.noise(time, 0.05, volume, 7000);
      case 'open':
        return this.noise(time, 0.18, volume, 8000);
      case 'crash':
        return this.noise(time, 1.2, volume, 3000);
      case 'tom':
        return this.tom(rate > 1 ? '1' : rate < 1 ? '3' : '2', time, volume);
      case 'taiko':
        return this.taiko(time, volume);
      default:
      // Metal and percussion have no live synth: silent until rendered
    }
  }

  private get ac(): AudioContext {
    return this.graph.context;
  }

  /** Plucked note: fast attack, decaying level and a closing low-pass. */
  public note(
    type: OscillatorType,
    midiNote: number,
    time: number,
    duration: number,
    volume: number,
    destination: AudioNode,
    filterCutoff: number,
  ): void {
    const osc = this.ac.createOscillator();
    const gain = this.ac.createGain();
    const filter = this.ac.createBiquadFilter();

    osc.type = type;
    osc.frequency.value = midiToFrequency(midiNote);

    filter.frequency.setValueAtTime(filterCutoff, time);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(150, filterCutoff * 0.2),
      time + duration,
    );

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  /** A melody note on one of the lead voices, sent to `destination` (the echo bus). */
  public lead(
    voice: LeadVoice,
    midiNote: number,
    time: number,
    duration: number,
    volume: number,
    destination: AudioNode,
    filterCutoff: number,
    glide?: { from: number; time: number },
  ): void {
    const sampled = SAMPLED_LEADS[voice];
    if (sampled) {
      // A pluck dies away with its filter closing; the sustained leads settle and sing
      const shape: NoteShape =
        voice === 'pluck'
          ? {
              attack: 0.002,
              release: 0.03,
              cutoff: { from: filterCutoff * 1.4, to: filterCutoff * 0.28, over: duration },
            }
          : {
              attack: 0.015,
              sustain: 0.75,
              decay: 0.2,
              release: 0.12,
              cutoff: { from: filterCutoff * 1.6, to: filterCutoff, over: 0.2 },
              vibrato: true,
              glide,
            };
      if (this.playNote(sampled, midiNote, time, duration, volume, destination, shape)) return;
    }
    switch (voice) {
      case 'bell':
        this.bell(midiNote, time, duration, volume, destination);
        return;
      case 'pluck':
        this.note('sawtooth', midiNote, time, duration, volume, destination, filterCutoff * 1.4);
        return;
      case 'koto':
        this.koto(midiNote, time, duration, volume, destination, filterCutoff);
        return;
      case 'flute':
        this.flute(midiNote, time, duration, volume, destination);
        return;
      case 'saw':
      case 'square':
        this.sustainedLead(voice, midiNote, time, duration, volume, destination, filterCutoff);
    }
  }

  /**
   * Sustained lead: two detuned saws (a supersaw) or a square, an envelope that settles to a
   * sustain, a filter that opens on the attack, and vibrato fading in on longer notes.
   */
  private sustainedLead(
    voice: 'saw' | 'square',
    midiNote: number,
    time: number,
    duration: number,
    volume: number,
    destination: AudioNode,
    filterCutoff: number,
  ): void {
    const gain = this.ac.createGain();
    const filter = this.ac.createBiquadFilter();
    const end = time + duration;
    // Short notes squeeze their envelope so each stage still ends before the next begins
    const decay = Math.min(0.2, duration * 0.5);
    const release = Math.min(0.12, duration * 0.3);

    filter.frequency.setValueAtTime(filterCutoff * 1.6, time);
    filter.frequency.exponentialRampToValueAtTime(filterCutoff, time + decay);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.015);
    gain.gain.linearRampToValueAtTime(volume * 0.75, time + decay);
    gain.gain.setValueAtTime(volume * 0.75, end - release);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    filter.connect(gain);
    gain.connect(destination);

    const detunes = voice === 'saw' ? SUPERSAW_DETUNE_CENTS : [0];
    const oscillators = detunes.map((detune) => {
      const osc = this.ac.createOscillator();
      osc.type = voice === 'saw' ? 'sawtooth' : 'square';
      osc.frequency.value = midiToFrequency(midiNote);
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(time);
      osc.stop(end + 0.05);
      return osc;
    });

    if (duration >= VIBRATO.MIN_DURATION) {
      const lfo = this.ac.createOscillator();
      const depth = this.ac.createGain();
      lfo.frequency.value = VIBRATO.RATE;
      depth.gain.setValueAtTime(0, time);
      depth.gain.setValueAtTime(0, time + VIBRATO.DELAY);
      depth.gain.linearRampToValueAtTime(VIBRATO.DEPTH_CENTS, end);
      lfo.connect(depth);
      oscillators.forEach((osc) => depth.connect(osc.detune));
      lfo.start(time);
      lfo.stop(end + 0.05);
    }
  }

  /** Glassy FM bell that rings on past the written note. */
  private bell(
    midiNote: number,
    time: number,
    duration: number,
    volume: number,
    destination: AudioNode,
  ): void {
    const frequency = midiToFrequency(midiNote);
    const ring = Math.max(duration, BELL.MIN_RING);
    const carrier = this.ac.createOscillator();
    const modulator = this.ac.createOscillator();
    const modulation = this.ac.createGain();
    const gain = this.ac.createGain();

    carrier.type = 'sine';
    carrier.frequency.value = frequency;
    modulator.type = 'sine';
    modulator.frequency.value = frequency * BELL.RATIO;

    modulation.gain.setValueAtTime(frequency * BELL.INDEX, time);
    modulation.gain.exponentialRampToValueAtTime(frequency * 0.05, time + BELL.BRIGHTNESS_DECAY);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + ring);

    modulator.connect(modulation);
    modulation.connect(carrier.frequency);
    carrier.connect(gain);
    gain.connect(destination);

    carrier.start(time);
    modulator.start(time);
    carrier.stop(time + ring + 0.05);
    modulator.stop(time + ring + 0.05);
  }

  /** Plucked koto string: a bright snap that bends up into the note and rings past it. */
  private koto(
    midiNote: number,
    time: number,
    duration: number,
    volume: number,
    destination: AudioNode,
    filterCutoff: number,
  ): void {
    const ring = Math.max(KOTO.MIN_RING, duration * KOTO.RING_SHARE);
    const osc = this.ac.createOscillator();
    const filter = this.ac.createBiquadFilter();
    const gain = this.ac.createGain();

    osc.type = 'sawtooth';
    osc.frequency.value = midiToFrequency(midiNote);
    osc.detune.setValueAtTime(KOTO.SNAP_CENTS, time);
    osc.detune.exponentialRampToValueAtTime(-1, time + KOTO.SNAP_TIME);
    osc.detune.linearRampToValueAtTime(0, time + KOTO.SNAP_TIME + 0.01);

    // A resonant peak gives the string its nasal twang as the brightness dies away
    filter.Q.value = 4;
    filter.frequency.setValueAtTime(filterCutoff * 1.8, time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(300, filterCutoff * 0.25), time + ring);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(volume * 0.3, time + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + ring);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    osc.start(time);
    osc.stop(time + ring + 0.05);
  }

  /**
   * Breathy flute: a sine with a touch of its octave, scooping up into the note through a puff
   * of band-passed breath, a wide vibrato swelling on held notes.
   */
  private flute(
    midiNote: number,
    time: number,
    duration: number,
    volume: number,
    destination: AudioNode,
  ): void {
    const frequency = midiToFrequency(midiNote);
    const end = time + duration;
    const attack = Math.min(FLUTE.ATTACK, duration * 0.3);
    const release = Math.min(0.15, duration * 0.3);
    const gain = this.ac.createGain();

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + attack);
    gain.gain.setValueAtTime(volume, end - release);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.connect(destination);

    const oscillators = [
      { type: 'sine' as const, ratio: 1, level: 1 },
      { type: 'triangle' as const, ratio: 2, level: 0.18 },
    ].map(({ type, ratio, level }) => {
      const osc = this.ac.createOscillator();
      const partial = this.ac.createGain();
      osc.type = type;
      osc.frequency.value = frequency * ratio;
      osc.detune.setValueAtTime(FLUTE.SCOOP_CENTS, time);
      osc.detune.linearRampToValueAtTime(0, time + Math.min(FLUTE.SCOOP_TIME, duration * 0.4));
      partial.gain.value = level;
      osc.connect(partial);
      partial.connect(gain);
      osc.start(time);
      osc.stop(end + 0.05);
      return osc;
    });

    if (duration >= VIBRATO.MIN_DURATION) {
      const lfo = this.ac.createOscillator();
      const depth = this.ac.createGain();
      lfo.frequency.value = FLUTE.VIBRATO_RATE;
      depth.gain.setValueAtTime(0, time);
      depth.gain.setValueAtTime(0, time + VIBRATO.DELAY);
      depth.gain.linearRampToValueAtTime(FLUTE.VIBRATO_CENTS, end);
      lfo.connect(depth);
      oscillators.forEach((osc) => depth.connect(osc.detune));
      lfo.start(time);
      lfo.stop(end + 0.05);
    }

    // The breath: noise around the note, loudest on the attack, a whisper under the rest
    const breath = this.ac.createBufferSource();
    const band = this.ac.createBiquadFilter();
    const breathGain = this.ac.createGain();
    breath.buffer = this.graph.noiseBuffer;
    breath.loop = true;
    band.type = 'bandpass';
    band.frequency.value = frequency * 2;
    band.Q.value = 1.5;
    breathGain.gain.setValueAtTime(volume * FLUTE.BREATH, time);
    breathGain.gain.exponentialRampToValueAtTime(volume * FLUTE.BREATH * 0.15, time + attack * 3);
    breathGain.gain.exponentialRampToValueAtTime(0.0001, end);
    breath.connect(band);
    band.connect(breathGain);
    breathGain.connect(destination);
    breath.start(time);
    breath.stop(end + 0.05);
  }

  /**
   * Chord of detuned saws, the two detunings of each note spread left and right. A swell fades
   * in over a quarter of its length; a held pad comes in quickly and sustains.
   */
  public pad(
    chordNotes: number[],
    time: number,
    duration: number,
    volume: number,
    filterCutoff: number,
    swell: boolean,
  ): void {
    const attack = swell ? duration * 0.25 : Math.min(0.08, duration * 0.1);
    // The rendered pad is already wide and detuned: one voice per note
    const shape: NoteShape = {
      attack,
      release: swell ? duration * 0.15 : Math.min(0.3, duration * 0.15),
      cutoff: { from: filterCutoff, to: filterCutoff, over: duration },
    };
    // A pad sample is about twice as loud as one of the live pad's six detuned saws
    const played = chordNotes.map((note) =>
      this.playNote('pad', note, time, duration, volume * 2, this.graph.pads, shape),
    );
    if (played.every(Boolean)) return;

    // One panner per side for the whole chord, not per voice: width costs two nodes
    const sides = PAD_DETUNE_CENTS.map((_, i) => {
      const panner = this.ac.createStereoPanner();
      panner.pan.value = i === 0 ? -PAD_SPREAD : PAD_SPREAD;
      panner.connect(this.graph.pads);
      return panner;
    });

    for (const note of chordNotes) {
      for (const [side, detune] of PAD_DETUNE_CENTS.entries()) {
        const osc = this.ac.createOscillator();
        const gain = this.ac.createGain();
        const filter = this.ac.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.value = midiToFrequency(note);
        osc.detune.value = detune;

        filter.frequency.value = filterCutoff;

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume, time + attack);
        if (!swell) gain.gain.setValueAtTime(volume, time + duration * 0.85);
        gain.gain.linearRampToValueAtTime(0, time + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(sides[side]);

        osc.start(time);
        osc.stop(time + duration + 0.05);
      }
    }
  }

  /** Short brassy chord hit: saws through one filter snapping shut. */
  public stab(chordNotes: number[], time: number, duration: number, volume: number): void {
    const shape: NoteShape = { attack: 0.005, release: Math.min(0.06, duration * 0.3) };
    const played = chordNotes.map((note) =>
      this.playNote('brass', note + 12, time, duration, volume, this.graph.pads, shape),
    );
    if (played.every(Boolean)) return;

    const gain = this.ac.createGain();
    const filter = this.ac.createBiquadFilter();

    filter.frequency.setValueAtTime(3500, time);
    filter.frequency.exponentialRampToValueAtTime(500, time + duration);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    filter.connect(gain);
    gain.connect(this.graph.pads);

    for (const note of chordNotes) {
      const osc = this.ac.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = midiToFrequency(note + 12);
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + duration + 0.05);
    }
  }

  /** Pitch-dropping sine kick; the bass and pads breathe under it. */
  public kick(time: number, volume: number): void {
    this.graph.pump(time, volume);
    const osc = this.ac.createOscillator();
    const gain = this.ac.createGain();

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

    osc.connect(gain);
    gain.connect(this.graph.drums);

    osc.start(time);
    osc.stop(time + 0.3);
  }

  /** Snare: a noise burst with a short tonal body underneath. */
  public snare(time: number, volume: number): void {
    this.noise(time, 0.22, volume, 1200);

    const body = this.ac.createOscillator();
    const gain = this.ac.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(220, time);
    body.frequency.exponentialRampToValueAtTime(160, time + 0.08);
    gain.gain.setValueAtTime(volume * 0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    body.connect(gain);
    gain.connect(this.graph.drums);
    body.start(time);
    body.stop(time + 0.12);
  }

  /** Hand clap: three quick band-passed noise bursts and a short tail. */
  public clap(time: number, volume: number): void {
    const source = this.ac.createBufferSource();
    const filter = this.ac.createBiquadFilter();
    const gain = this.ac.createGain();

    source.buffer = this.graph.noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    filter.Q.value = 0.8;

    for (let i = 0; i < 3; i++) {
      const at = time + i * 0.011;
      gain.gain.setValueAtTime(volume, at);
      gain.gain.exponentialRampToValueAtTime(volume * 0.2, at + 0.009);
    }
    gain.gain.setValueAtTime(volume * 0.8, time + 0.033);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.graph.drums);
    source.start(time);
    source.stop(time + 0.22);
  }

  /** Tom for fills: '1' high, '2' mid, '3' low. */
  public tom(pitch: string, time: number, volume: number): void {
    const frequency = TOM_PITCHES[pitch] ?? TOM_PITCHES['2'];
    const osc = this.ac.createOscillator();
    const gain = this.ac.createGain();

    osc.frequency.setValueAtTime(frequency, time);
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.55, time + 0.25);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.32);

    osc.connect(gain);
    gain.connect(this.graph.drums);
    osc.start(time);
    osc.stop(time + 0.35);
  }

  /** Taiko: a deep, slowly dropping drum body under the slap of the stick on its skin. */
  public taiko(time: number, volume: number): void {
    const osc = this.ac.createOscillator();
    const gain = this.ac.createGain();

    osc.frequency.setValueAtTime(TAIKO_PITCH * 1.4, time);
    osc.frequency.exponentialRampToValueAtTime(TAIKO_PITCH, time + 0.06);
    osc.frequency.exponentialRampToValueAtTime(TAIKO_PITCH * 0.8, time + 0.6);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.65);

    osc.connect(gain);
    gain.connect(this.graph.drums);
    osc.start(time);
    osc.stop(time + 0.7);

    this.noise(time, 0.04, volume * 0.35, 1800);
  }

  /** Noise swept up through a band-pass, swelling until `time + duration`. */
  public riser(time: number, duration: number, volume: number): void {
    const source = this.ac.createBufferSource();
    const filter = this.ac.createBiquadFilter();
    const gain = this.ac.createGain();
    const end = time + duration;

    source.buffer = this.graph.noiseBuffer;
    source.loop = true;
    filter.type = 'bandpass';
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(400, time);
    filter.frequency.exponentialRampToValueAtTime(7000, end);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, end - 0.02);
    gain.gain.linearRampToValueAtTime(0, end);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.graph.bus);
    source.start(time);
    source.stop(end + 0.02);
  }

  /** High-passed noise burst: hi-hat or crash depending on length and cutoff. */
  public noise(time: number, duration: number, volume: number, highpassFrequency: number): void {
    const source = this.ac.createBufferSource();
    const gain = this.ac.createGain();
    const filter = this.ac.createBiquadFilter();

    source.buffer = this.graph.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.value = highpassFrequency;

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.graph.drums);

    source.start(time);
    source.stop(time + duration + 0.02);
  }
}
