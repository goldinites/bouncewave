import { DifficultyConfig, DifficultyLevel } from '@/types/difficulty.types';

export const DIFFICULTY_CONFIGS: Record<DifficultyLevel, DifficultyConfig> = {
  [DifficultyLevel.EASY]: {
    speed: 250,
    error: 130,
    acceleration: 0.035,
    maxSpeed: 640,
  },
  [DifficultyLevel.NORMAL]: {
    speed: 340,
    error: 80,
    acceleration: 0.055,
    maxSpeed: 760,
  },
  [DifficultyLevel.HARD]: {
    speed: 440,
    error: 40,
    acceleration: 0.075,
    maxSpeed: 840,
  },
  [DifficultyLevel.INSANE]: {
    speed: 560,
    error: 12,
    acceleration: 0.095,
    maxSpeed: 920,
  },
};
