import { COURT, BALL } from '@/match/config';
import { getRallyHeat, getSpeedHeat } from '@/match/heat';

export interface Point {
  x: number;
  y: number;
}

export class Ball {
  public x: number = COURT.WIDTH / 2;
  public y: number = COURT.HEIGHT / 2;
  public vx: number = 0;
  public vy: number = 0;
  public speed: number = BALL.INITIAL_SPEED;
  public radius: number = BALL.INITIAL_RADIUS;
  public trail: Point[] = [];
  /** In flight from an Overdrive power shot; cleared by the next hit or serve. */
  public isPowerShot = false;

  // Temporary speed surge (e.g. after a perfect hit); fades out linearly
  private boostAmount = 0;
  private boostDuration = 0;
  private boostTimeLeft = 0;

  /** Multiplier applied to movement on top of the base speed. */
  public get speedMultiplier(): number {
    if (this.boostTimeLeft <= 0) return 1;
    return 1 + this.boostAmount * (this.boostTimeLeft / this.boostDuration);
  }

  public applyBoost(amount: number, duration: number): void {
    this.boostAmount = amount;
    this.boostDuration = duration;
    this.boostTimeLeft = duration;
  }

  public clearBoost(): void {
    this.boostTimeLeft = 0;
  }

  public updateBoost(dt: number): void {
    this.boostTimeLeft = Math.max(0, this.boostTimeLeft - dt);
  }

  public serve(direction: number, initialSpeed = BALL.INITIAL_SPEED): void {
    this.x = COURT.WIDTH / 2;
    this.y = COURT.HEIGHT / 2;
    this.speed = initialSpeed;
    this.trail = [];
    this.clearBoost();
    this.isPowerShot = false;

    const angle = (Math.random() - 0.5) * 0.8;
    this.vx = direction * Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
  }

  public updateTrail(): void {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > BALL.TRAIL_MAX_LENGTH) {
      this.trail.shift();
    }
  }

  public updateRadius(dt: number, rally: number, maxDifficultySpeed: number): void {
    const rallyFactor = 0.12 * getRallyHeat(rally);
    const speedFactor = 0.13 * getSpeedHeat(this.speed, maxDifficultySpeed);
    const targetRadius = BALL.INITIAL_RADIUS * (1 + rallyFactor + speedFactor);

    this.radius += (targetRadius - this.radius) * Math.min(1, dt * 6);
  }
}
