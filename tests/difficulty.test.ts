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
      DifficultyLevel.NORMAL,
      DifficultyLevel.HARD,
      DifficultyLevel.INSANE,
    ]);
    expect(Object.keys(DIFFICULTY_CONFIGS)).toHaveLength(DIFFICULTY_LEVELS.length);
  });

  it('cycles up through the levels and wraps around', () => {
    expect(nextDifficulty(DifficultyLevel.NORMAL)).toBe(DifficultyLevel.HARD);
    expect(nextDifficulty(DifficultyLevel.INSANE)).toBe(DifficultyLevel.NORMAL);
  });

  it('recognises only real levels', () => {
    expect(isDifficultyLevel(DifficultyLevel.HARD)).toBe(true);
    expect(isDifficultyLevel(4)).toBe(false);
    expect(isDifficultyLevel(0)).toBe(false); // the removed Easy level
    expect(isDifficultyLevel(1.5)).toBe(false);
    expect(isDifficultyLevel('1')).toBe(false);
  });
});
