import { LaserConfig } from '@/types/game.types';
import { GAME_HEIGHT, GAME_WIDTH } from '@/constants/game.constants';

export const PARTICLE_LIFE_DECAY = 1.8;
export const PARTICLE_VELOCITY_DAMPING = 0.98;
export const PARTICLE_SPARK_SPEED_MIN = 30;
export const PARTICLE_SPARK_SPEED_MAX = 100;
export const PARTICLE_HIT_BURST_COUNT_BASE = 18;
export const PARTICLE_PERFECT_BURST_COUNT = 16;
export const PARTICLE_PERFECT_BURST_SPEED = 380;
export const PARTICLE_SCORE_BURST_COUNT = 46;
export const PARTICLE_SCORE_BURST_SPEED = 460;

export const SHOCKWAVE_EXPANSION_SPEED = 260;
export const PERFECT_SHOCKWAVE_EXPANSION_SPEED = 520;
export const SCORE_SHOCKWAVE_EXPANSION_SPEED = 620;

export const SCREEN_SHAKE_DECAY = 9;
export const SCREEN_FLASH_DECAY = 3;
export const SCREEN_SHAKE_SCORE = 14;
export const SCREEN_SHAKE_PERFECT_BONUS = 3;
export const SCREEN_FLASH_SCORE = 0.8;
export const SCREEN_FLASH_START = 1.0;
export const SCREEN_FLASH_PERFECT_HIT = 0.6;

// Match point tension (presentation only)
export const DRAMA_MATCH_POINT_LEVEL = 0.35; // subtle tension for the whole match-point rally
export const DRAMA_SLOWMO_SCALE = 0.3; // simulation speed once the deciding ball is past the paddle
export const DRAMA_SLOWMO_DURATION = 0.45; // seconds, wall-clock
export const DRAMA_TIME_SCALE_SMOOTHING = 14; // 1/s, quick ease in and out of slow motion
export const DRAMA_LEVEL_SMOOTHING = 6; // 1/s
export const VIGNETTE_RGB = '4, 0, 14';
export const VIGNETTE_MAX_ALPHA = 0.6;

// Rally climax (presentation only)
export const CLIMAX_LEVEL_SMOOTHING = 2.2; // 1/s, ~1 s to build up and to cool down
export const CLIMAX_FLASH = 0.45;
export const CLIMAX_SHAKE = 6;
export const CLIMAX_LASER_SURGE = 0.5; // extra laser intensity on the drop, fades out
export const CLIMAX_LASER_SURGE_DECAY = 1.5; // 1/s
export const CLIMAX_EMBER_RATE = 70; // embers per second shed by the burning ball
export const CLIMAX_BALL_HUE = 34; // white-hot orange plasma at full climax
export const CLIMAX_EMBER_COLORS = ['#ffffff', '#ffe53b', '#ff9a3b', '#ff2bd6'];

// Memphis background during the climax
export const MEMPHIS_GRADIENT_COOL = ['#1a0b4d', '#4a0f6e', '#7a1a73'];
export const MEMPHIS_GRADIENT_HOT = ['#3d0a45', '#8f1460', '#c2432f'];
export const MEMPHIS_CLIMAX_SPEEDUP = 2; // shapes move/spin up to (1 + this)× faster
export const MEMPHIS_DROP_PUSH = 60; // px the drop shockwave throws shapes outward
export const MEMPHIS_DROP_PEAK_TIME = 0.18; // s until the push peaks, then it eases back

// Durations of the CSS stage effects (ms)
export const VICTORY_DURATION = 900;
export const LOSS_DURATION = 700;

// Final sequence after the match point (seconds); the canvas stays live throughout
export const FINAL_SEQUENCE_WIN_DURATION = 2.4;
export const FINAL_SEQUENCE_LOSS_DURATION = 1.9;
export const FINAL_SEQUENCE_SKIP_AFTER = 0.6; // tap/key can skip once this has passed

// Victory fireworks, launched from the goal and walking toward center court
export const FIREWORK_SHOTS = 6;
export const FIREWORK_INTERVAL = 0.22;
export const FIREWORK_PARTICLES = 40;
export const FIREWORK_SPEED = 340;
export const FIREWORK_FLASH = 0.25;
export const FIREWORK_SHAKE = 4;

// Celebration on the backgrounds: lasers sweep through hues, Memphis heats up
export const CELEBRATION_DECAY = 0.45; // 1/s, linear
export const CELEBRATION_HUE_SWING = 180; // degrees
export const CELEBRATION_LASER_SURGE = 1.0;

// Neon final-score sign
export const FINAL_SIGN_DELAY = 0.3; // s before the tubes start to ignite
export const FINAL_SIGN_IGNITE = 0.55; // s of ignition flicker before it burns steadily
export const FINAL_SIGN_UNLIT_ALPHA = 0.1; // dark tubes stay faintly visible

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
