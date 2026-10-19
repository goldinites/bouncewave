import { describe, expect, it } from 'vitest';
import { AiForm, skillAt } from '@/match/AiForm';
import { WINNING_SCORE } from '@/match/config';
import { DIFFICULTY_CONFIGS, DIFFICULTY_LEVELS, DifficultyLevel } from '@/match/difficulty';

const { EASY, NORMAL, INSANE } = DifficultyLevel;

/** Plays serves at a fixed score until the form settles. */
const settle = (form: AiForm, scores: [number, number], adaptivity: number) => {
  for (let i = 0; i < 20; i++) form.update(scores, adaptivity);
  return form.shift;
};

describe('skillAt', () => {
  it('matches each level exactly at its rank', () => {
    DIFFICULTY_LEVELS.forEach((level, rank) => {
      const config = DIFFICULTY_CONFIGS[level];
      expect(skillAt(rank)).toEqual({
        speed: config.speed,
        reaction: config.reaction,
        error: config.error,
        errorPerBounce: config.errorPerBounce,
        angleShots: config.angleShots,
        nerves: config.nerves,
      });
    });
  });

  it('blends the neighbouring levels in between', () => {
    const easy = DIFFICULTY_CONFIGS[EASY];
    const normal = DIFFICULTY_CONFIGS[NORMAL];
    const between = skillAt(0.25); // Easy is the easiest level, Normal the next

    expect(between.speed).toBeCloseTo(easy.speed + (normal.speed - easy.speed) * 0.25);
    expect(between.error).toBeCloseTo(easy.error + (normal.error - easy.error) * 0.25);
  });

  it('keeps getting weaker below the easiest level, down to a floor, and stops at the hardest', () => {
    const easy = DIFFICULTY_CONFIGS[EASY];
    const belowEasy = skillAt(-0.5);
    expect(belowEasy.speed).toBeLessThan(easy.speed);
    expect(belowEasy.error).toBeGreaterThan(easy.error);
    expect(belowEasy.reaction).toBeGreaterThan(easy.reaction);
    expect(belowEasy.angleShots).toBe(0);

    expect(skillAt(-10)).toEqual(skillAt(-1));
    expect(skillAt(10)).toEqual(skillAt(DIFFICULTY_LEVELS.indexOf(INSANE)));
  });
});

describe('AiForm', () => {
  it('eases off while the CPU leads and tightens up while it trails, within its adaptivity', () => {
    expect(settle(new AiForm(), [1, 6], 0.4)).toBeCloseTo(-0.4);
    expect(settle(new AiForm(), [6, 1], 0.4)).toBeCloseTo(0.4);
    expect(settle(new AiForm(), [3, 3], 0.4)).toBeCloseTo(0);

    // A narrow lead moves it only part of the way
    const narrow = settle(new AiForm(), [3, 4], 0.4);
    expect(narrow).toBeLessThan(0);
    expect(narrow).toBeGreaterThan(-0.4);
  });

  it('never adapts on a level without adaptivity', () => {
    expect(settle(new AiForm(), [0, 8], DIFFICULTY_CONFIGS[INSANE].adaptivity)).toBe(0);
  });

  it('drifts toward its new form over a few serves instead of jumping', () => {
    const form = new AiForm();
    form.update([0, 8], 0.4);
    expect(form.shift).toBeCloseTo(-0.2);
    form.update([0, 8], 0.4);
    expect(form.shift).toBeCloseTo(-0.3);
  });

  it('feels a streak on top of the score', () => {
    const withStreak = new AiForm();
    const without = new AiForm();
    for (let i = 0; i < 3; i++) withStreak.onPoint(1);

    expect(settle(withStreak, [2, 3], 0.4)).toBeLessThan(settle(without, [2, 3], 0.4));
  });

  it('is frozen on the deciding point', () => {
    const form = new AiForm();
    settle(form, [4, 8], 0.4);
    const before = form.shift;

    form.update([WINNING_SCORE - 1, WINNING_SCORE - 1], 0.4, true);
    expect(form.shift).toBe(before);
  });

  it('forgets everything on reset', () => {
    const form = new AiForm();
    form.onPoint(1);
    settle(form, [0, 8], 0.4);
    form.reset();

    expect(form.shift).toBe(0);
    expect(form.skillFor(NORMAL)).toEqual(skillAt(DIFFICULTY_LEVELS.indexOf(NORMAL)));
  });
});
