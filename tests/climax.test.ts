import { describe, expect, it } from 'vitest';
import { CLIMAX_RALLY } from '@/constants/game.constants';
import { CLIMAX_FALL_TIME, CLIMAX_RISE_TIME } from '@/constants/visual.constants';
import { RallyClimax } from '@/core/RallyClimax';

const STEP = 0.016;

/** Runs the climax for `seconds`, returning how many frames reported a peak. */
const run = (climax: RallyClimax, seconds: number, rally: number, isMatchActive = true) => {
  let peaks = 0;
  for (let t = 0; t < seconds; t += STEP) {
    if (climax.update(STEP, isMatchActive, rally, 0)) peaks++;
  }
  return peaks;
};

describe('RallyClimax', () => {
  it('stays off below full heat', () => {
    const climax = new RallyClimax();
    run(climax, 1, CLIMAX_RALLY - 1);

    expect(climax.isActive).toBe(false);
    expect(climax.level).toBe(0);
  });

  it('builds up slowly instead of jumping', () => {
    const climax = new RallyClimax();

    run(climax, 1, CLIMAX_RALLY);
    expect(climax.isActive).toBe(true);
    expect(climax.level).toBeLessThan(0.15);

    run(climax, CLIMAX_RISE_TIME / 2 - 1, CLIMAX_RALLY);
    expect(climax.level).toBeGreaterThan(0.35);
    expect(climax.level).toBeLessThan(0.65);
  });

  it('reports the peak exactly once, at the end of the build-up', () => {
    const climax = new RallyClimax();

    expect(run(climax, CLIMAX_RISE_TIME * 0.95, CLIMAX_RALLY)).toBe(0);
    expect(run(climax, CLIMAX_RISE_TIME, CLIMAX_RALLY)).toBe(1);
    expect(climax.level).toBe(1);
  });

  it('cools down gradually after the point ends, then can peak again', () => {
    const climax = new RallyClimax();
    run(climax, CLIMAX_RISE_TIME + 0.1, CLIMAX_RALLY);

    run(climax, CLIMAX_FALL_TIME / 2, 0);
    expect(climax.isActive).toBe(false);
    expect(climax.level).toBeGreaterThan(0.2);
    expect(climax.level).toBeLessThan(0.8);

    run(climax, CLIMAX_FALL_TIME, 0);
    expect(climax.level).toBe(0);

    expect(run(climax, CLIMAX_RISE_TIME + 0.1, CLIMAX_RALLY)).toBe(1);
  });

  it('never builds in demo or menu', () => {
    const climax = new RallyClimax();
    const peaks = run(climax, CLIMAX_RISE_TIME + 1, CLIMAX_RALLY + 10, false);

    expect(peaks).toBe(0);
    expect(climax.level).toBe(0);
  });

  it('reset drops it immediately', () => {
    const climax = new RallyClimax();
    run(climax, 3, CLIMAX_RALLY);

    climax.reset();
    expect(climax.isActive).toBe(false);
    expect(climax.level).toBe(0);
  });
});
