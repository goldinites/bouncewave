import { ParticleSystem } from '@/fx/ParticleSystem';
import { COURT, PADDLE } from '@/match/config';
import { clamp, randomRange } from '@/shared/math';

const PADDLE_SMOOTH_FACTOR = 22;
const PADDLE_VELOCITY_SMOOTHING = 12; // 1/s, ~80 ms averaging window
const PADDLE_GLOW_DECAY = 4;
const PARTICLE_SPARK_SPEED_MIN = 30;
const PARTICLE_SPARK_SPEED_MAX = 100;

export class Paddle {
  public x: number;
  public y: number;
  public targetY: number;
  public score: number = 0;
  public glow: number = 0;
  public readonly color: string;
  public errorOffset: number = 0;
  /** Smoothed vertical speed in px/s (positive = moving down). */
  public velocity: number = 0;
  public readonly index: number;

  constructor(index: number, x: number, color: string) {
    this.index = index;
    this.x = x;
    this.y = COURT.HEIGHT / 2;
    this.targetY = COURT.HEIGHT / 2;
    this.color = color;
  }

  public resetPosition(): void {
    this.y = COURT.HEIGHT / 2;
    this.targetY = COURT.HEIGHT / 2;
    this.glow = 0;
    this.errorOffset = 0;
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

  /** Moves toward the target, tracks speed and fades the hit glow. No visual side effects. */
  public update(dt: number): void {
    const previousY = this.y;
    this.y += (this.targetY - this.y) * Math.min(1, dt * PADDLE_SMOOTH_FACTOR);

    // Low-pass the measured speed so jerky touch input doesn't produce spikes
    if (dt > 0) {
      const rawVelocity = (this.y - previousY) / dt;
      this.velocity += (rawVelocity - this.velocity) * Math.min(1, dt * PADDLE_VELOCITY_SMOOTHING);
    }

    this.glow = Math.max(0, this.glow - dt * PADDLE_GLOW_DECAY);
  }

  /** Occasionally sheds a spark; more often while moving fast or deep into a rally. */
  public emitSparks(dt: number, particleSystem: ParticleSystem, rally: number): void {
    const isMovingFast = Math.abs(this.targetY - this.y) > 8;
    const movementMultiplier = isMovingFast ? 2 : 1;
    const sparkChance = dt * (6 + Math.min(rally, 20) * 1.2) * movementMultiplier;

    if (Math.random() < sparkChance) {
      const sparkX = this.index === 0 ? this.x + PADDLE.WIDTH : this.x;
      const sparkY = this.y + (Math.random() - 0.5) * PADDLE.HEIGHT;
      const direction = this.index === 0 ? 1 : -1;
      const vx = direction * randomRange(PARTICLE_SPARK_SPEED_MIN, PARTICLE_SPARK_SPEED_MAX);
      const vy = (Math.random() - 0.5) * 50;
      const size = randomRange(1, 2.8);

      particleSystem.addParticle({
        x: sparkX,
        y: sparkY,
        vx,
        vy,
        life: 0.7,
        color: this.color,
        size,
      });
    }
  }
}
