import { MusicGraph } from '@/audio/music/MusicGraph';
import { midiToFrequency } from '@/shared/math';

const PAD_DETUNE_CENTS = [-9, 9];

/** One-shot synth voices, each scheduled at an exact audio-clock time. */
export class Instruments {
  private readonly graph: MusicGraph;

  constructor(graph: MusicGraph) {
    this.graph = graph;
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

  /** Slow-swelling chord of detuned saws on the dry bus. */
  public pad(
    chordNotes: number[],
    time: number,
    duration: number,
    volume: number,
    filterCutoff: number,
  ): void {
    for (const note of chordNotes) {
      for (const detune of PAD_DETUNE_CENTS) {
        const osc = this.ac.createOscillator();
        const gain = this.ac.createGain();
        const filter = this.ac.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.value = midiToFrequency(note);
        osc.detune.value = detune;

        filter.frequency.value = filterCutoff;

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume, time + duration * 0.25);
        gain.gain.linearRampToValueAtTime(0, time + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.graph.bus);

        osc.start(time);
        osc.stop(time + duration + 0.05);
      }
    }
  }

  /** Pitch-dropping sine kick on the dry bus. */
  public kick(time: number, volume: number): void {
    const osc = this.ac.createOscillator();
    const gain = this.ac.createGain();

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

    osc.connect(gain);
    gain.connect(this.graph.bus);

    osc.start(time);
    osc.stop(time + 0.3);
  }

  /** High-passed noise burst: snare, hi-hat or crash depending on length and cutoff. */
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
    gain.connect(this.graph.bus);

    source.start(time);
    source.stop(time + duration + 0.02);
  }
}
