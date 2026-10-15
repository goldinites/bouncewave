import { describe, expect, it } from 'vitest';
import { BALL } from '@/match/config';
import { getRallyHeat, getSpeedHeat, RALLY_HEAT_MAX } from '@/match/heat';

describe('heat', () => {
  it('rally heat grows linearly and caps at full', () => {
    expect(getRallyHeat(0)).toBe(0);
    expect(getRallyHeat(RALLY_HEAT_MAX / 2)).toBeCloseTo(0.5);
    expect(getRallyHeat(RALLY_HEAT_MAX)).toBe(1);
    expect(getRallyHeat(RALLY_HEAT_MAX * 3)).toBe(1);
  });

  it('speed heat runs from serve speed to the top speed', () => {
    const max = BALL.INITIAL_SPEED + 400;

    expect(getSpeedHeat(BALL.INITIAL_SPEED, max)).toBe(0);
    expect(getSpeedHeat(BALL.INITIAL_SPEED + 200, max)).toBeCloseTo(0.5);
    expect(getSpeedHeat(max * 2, max)).toBe(1);
    expect(getSpeedHeat(0, max)).toBe(0);
  });
});
