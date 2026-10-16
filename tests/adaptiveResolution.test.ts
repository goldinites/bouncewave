import { describe, expect, it } from 'vitest';
import { AdaptiveResolution } from '@/render/AdaptiveResolution';

/**
 * Feeds `ms` worth of frames; `frameMs` is a fixed frame time or a device model giving the frame
 * time at the current pixel ratio. Returns how many times the ratio changed.
 */
const run = (
  resolution: AdaptiveResolution,
  frameMs: number | ((ratio: number) => number),
  ms: number,
): number => {
  let changes = 0;
  for (let t = 0; t < ms;) {
    const frame = typeof frameMs === 'number' ? frameMs : frameMs(resolution.pixelRatio);
    if (resolution.tick(frame)) changes++;
    t += frame;
  }
  return changes;
};

const WARMUP = 2000;

describe('AdaptiveResolution', () => {
  it('starts at the sharpest ratio and goes down in steps to the floor', () => {
    const resolution = new AdaptiveResolution(2, 0.75);
    expect(resolution.pixelRatio).toBe(2);

    // Frame time follows the pixel count, but stays slow even at the floor
    const ratios = [resolution.pixelRatio];
    for (let i = 0; i < 20; i++) {
      run(resolution, (ratio) => 40 * ratio * ratio, 1000);
      if (resolution.pixelRatio !== ratios[ratios.length - 1]) ratios.push(resolution.pixelRatio);
    }

    expect(ratios[ratios.length - 1]).toBe(0.75);
    for (let i = 1; i < ratios.length; i++) {
      expect(ratios[i]).toBeLessThan(ratios[i - 1]);
    }
  });

  it('keeps a display with no headroom to adapt at a fixed ratio', () => {
    const resolution = new AdaptiveResolution(0.75, 0.75);
    expect(run(resolution, 40, 10000)).toBe(0);
    expect(resolution.pixelRatio).toBe(0.75);
  });

  it('ignores slow frames during the warm-up and long hitches', () => {
    const resolution = new AdaptiveResolution(2);
    expect(run(resolution, 40, WARMUP - 100)).toBe(0);
    expect(resolution.tick(500)).toBe(false);
    expect(resolution.pixelRatio).toBe(2);
  });

  it('does nothing while frames are fast', () => {
    const resolution = new AdaptiveResolution(2);
    expect(run(resolution, 16.7, 20000)).toBe(0);
    expect(resolution.pixelRatio).toBe(2);
  });

  it('undoes a step down that did not make frames faster (e.g. a 30 fps cap)', () => {
    const resolution = new AdaptiveResolution(2);
    run(resolution, 33.3, WARMUP + 1000);
    expect(resolution.pixelRatio).toBeLessThan(2);

    run(resolution, 33.3, 1000);
    expect(resolution.pixelRatio).toBe(2);

    // And stays put for a while instead of trying again at once
    expect(run(resolution, 33.3, 10000)).toBe(0);
  });

  it('steps back up after frames have been fast for a while', () => {
    const resolution = new AdaptiveResolution(2);
    run(resolution, 30, WARMUP + 1000);
    const lowered = resolution.pixelRatio;
    expect(lowered).toBeLessThan(2);

    run(resolution, 16, 5000);
    expect(resolution.pixelRatio).toBe(lowered);

    run(resolution, 16, 5000);
    expect(resolution.pixelRatio).toBe(2);
  });

  it('does not retry a ratio that was too slow right after stepping up to it', () => {
    // Too slow at the sharpest ratio, comfortable one step down
    const device = (ratio: number) => (ratio > 1.8 ? 24 : 16);
    const resolution = new AdaptiveResolution(2);

    // Down, back up after a calm spell, down again for good
    expect(run(resolution, device, 60000)).toBe(3);
    expect(resolution.pixelRatio).toBeCloseTo(1.6);
  });
});
