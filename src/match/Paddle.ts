import { COURT, PADDLE } from '@/match/config';
import { clamp } from '@/shared/math';

const PADDLE_SMOOTH_FACTOR = 22;
const PADDLE_VELOCITY_SMOOTHING = 12; // 1/s, ~80 ms averaging window

export class Paddle {
  public x: number;
  public y: number;
  public targetY: number;
  public score: number = 0;
  public readonly color: string;
  /** Smoothed vertical speed in px/s (positive = moving down). */
  public velocity: number = 0;
  public readonly index: 0 | 1;

  constructor(index: 0 | 1, x: number, color: string) {
    this.index = index;
    this.x = x;
    this.y = COURT.HEIGHT / 2;
    this.targetY = COURT.HEIGHT / 2;
    this.color = color;
  }

  public resetPosition(): void {
    this.y = COURT.HEIGHT / 2;
    this.targetY = COURT.HEIGHT / 2;
    this.velocity = 0;
  }

  public resetScore(): void {
    this.score = 0;
    this.resetPosition();
  }

  public setTargetY(y: number): void {
    const minY = PADDLE.TOP_MARGIN + PADDLE.HEIGHT / 2;
    const maxY = COURT.HEIGHT - PADDLE.BOTTOM_MARGIN - PADDLE.HEIGHT / 2;
    this.targetY = clamp(y, minY, maxY);
  }

  /** Moves toward the target and tracks its speed. */
  public update(dt: number): void {
    const previousY = this.y;
    this.y += (this.targetY - this.y) * Math.min(1, dt * PADDLE_SMOOTH_FACTOR);

    // Low-pass the measured speed so jerky touch input doesn't produce spikes
    if (dt > 0) {
      const rawVelocity = (this.y - previousY) / dt;
      this.velocity += (rawVelocity - this.velocity) * Math.min(1, dt * PADDLE_VELOCITY_SMOOTHING);
    }
  }
}
