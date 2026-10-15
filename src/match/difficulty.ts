export enum DifficultyLevel {
  EASY = 0,
  NORMAL = 1,
  HARD = 2,
  INSANE = 3,
}

export interface DifficultyConfig {
  speed: number;
  error: number;
  acceleration: number;
  maxSpeed: number;
}

export const DIFFICULTY_CONFIGS: Record<DifficultyLevel, DifficultyConfig> = {
  [DifficultyLevel.EASY]: {
    speed: 340,
    error: 80,
    acceleration: 0.055,
    maxSpeed: 760,
  },
  [DifficultyLevel.NORMAL]: {
    speed: 440,
    error: 40,
    acceleration: 0.075,
    maxSpeed: 840,
  },
  [DifficultyLevel.HARD]: {
    speed: 560,
    error: 12,
    acceleration: 0.095,
    maxSpeed: 920,
  },
  [DifficultyLevel.INSANE]: {
    speed: 680,
    error: 8,
    acceleration: 0.115,
    maxSpeed: 1000,
  },
};

/** Every level, easiest first. */
export const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = Object.values(DifficultyLevel).filter(
  (value): value is DifficultyLevel => typeof value === 'number',
);

export function isDifficultyLevel(value: unknown): value is DifficultyLevel {
  return DIFFICULTY_LEVELS.includes(value as DifficultyLevel);
}

/** The next level up, wrapping around from the hardest back to the easiest. */
export function nextDifficulty(level: DifficultyLevel): DifficultyLevel {
  const index = DIFFICULTY_LEVELS.indexOf(level);
  return DIFFICULTY_LEVELS[(index + 1) % DIFFICULTY_LEVELS.length];
}
