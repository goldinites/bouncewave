import { describe, expect, it } from 'vitest';
import { getTargetBpm, glideTempo, TEMPO } from '@/audio/music/tempo';

/** Plays `seconds` of 16th-note steps, gliding toward a fixed target; returns the tempo. */
const play = (from: number, target: number, seconds: number): number => {
  let bpm = from;
  for (let t = 0; t < seconds;) {
    const step = 60 / bpm / 4;
    bpm = glideTempo(bpm, target, step);
    t += step;
  }
  return bpm;
};

describe('tempo', () => {
  it('plays faster as intensity rises', () => {
    expect(getTargetBpm(100, 0)).toBe(100);
    expect(getTargetBpm(100, 1)).toBe(100 + TEMPO.INTENSITY_BPM);
  });

  it('closes about 63% of the gap in one time constant, either way', () => {
    expect(play(100, 108, TEMPO.RISE_TIME)).toBeCloseTo(100 + 8 * 0.632, 0);
    expect(play(108, 100, TEMPO.FALL_TIME)).toBeCloseTo(108 - 8 * 0.632, 0);
  });

  it('slows down more gently than it speeds up', () => {
    const risen = play(100, 108, 1) - 100;
    const fallen = 108 - play(108, 100, 1);
    expect(fallen).toBeLessThan(risen / 2);
  });

  it('glides across the slowest song change instead of jumping', () => {
    // The track list wraps from 116 BPM back to 92
    expect(play(116, 92, 0.5)).toBeGreaterThan(114);
    expect(play(116, 92, 20)).toBeLessThan(93);
  });

  it('settles on the target', () => {
    expect(play(100, 108, 15)).toBeCloseTo(108, 1);
  });
});
