import { describe, expect, it } from 'vitest';
import { clamp, lerp, midiToFrequency, mixHexColors, randomRange } from '@/utils/math';

describe('Math utilities', () => {
  describe('mixHexColors', () => {
    it('returns the endpoints at t = 0 and t = 1', () => {
      expect(mixHexColors('#000000', '#ffffff', 0)).toBe('rgb(0, 0, 0)');
      expect(mixHexColors('#000000', '#ffffff', 1)).toBe('rgb(255, 255, 255)');
    });

    it('blends each channel and clamps t', () => {
      expect(mixHexColors('#ff0000', '#0000ff', 0.5)).toBe('rgb(128, 0, 128)');
      expect(mixHexColors('#ff0000', '#0000ff', 2)).toBe('rgb(0, 0, 255)');
    });
  });

  describe('clamp', () => {
    it('returns value when inside range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('clamps to min when value is below', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('clamps to max when value is above', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('lerp', () => {
    it('interpolates correctly at t = 0, 0.5, 1', () => {
      expect(lerp(10, 20, 0)).toBe(10);
      expect(lerp(10, 20, 0.5)).toBe(15);
      expect(lerp(10, 20, 1)).toBe(20);
    });
  });

  describe('midiToFrequency', () => {
    it('converts MIDI note 69 to 440 Hz (A4)', () => {
      expect(midiToFrequency(69)).toBeCloseTo(440, 2);
    });

    it('converts MIDI note 57 to 220 Hz (A3)', () => {
      expect(midiToFrequency(57)).toBeCloseTo(220, 2);
    });

    it('converts MIDI note 81 to 880 Hz (A5)', () => {
      expect(midiToFrequency(81)).toBeCloseTo(880, 2);
    });
  });

  describe('randomRange', () => {
    it('produces value within [min, max)', () => {
      for (let i = 0; i < 50; i++) {
        const val = randomRange(5, 10);
        expect(val).toBeGreaterThanOrEqual(5);
        expect(val).toBeLessThan(10);
      }
    });
  });
});
