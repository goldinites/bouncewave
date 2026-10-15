export type GameState = 'menu' | 'play' | 'paused';

export enum GameMode {
  DEMO = 0,
  PLAYER_VS_AI = 1,
}

export interface Point {
  x: number;
  y: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  life: number;
  color: string;
  velocity: number;
}

export type MemphisShapeKind = 0 | 1 | 2 | 3 | 4 | 5;

export interface MemphisShape {
  kind: MemphisShapeKind;
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
}

export type LaserConfig = [
  x: number,
  y: number,
  baseAngle: number,
  sweep: number,
  speed: number,
  phase: number,
  hue: number,
];
