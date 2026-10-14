import { LaserConfig } from '@/types/game.types';
import { GAME_HEIGHT, GAME_WIDTH } from '@/constants/game.constants';

export const PARTICLE_LIFE_DECAY = 1.8;
export const PARTICLE_VELOCITY_DAMPING = 0.98;
export const PARTICLE_SPARK_SPEED_MIN = 30;
export const PARTICLE_SPARK_SPEED_MAX = 100;
export const PARTICLE_HIT_BURST_COUNT_BASE = 18;
export const PARTICLE_SCORE_BURST_COUNT = 46;
export const PARTICLE_SCORE_BURST_SPEED = 460;

export const SHOCKWAVE_EXPANSION_SPEED = 260;
export const SCORE_SHOCKWAVE_EXPANSION_SPEED = 620;

export const SCREEN_SHAKE_DECAY = 9;
export const SCREEN_FLASH_DECAY = 3;
export const SCREEN_SHAKE_SCORE = 14;
export const SCREEN_FLASH_SCORE = 0.8;
export const SCREEN_FLASH_START = 1.0;

export const MEMPHIS_SHAPE_COUNT = 24;

export const LASER_CONFIGURATIONS: LaserConfig[] = [
  [0, 0, 0.8, 0.45, 0.7, 0, 185],
  [0, 0, 0.45, 0.4, -0.9, 2, 320],
  [GAME_WIDTH, 0, 2.35, 0.45, 0.8, 1, 320],
  [GAME_WIDTH, 0, 2.7, 0.4, -0.6, 4, 185],
  [GAME_WIDTH / 2, 0, 1.57, 0.8, 0.5, 3, 270],
  [GAME_WIDTH * 0.25, GAME_HEIGHT, -1.2, 0.5, 0.8, 5, 320],
  [GAME_WIDTH * 0.75, GAME_HEIGHT, -1.95, 0.5, -0.7, 6, 185],
];
