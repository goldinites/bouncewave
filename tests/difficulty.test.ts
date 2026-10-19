import { describe, expect, it } from 'vitest';
import {
  DIFFICULTY_CONFIGS,
  DIFFICULTY_LEVELS,
  DifficultyLevel,
  isDifficultyLevel,
  nextDifficulty,
} from '@/match/difficulty';

describe('difficulty levels', () => {
  it('lists every configured level, easiest first', () => {
    expect(DIFFICULTY_LEVELS).toEqual([
      DifficultyLevel.EASY,
      DifficultyLevel.NORMAL,
      DifficultyLevel.HARD,
      DifficultyLevel.INSANE,
    ]);
    expect(Object.keys(DIFFICULTY_CONFIGS)).toHaveLength(DIFFICULTY_LEVELS.length);
  });

  it('cycles up through the levels and wraps around', () => {
    expect(nextDifficulty(DifficultyLevel.EASY)).toBe(DifficultyLevel.NORMAL);
    expect(nextDifficulty(DifficultyLevel.INSANE)).toBe(DifficultyLevel.EASY);
  });

  it('keeps the old levels’ play a step down, with a harder Insane on top', () => {
    const { EASY, NORMAL, HARD, INSANE } = DifficultyLevel;
    expect(DIFFICULTY_CONFIGS[EASY]).toMatchObject({ speed: 440, maxSpeed: 840 });
    expect(DIFFICULTY_CONFIGS[NORMAL]).toMatchObject({ speed: 560, maxSpeed: 920 });
    expect(DIFFICULTY_CONFIGS[HARD]).toMatchObject({ speed: 640, maxSpeed: 1000 });

    const hard = DIFFICULTY_CONFIGS[HARD];
    const insane = DIFFICULTY_CONFIGS[INSANE];
    expect(insane.speed).toBeGreaterThan(hard.speed);
    expect(insane.reaction).toBeLessThan(hard.reaction);
    expect(insane.error).toBeLessThan(hard.error);
    expect(insane.errorPerBounce).toBeLessThan(hard.errorPerBounce);
    expect(insane.acceleration).toBeGreaterThan(hard.acceleration);
    expect(insane.maxSpeed).toBeGreaterThan(hard.maxSpeed);
  });

  it('recognises only real levels', () => {
    expect(isDifficultyLevel(DifficultyLevel.HARD)).toBe(true);
    expect(isDifficultyLevel(5)).toBe(false);
    expect(isDifficultyLevel(0)).toBe(false); // the Easy level of 1.1, removed
    expect(isDifficultyLevel(1.5)).toBe(false);
    expect(isDifficultyLevel('1')).toBe(false);
  });
});
