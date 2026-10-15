import { describe, expect, it } from 'vitest';
import { AudioSpectrum } from '@/render/backgrounds/AudioSpectrum';

/** Minimal analyser stand-in that fills every frequency bin and waveform sample. */
const fakeAnalyser = (level: number, waveform = 128) =>
  ({
    getByteFrequencyData: (data: Uint8Array) => data.fill(level),
    getByteTimeDomainData: (data: Uint8Array) => data.fill(waveform),
  }) as unknown as AnalyserNode;

describe('AudioSpectrum', () => {
  it('reports no pulse in silence and a full pulse on a loud bass', () => {
    const spectrum = new AudioSpectrum();

    spectrum.update(fakeAnalyser(0));
    expect(spectrum.getPulse(0)).toBe(0);

    spectrum.update(fakeAnalyser(255));
    expect(spectrum.getPulse(0)).toBe(1);
  });

  it('gates quiet bass so only real beats register', () => {
    const spectrum = new AudioSpectrum();
    spectrum.update(fakeAnalyser(80)); // ~0.31 of full scale, below the gate

    expect(spectrum.getPulse(0)).toBe(0);
  });

  it('lets screen shake stand in for a beat', () => {
    const spectrum = new AudioSpectrum();
    spectrum.update(null);

    expect(spectrum.getPulse(6)).toBeCloseTo(0.5);
  });

  it('keeps bars gently alive without music and reads the waveform', () => {
    const spectrum = new AudioSpectrum();
    spectrum.update(null);

    const level = spectrum.getBarLevel(5, 32, 1);
    expect(level).toBeGreaterThan(0);
    expect(level).toBeLessThan(0.2);
    expect(spectrum.getWaveform(0)).toBe(0);

    spectrum.update(fakeAnalyser(0, 255));
    expect(spectrum.getWaveform(10)).toBeCloseTo(1, 1);
  });
});
