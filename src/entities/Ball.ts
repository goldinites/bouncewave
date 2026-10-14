import {
  BALL_INITIAL_RADIUS,
  BALL_INITIAL_SPEED,
  BALL_TRAIL_MAX_LENGTH,
  GAME_HEIGHT,
  GAME_WIDTH,
} from '@/constants/game.constants';
import { Point } from '@/types/game.types';
import { clamp } from '@/utils/math';

export class Ball {
  public x: number = GAME_WIDTH / 2;
  public y: number = GAME_HEIGHT / 2;
  public vx: number = 0;
  public vy: number = 0;
  public speed: number = BALL_INITIAL_SPEED;
  public radius: number = BALL_INITIAL_RADIUS;
  public trail: Point[] = [];

  public serve(direction: number, initialSpeed = BALL_INITIAL_SPEED): void {
    this.x = GAME_WIDTH / 2;
    this.y = GAME_HEIGHT / 2;
    this.speed = initialSpeed;
    this.trail = [];

    const angle = (Math.random() - 0.5) * 0.8;
    this.vx = direction * Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
  }

  public updateTrail(): void {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > BALL_TRAIL_MAX_LENGTH) {
      this.trail.shift();
    }
  }

  public updateRadius(dt: number, rally: number, maxDifficultySpeed: number): void {
    const rallyFactor = 0.12 * Math.min(1, rally / 14);
    const speedRatio = clamp((this.speed - 340) / (maxDifficultySpeed - 340), 0, 1);
    const speedFactor = 0.13 * speedRatio;
    const targetRadius = BALL_INITIAL_RADIUS * (1 + rallyFactor + speedFactor);

    this.radius += (targetRadius - this.radius) * Math.min(1, dt * 6);
  }
}
