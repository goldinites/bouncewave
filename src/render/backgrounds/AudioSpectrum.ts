import { clamp } from '@/shared/math';

const FREQUENCY_BINS = 128;
const WAVEFORM_SAMPLES = 256;
// Bass pulse: average of the lowest bins, gated so only real kicks register
const BASS_BINS = [1, 2, 3];
const BASS_GATE = 0.35;
const BASS_GAIN = 2.2;
// Screen shake also reads as a pulse, so hits thump the background even when quiet
const SHAKE_FOR_FULL_PULSE = 12;

/** One frame of the music analyser, read once and shared by every background. */
export class AudioSpectrum {
  private readonly frequencyData = new Uint8Array(FREQUENCY_BINS);
  private readonly waveformData = new Uint8Array(WAVEFORM_SAMPLES);

  public update(analyser: AnalyserNode | null): void {
    if (analyser) {
      analyser.getByteFrequencyData(this.frequencyData);
      analyser.getByteTimeDomainData(this.waveformData);
    } else {
      this.frequencyData.fill(0);
      this.waveformData.fill(128);
    }
  }

  /**
   * Beat strength in [0, 1]: the music's own beat, as its kicks sound, when it is given; else
   * read off the bass; or from screen shake, if that is stronger.
   */
  public getPulse(shake: number, beat: number | null = null): number {
    const bassSum = BASS_BINS.reduce((sum, bin) => sum + this.frequencyData[bin], 0);
    const bassAvg = bassSum / (255 * BASS_BINS.length);
    const pulseFromAudio = beat ?? clamp((bassAvg - BASS_GATE) * BASS_GAIN, 0, 1);
    const pulseFromShake = clamp(shake / SHAKE_FOR_FULL_PULSE, 0, 1);
    return Math.max(pulseFromAudio, pulseFromShake);
  }

  /**
   * Level in [0, 1] of the `index`-th of `total` analyzer bars, spread logarithmically.
   * A slow synthetic wobble keeps the bars alive when the music is silent.
   */
  public getBarLevel(index: number, total: number, time: number): number {
    const bucket = 1 + Math.floor(Math.pow(index / total, 1.5) * 80);
    const maxFreqVal = Math.max(this.frequencyData[bucket], this.frequencyData[bucket + 1]);
    const normalized = (maxFreqVal / 255) * (0.9 + (index / total) * 0.9);
    const syntheticLfo = 0.1 + 0.08 * Math.sin(time * 2.2 + index * 0.6);
    return Math.min(1, Math.max(normalized, syntheticLfo));
  }

  /** Waveform sample in [-1, 1]. */
  public getWaveform(sample: number): number {
    return (this.waveformData[sample] - 128) / 128;
  }
}
