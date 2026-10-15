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
