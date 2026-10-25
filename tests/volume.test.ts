import { describe, expect, it } from 'vitest';
import { gainToDb } from '@/audio/curves';
import { isVolume, stepVolume, VOLUME, volumeGain, VOLUMES } from '@/shared/volume';

describe('volumes', () => {
  it('step by tens from silence to the full mix', () => {
    expect(VOLUMES).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(isVolume(50)).toBe(true);
    expect(isVolume(55)).toBe(false);
    expect(isVolume('50')).toBe(false);
  });

  it('sound even steps apart: the same decibels each, silence at none', () => {
    expect(volumeGain(100)).toBe(1);
    expect(volumeGain(0)).toBe(0);
    for (const volume of VOLUMES.slice(1, -1)) {
      expect(gainToDb(volumeGain(volume)) - gainToDb(volumeGain(volume + 10))).toBeCloseTo(
        -VOLUME.STEP_DB,
      );
    }
    expect(gainToDb(volumeGain(10))).toBeCloseTo(-27);
  });

  it('hold at either end', () => {
    expect(stepVolume(100, 1)).toBe(100);
    expect(stepVolume(0, -1)).toBe(0);
    expect(stepVolume(40, 1)).toBe(50);
  });
});
