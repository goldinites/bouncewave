import { describe, expect, it } from 'vitest';
import { CLIMAX_RALLY } from '@/constants/game.constants';
import { RallyClimax } from '@/core/RallyClimax';

describe('RallyClimax', () => {
  it('stays off below full heat', () => {
    const climax = new RallyClimax();

    expect(climax.update(0.016, true, CLIMAX_RALLY - 1, 0)).toBe(false);
    expect(climax.isActive).toBe(false);
    expect(climax.level).toBe(0);
  });

  it('reports the start exactly once and ramps up', () => {
    const climax = new RallyClimax();

    expect(climax.update(0.016, true, CLIMAX_RALLY, 0)).toBe(true);
    expect(climax.update(0.016, true, CLIMAX_RALLY + 1, 0)).toBe(false);
    expect(climax.isActive).toBe(true);

    for (let i = 0; i < 120; i++) climax.update(0.016, true, CLIMAX_RALLY + 1, 0);
    expect(climax.level).toBeGreaterThan(0.95);
  });

  it('ends when the rally resets and can trigger again next rally', () => {
    const climax = new RallyClimax();
    climax.update(0.016, true, CLIMAX_RALLY, 0);

    climax.update(0.016, true, 0, 1.2); // point scored, next serve pending
    expect(climax.isActive).toBe(false);

    expect(climax.update(0.016, true, CLIMAX_RALLY, 0)).toBe(true);
  });

  it('never triggers in demo or menu', () => {
    const climax = new RallyClimax();

    expect(climax.update(0.016, false, CLIMAX_RALLY + 10, 0)).toBe(false);
    expect(climax.isActive).toBe(false);
  });

  it('reset drops it immediately', () => {
    const climax = new RallyClimax();
    for (let i = 0; i < 60; i++) climax.update(0.016, true, CLIMAX_RALLY, 0);

    climax.reset();
    expect(climax.isActive).toBe(false);
    expect(climax.level).toBe(0);
  });
});
