import { describe, expect, it } from 'vitest';
import { DIFFICULTY_LEVELS, DifficultyLevel } from '@/match/difficulty';
import { quickMatchRules } from '@/match/modes';
import { playerPointShare, simulateMany } from './helpers/simulation';

// AI against AI, seeded: the balance's floor, checked on every change. The numbers themselves are
// for the report (npm run sim); these only catch what would be plainly broken
const QUICK = quickMatchRules(5);

describe('the balance, AI against AI', () => {
  it('plays every level out: a quick match always ends, on points', () => {
    for (const level of DIFFICULTY_LEVELS) {
      for (const report of simulateMany({ rules: QUICK, difficulty: level, player: level }, 6)) {
        expect(report.reason, `level ${level}`).toBe('points');
      }
    }
  });

  it('gives neither side of the court an edge', () => {
    // Equals, Overdrive for neither: the right side is the CPU, the left the AI in the player's seat
    const share = playerPointShare(
      simulateMany(
        {
          rules: QUICK,
          difficulty: DifficultyLevel.NORMAL,
          player: DifficultyLevel.NORMAL,
          playerOverdrive: false,
        },
        40,
      ),
    );
    expect(share).toBeGreaterThan(0.42);
    expect(share).toBeLessThan(0.58);
  });

  it('lets a stronger player win more points against the same CPU', () => {
    const shareOf = (player: DifficultyLevel) =>
      playerPointShare(
        simulateMany({ rules: QUICK, difficulty: DifficultyLevel.NORMAL, player }, 30),
      );
    const easy = shareOf(DifficultyLevel.EASY);
    const normal = shareOf(DifficultyLevel.NORMAL);
    const insane = shareOf(DifficultyLevel.INSANE);
    expect(easy).toBeLessThan(normal - 0.08);
    expect(normal).toBeLessThan(insane - 0.15);
  });
});
