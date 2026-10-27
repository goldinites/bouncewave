import { COURT, BALL } from '@/match/config';
import { CourtConditions } from '@/match/court';
import { getRallyHeat, getSpeedHeat } from '@/match/heat';
import { approach, lerp } from '@/shared/math';

const RADIUS_SMOOTHING = 6.3; // 1/s toward the radius the rally and speed call for

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
  /** Where the ball was over the last BALL.TRAIL_DURATION, oldest first. */
  public trail: Point[] = [];
  /** Seconds since each trail point was laid. */
  private trailAges: number[] = [];
  /** Seconds since the last trail point; the first update after a serve lays one at once. */
  private sinceTrailPoint = Infinity;
  /** In flight from an Overdrive power shot; cleared by the next hit or serve. */
  public isPowerShot = false;
  /**
   * How fast its flight turns, in rad/s (positive turns it clockwise on screen, y pointing
   * down): a skill's spin bends its path (Arc). Physics turns it and fades it; a wall, a paddle
   * and a serve take it off.
   */
  public spin = 0;
  /** How fast the spin fades, 1/s. */
  public spinDecay = 0;
  /** Seconds more it flies straight before its spin starts to turn it (a late break). */
  public spinDelay = 0;
  /** The court it flies over, with whatever wind, turbo or posts the match's modifiers put there. */
  public court: CourtConditions | null = null;

  /** Where the ball stood when the current simulation step began. */
  private previousX = this.x;
  private previousY = this.y;
  /**
   * Where to draw the ball this frame: a frame usually falls between two simulation steps, and
   * is drawn that far between them (see `interpolate`) so motion stays smooth at any refresh rate.
   */
  public drawX = this.x;
  public drawY = this.y;

  // Temporary speed surge (e.g. after a perfect hit); fades out linearly
  private boostAmount = 0;
  private boostDuration = 0;
  private boostTimeLeft = 0;

  /** Multiplier applied to movement on top of the base speed. */
  public get speedMultiplier(): number {
    if (this.boostTimeLeft <= 0) return 1;
    return 1 + this.boostAmount * (this.boostTimeLeft / this.boostDuration);
  }

  /** Sets the base speed, the direction of flight kept. */
  public setSpeed(speed: number): void {
    const scale = speed / this.speed;
    this.vx *= scale;
    this.vy *= scale;
    this.speed = speed;
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

  /** @param random the source of the serve's angle; MatchFlow passes its own */
  public serve(
    direction: number,
    initialSpeed = BALL.INITIAL_SPEED,
    random: () => number = Math.random,
  ): void {
    this.x = COURT.WIDTH / 2;
    this.y = COURT.HEIGHT / 2;
    this.speed = initialSpeed;
    this.trail = [];
    this.trailAges = [];
    this.sinceTrailPoint = Infinity;
    this.clearBoost();
    this.isPowerShot = false;
    this.spin = 0;
    this.spinDelay = 0;
    // Back at the center in one jump: nothing to draw between where it was and here
    this.rememberPosition();
    this.interpolate(1);

    const angle = (random() - 0.5) * 0.8;
    this.vx = direction * Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
  }

  /**
   * A ball flying exactly as this one does, to fly ahead of it (a forecast): its position,
   * velocity, size, boost and spin, with no trail.
   */
  public flightCopy(): Ball {
    const copy = new Ball();
    copy.x = this.x;
    copy.y = this.y;
    copy.vx = this.vx;
    copy.vy = this.vy;
    copy.speed = this.speed;
    copy.radius = this.radius;
    copy.spin = this.spin;
    copy.spinDecay = this.spinDecay;
    copy.spinDelay = this.spinDelay;
    copy.court = this.court;
    copy.boostAmount = this.boostAmount;
    copy.boostDuration = this.boostDuration;
    copy.boostTimeLeft = this.boostTimeLeft;
    return copy;
  }

  /** Call at the start of every simulation step. */
  public rememberPosition(): void {
    this.previousX = this.x;
    this.previousY = this.y;
  }

  /** Sets the position to draw at: `alpha` of the way from the step's start to where it is now. */
  public interpolate(alpha: number): void {
    this.drawX = lerp(this.previousX, this.x, alpha);
    this.drawY = lerp(this.previousY, this.y, alpha);
  }

  public updateTrail(dt: number): void {
    for (let i = 0; i < this.trailAges.length; i++) this.trailAges[i] += dt;
    this.sinceTrailPoint += dt;
    // A hair of slack, as frame times summed in floating point fall just short of an interval
    if (this.sinceTrailPoint >= BALL.TRAIL_INTERVAL - 1e-9) {
      this.trail.push({ x: this.x, y: this.y });
      this.trailAges.push(0);
      this.sinceTrailPoint = 0;
    }

    while (this.trailAges[0] > BALL.TRAIL_DURATION) {
      this.trail.shift();
      this.trailAges.shift();
    }
  }

  public updateRadius(dt: number, rally: number, maxDifficultySpeed: number): void {
    const rallyFactor = 0.12 * getRallyHeat(rally);
    const speedFactor = 0.13 * getSpeedHeat(this.speed, maxDifficultySpeed);
    const targetRadius = BALL.INITIAL_RADIUS * (1 + rallyFactor + speedFactor);

    this.radius = approach(this.radius, targetRadius, RADIUS_SMOOTHING, dt);
  }
}
