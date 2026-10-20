import { COURT, PADDLE } from '@/match/config';
import { PaddleSpec, STANDARD_PADDLE } from '@/match/PaddleSpec';
import { Side } from '@/match/side';
import { approach, clamp, lerp } from '@/shared/math';

export const PADDLE_SMOOTH_FACTOR = 27.4; // 1/s toward the target, for a paddle of standard speed
const PADDLE_VELOCITY_SMOOTHING = 13.4; // 1/s, ~75 ms averaging window
// Below this speed the paddle counts as standing still: its next motion is a new one
const STILL_SPEED = 60; // px/s

export class Paddle {
  public x: number;
  public y: number;
  public targetY: number;
  public readonly color: string;
  /** Smoothed vertical speed in px/s (positive = moving down). */
  public velocity: number = 0;
  /**
   * Seconds its current motion has lasted: since it last stood still or turned around. A swing
   * at the ball is a short one; a chase after it, a long one.
   */
  public motionTime = 0;
  /**
   * Multiplies its perfect zone for now: a skill may widen it for a hit (Reflex's counter-pulse).
   * 1 the rest of the time; the skill that changes it puts it back.
   */
  public perfectZoneScale = 1;
  /** The side of the court it plays on; its points are that side's. */
  public readonly side: Side;
  private _spec: PaddleSpec;
  /** Range of its center, so the whole paddle stays clear of the walls. */
  private minY = 0;
  private maxY = 0;
  /** Where the paddle stood when the current simulation step began. */
  private previousY: number;
  /** Where to draw the paddle this frame, between two simulation steps (see `interpolate`). */
  public drawY: number;

  /** @param spec what it is like to play with; the standard paddle when left out */
  constructor(side: Side, x: number, color: string, spec: PaddleSpec = STANDARD_PADDLE) {
    this.side = side;
    this._spec = spec;
    this.x = x;
    this.y = COURT.HEIGHT / 2;
    this.targetY = COURT.HEIGHT / 2;
    this.previousY = this.y;
    this.drawY = this.y;
    this.color = color;
    this.useSpec(spec);
  }

  /** Its size and how it hits. */
  public get spec(): PaddleSpec {
    return this._spec;
  }

  /**
   * Makes it another paddle (whoever plays the next match brings their own). It keeps the edge
   * of the court it stands at, so a wider right paddle grows toward the middle, and stays clear
   * of the walls.
   */
  public useSpec(spec: PaddleSpec): void {
    if (this.side === 1) this.x += this._spec.width - spec.width;
    this._spec = spec;
    this.minY = PADDLE.TOP_MARGIN + spec.height / 2;
    this.maxY = COURT.HEIGHT - PADDLE.BOTTOM_MARGIN - spec.height / 2;
    this.setTargetY(this.targetY);
    this.y = clamp(this.y, this.minY, this.maxY);
  }

  public resetPosition(): void {
    this.y = COURT.HEIGHT / 2;
    this.targetY = COURT.HEIGHT / 2;
    this.velocity = 0;
    this.motionTime = 0;
    // Back at the center in one jump: nothing to draw in between
    this.rememberPosition();
    this.interpolate(1);
  }

  /** Call at the start of every simulation step. */
  public rememberPosition(): void {
    this.previousY = this.y;
  }

  /** Sets the position to draw at: `alpha` of the way from the step's start to where it is now. */
  public interpolate(alpha: number): void {
    this.drawY = lerp(this.previousY, this.y, alpha);
  }

  /** Aims the paddle at `y`, kept within the court. */
  public setTargetY(y: number): void {
    this.targetY = clamp(y, this.minY, this.maxY);
  }

  /** Moves toward the target and tracks its speed. */
  public update(dt: number): void {
    const previousY = this.y;
    this.y = approach(this.y, this.targetY, PADDLE_SMOOTH_FACTOR * this.spec.speed, dt);

    // Low-pass the measured speed so jerky touch input doesn't produce spikes
    if (dt > 0) {
      const rawVelocity = (this.y - previousY) / dt;
      const before = this.velocity;
      this.velocity = approach(this.velocity, rawVelocity, PADDLE_VELOCITY_SMOOTHING, dt);
      const isNewMotion =
        Math.abs(this.velocity) < STILL_SPEED || Math.sign(this.velocity) !== Math.sign(before);
      this.motionTime = isNewMotion ? 0 : this.motionTime + dt;
    }
  }
}
