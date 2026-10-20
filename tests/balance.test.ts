import { describe, expect, it } from 'vitest';
import { DIFFICULTY_LEVELS, DifficultyLevel } from '@/match/difficulty';
import { quickMatchRules } from '@/match/modes';
import { PlayerId, playerPointShare, simulateMany } from './helpers/simulation';

// AI against AI, seeded: the balance's floor, checked on every change. The numbers themselves are
// for the report (npm run sim); these only catch what would be plainly broken
const QUICK = quickMatchRules(5);
// Each check plays some hundred matches, a few seconds on a fast machine: room for a slow one (CI,
// or a machine busy with something else), past vitest's 5 s
const TIMEOUT = 30_000; // ms

describe('the balance, AI against AI', { timeout: TIMEOUT }, () => {
  it('plays every level out: a quick match always ends, on points', () => {
    for (const level of DIFFICULTY_LEVELS) {
      for (const report of simulateMany({ rules: QUICK, difficulty: level, player: level }, 6)) {
        expect(report.reason, `level ${level}`).toBe('points');
      }
    }
  });

  it('gives neither side of the court an edge', () => {
    // Equals, Overdrive for neither and no tiring CPU: the right side is the CPU, the left the AI in
    // the player's seat
    const share = playerPointShare(
      simulateMany(
        {
          rules: { ...QUICK, rallyPressure: false },
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
    const shareOf = (player: PlayerId) =>
      playerPointShare(
        simulateMany({ rules: QUICK, difficulty: DifficultyLevel.NORMAL, player }, 30),
      );
    const weak = shareOf('weak');
    const average = shareOf('average');
    const expert = shareOf('expert');
    expect(weak).toBeLessThan(average - 0.08);
    expect(average).toBeLessThan(expert - 0.15);
  });

  it('makes every level harder than the one below for the average player', () => {
    // Step 4.7 set the steps at some 15 points of share; less than 5 is a step lost
    const shares = DIFFICULTY_LEVELS.map((difficulty) =>
      playerPointShare(simulateMany({ rules: QUICK, difficulty, player: 'average' }, 30)),
    );
    for (let i = 1; i < shares.length; i++) {
      expect(shares[i], `level ${DIFFICULTY_LEVELS[i]}`).toBeLessThan(shares[i - 1] - 0.05);
    }
  });
});
