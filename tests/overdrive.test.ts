import { describe, expect, it } from 'vitest';
import { OVERDRIVE, Overdrive } from '@/match/Overdrive';

const hits = (overdrive: Overdrive, perfect: boolean[]) => perfect.map((p) => overdrive.onHit(p));

describe('Overdrive', () => {
  it('charges with perfect hits in a row and fires on the next hit, perfect or not', () => {
    const overdrive = new Overdrive();
    const perfects = Array<boolean>(OVERDRIVE.CHARGE).fill(true);

    expect(hits(overdrive, perfects)).toEqual(perfects.map(() => false));
    expect(overdrive.isCharged).toBe(true);
    expect(overdrive.charge).toBe(OVERDRIVE.CHARGE);

    expect(overdrive.onHit(false)).toBe(true);
    expect(overdrive.charge).toBe(0);
  });

  it('empties on any ordinary hit before it is full', () => {
    const overdrive = new Overdrive();
    hits(overdrive, [true, true, false]);
    expect(overdrive.charge).toBe(0);

    hits(overdrive, [true]);
    expect(overdrive.charge).toBe(1);
  });

  it('starts over on reset', () => {
    const overdrive = new Overdrive();
    hits(overdrive, [true, true, true]);
    overdrive.reset();
    expect(overdrive.charge).toBe(0);
    expect(overdrive.isCharged).toBe(false);
  });
});
