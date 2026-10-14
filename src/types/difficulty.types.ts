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
