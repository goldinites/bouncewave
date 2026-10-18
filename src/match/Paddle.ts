import { COURT, PADDLE } from '@/match/config';
import { Side } from '@/match/side';
import { approach, clamp, lerp } from '@/shared/math';

const PADDLE_SMOOTH_FACTOR = 27.4; // 1/s toward the target
const PADDLE_VELOCITY_SMOOTHING = 13.4; // 1/s, ~75 ms averaging window
// Range of the paddle center, so the whole paddle stays clear of the walls
const MIN_Y = PADDLE.TOP_MARGIN + PADDLE.HEIGHT / 2;
const MAX_Y = COURT.HEIGHT - PADDLE.BOTTOM_MARGIN - PADDLE.HEIGHT / 2;

export class Paddle {
  public x: number;
  public y: number;
  public targetY: number;
  public readonly color: string;
  /** Smoothed vertical speed in px/s (positive = moving down). */
  public velocity: number = 0;
  /** The side of the court it plays on; its points are that side's. */
  public readonly side: Side;
  /** Where the paddle stood when the current simulation step began. */
  private previousY: number;
  /** Where to draw the paddle this frame, between two simulation steps (see `interpolate`). */
  public drawY: number;

  constructor(side: Side, x: number, color: string) {
    this.side = side;
    this.x = x;
    this.y = COURT.HEIGHT / 2;
    this.targetY = COURT.HEIGHT / 2;
    this.previousY = this.y;
    this.drawY = this.y;
    this.color = color;
  }

  public resetPosition(): void {
    this.y = COURT.HEIGHT / 2;
    this.targetY = COURT.HEIGHT / 2;
    this.velocity = 0;
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
    this.targetY = clamp(y, MIN_Y, MAX_Y);
  }

  /** Moves toward the target and tracks its speed. */
  public update(dt: number): void {
    const previousY = this.y;
    this.y = approach(this.y, this.targetY, PADDLE_SMOOTH_FACTOR, dt);

    // Low-pass the measured speed so jerky touch input doesn't produce spikes
    if (dt > 0) {
      const rawVelocity = (this.y - previousY) / dt;
      this.velocity = approach(this.velocity, rawVelocity, PADDLE_VELOCITY_SMOOTHING, dt);
    }
  }
}
