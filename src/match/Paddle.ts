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
   * How quickly it takes up the speed it is steered at, 1/s; Infinity (the usual) at once. A
   * slippery court (Ice) gives it a finite one, and a friction: it slides into motion
   * and rolls on out of it.
   */
  private _grip = Infinity;
  /** How fast it sheds speed while it slides, px/s². */
  private friction = Infinity;
  /** While it slides, 1/s of the way to its aim it is steered at. */
  private pull = 0;
  /** Its speed while it slides, px/s (only with a finite grip). */
  private slide = 0;
  /** The stretch of the court it may cover, top to bottom: the whole court unless confined. */
  private zone: { top: number; bottom: number } = { top: 0, bottom: COURT.HEIGHT };
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
  /** What it plays like, as given (`useSpec`), before overtime squeezes it. */
  private given: PaddleSpec;
  /** What it plays like now: the given spec, its height squeezed by overtime. */
  private _spec: PaddleSpec;
  /** Share of its given height overtime leaves it (see `squeeze`); 1 outside overtime. */
  private _squeeze = 1;
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
    this.given = spec;
    this._spec = spec;
    this.x = x;
    this.y = COURT.HEIGHT / 2;
    this.targetY = COURT.HEIGHT / 2;
    this.previousY = this.y;
    this.drawY = this.y;
    this.color = color;
    this.useSpec(spec);
  }

  /** Its size and how it hits, as it plays now (overtime's squeeze included). */
  public get spec(): PaddleSpec {
    return this._spec;
  }

  /** Share of its height overtime leaves it; 1 outside overtime. */
  public get squeezed(): number {
    return this._squeeze;
  }

  /**
   * Squeezes it to `share` of its height, on top of whatever spec it is given (a shrinking paddle
   * shrinks further), until squeezed back to 1 (overtime, match/overtime.ts).
   */
  public squeeze(share: number): void {
    this._squeeze = share;
    this.useSpec(this.given);
  }

  /**
   * Makes it another paddle (whoever plays the next match brings their own). It keeps the edge
   * of the court it stands at, so a wider right paddle grows toward the middle, and stays clear
   * of the walls.
   */
  public useSpec(given: PaddleSpec): void {
    const spec = this._squeeze === 1 ? given : { ...given, height: given.height * this._squeeze };
    if (this.side === 1) this.x += this._spec.width - spec.width;
    this.given = given;
    this._spec = spec;
    const { top, bottom } = this.zone;
    this.minY = Math.max(PADDLE.TOP_MARGIN, top) + spec.height / 2;
    this.maxY = Math.min(COURT.HEIGHT - PADDLE.BOTTOM_MARGIN, bottom) - spec.height / 2;
    this.setTargetY(this.targetY);
    this.y = clamp(this.y, this.minY, this.maxY);
  }

  /** How quickly it takes up the speed it is steered at, 1/s (Infinity: at once). */
  public get grip(): number {
    return this._grip;
  }

  /**
   * Makes it slide (or, with an Infinity grip, not): steered at `pull` (1/s) of the way to its
   * aim, it takes up that speed over ~1/`grip` seconds, and sheds speed at `friction` px/s².
   */
  public slip(pull: number, grip: number, friction: number): void {
    this.pull = pull;
    this._grip = grip;
    this.friction = friction;
  }

  /**
   * Keeps it to a stretch of the court, from `top` to `bottom` (one of two paddles on a side,
   * each holding its half); the whole court when left out.
   */
  public confine(top: number = 0, bottom: number = COURT.HEIGHT): void {
    this.zone = { top, bottom };
    this.useSpec(this.given);
  }

  /** The middle of the stretch it covers, where it stands to begin with. */
  private get home(): number {
    return clamp((this.zone.top + this.zone.bottom) / 2, this.minY, this.maxY);
  }

  public resetPosition(): void {
    this.y = this.home;
    this.targetY = this.home;
    this.velocity = 0;
    this.slide = 0;
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
    const rate = PADDLE_SMOOTH_FACTOR * this.spec.speed;
    if (Number.isFinite(this._grip)) {
      // It slides: the speed it is steered at is taken up over time, and kept a while after
      // It picks up speed as steered, but sheds it only by friction, as on ice: the faster it
      // went, the further it rolls on once it is meant to slow down or turn
      const steered = (this.targetY - this.y) * this.pull;
      const isSpeedingUp =
        this.slide === 0 ||
        (Math.sign(steered) === Math.sign(this.slide) && Math.abs(steered) >= Math.abs(this.slide));
      if (isSpeedingUp) {
        this.slide = approach(this.slide, steered, this._grip, dt);
      } else {
        const shed = this.friction * dt;
        this.slide = Math.abs(this.slide) > shed ? this.slide - Math.sign(this.slide) * shed : 0;
      }
      this.y += this.slide * dt;
      if (this.y < this.minY || this.y > this.maxY) {
        this.y = clamp(this.y, this.minY, this.maxY);
        this.slide = 0;
      }
    } else {
      this.y = approach(this.y, this.targetY, rate, dt);
      this.slide = 0;
    }

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
