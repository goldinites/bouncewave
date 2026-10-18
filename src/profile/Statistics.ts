import * as v from 'valibot';
import { DIFFICULTY_LEVELS, DifficultyLevel } from '@/match/difficulty';

/** Matches played and won. */
export interface Tally {
  played: number;
  won: number;
}

/**
 * The player's record over every finished match: a match left halfway (back to the menu, or
 * restarted) counts for nothing, so leaving a lost one can't save a streak.
 */
export interface Statistics {
  played: number;
  won: number;
  /** By the CPU's difficulty in the match. */
  byDifficulty: Record<DifficultyLevel, Tally>;
  /** Hits in the longest rally, both paddles' together. */
  longestRally: number;
  /** The player's perfect hits, and the shots their Overdrive powered. */
  perfectHits: number;
  powerShots: number;
  /** Matches won in a row up to the last one, and the most ever. */
  streak: number;
  bestStreak: number;
}

const emptyTally = (): Tally => ({ played: 0, won: 0 });

export function getEmptyStatistics(): Statistics {
  return {
    played: 0,
    won: 0,
    byDifficulty: Object.fromEntries(
      DIFFICULTY_LEVELS.map((level) => [level, emptyTally()]),
    ) as Record<DifficultyLevel, Tally>,
    longestRally: 0,
    perfectHits: 0,
    powerShots: 0,
    streak: 0,
    bestStreak: 0,
  };
}

/** A count as saved: a whole number from 0, or 0 when it is anything else. */
const count = v.fallback(v.pipe(v.number(), v.integer(), v.minValue(0)), 0);
const tally = v.fallback(v.object({ played: count, won: count }), emptyTally);

/** The statistics as saved ones are checked: each count falls back to 0 on its own. */
export const statisticsSchema = v.fallback(
  v.object({
    played: count,
    won: count,
    byDifficulty: v.fallback(
      v.object(Object.fromEntries(DIFFICULTY_LEVELS.map((level) => [level, tally]))),
      () => getEmptyStatistics().byDifficulty,
    ),
    longestRally: count,
    perfectHits: count,
    powerShots: count,
    streak: count,
    bestStreak: count,
  }),
  getEmptyStatistics,
) as unknown as v.GenericSchema<unknown, Statistics>;

/** One finished match, as the player played it. */
export interface MatchRecord {
  difficulty: DifficultyLevel;
  isWin: boolean;
  longestRally: number;
  perfectHits: number;
  powerShots: number;
}

/** The statistics with one more finished match counted in. */
export function recordMatch(stats: Statistics, match: MatchRecord): Statistics {
  const win = match.isWin ? 1 : 0;
  const streak = match.isWin ? stats.streak + 1 : 0;
  const byLevel = stats.byDifficulty[match.difficulty] ?? emptyTally();
  return {
    played: stats.played + 1,
    won: stats.won + win,
    byDifficulty: {
      ...stats.byDifficulty,
      [match.difficulty]: { played: byLevel.played + 1, won: byLevel.won + win },
    },
    longestRally: Math.max(stats.longestRally, match.longestRally),
    perfectHits: stats.perfectHits + match.perfectHits,
    powerShots: stats.powerShots + match.powerShots,
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
  };
}
