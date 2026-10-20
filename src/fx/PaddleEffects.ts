import { ParticleSystem } from '@/fx/ParticleSystem';
import { Paddle } from '@/match/Paddle';
import { randomRange } from '@/shared/math';

const GLOW_DECAY = 4; // 1/s, from a fresh hit (1) to unlit (0)
// A charge lost from an implants' core (spent, or to a hit that wasn't perfect): the segment
// flares, flickers and goes out
const SPENT_DECAY = 1.6; // 1/s, from the flare (1) to out (0)
const SPARK_SPEED_MIN = 30;
const SPARK_SPEED_MAX = 100;
// A spinning hit (Arc) whips the paddle over toward its motion, like a racket swung through the
// ball: it leans in, holds a moment, and eases back upright. A critically damped spring follows
// the lean, so it never jumps or wobbles
const WHIP = {
  MAX_ANGLE: 0.38, // rad (~22°), off the strongest spin
  MIN_SHARE: 0.4, // of MAX_ANGLE even off the gentlest, so it always reads
  HOLD: 0.12, // s it leans toward its angle before easing back
  RATE: 22, // 1/s of the spring: ~0.1 s to lean in, ~0.25 s to come back
} as const;

/**
 * Paddle neon: a glow that flares on every hit and fades, and the sparks a paddle sheds
 * while it moves. Presentation only; the paddles themselves are never changed.
 */
export class PaddleEffects {
  private readonly _glow: number[];
  private readonly _spent: number[];
  private readonly _tilt: number[];
  private readonly tiltSpeed: number[];
  /** The angle each paddle leans toward, and for how long more before it comes back to 0. */
  private readonly lean: number[];
  private readonly leanFor: number[];

  /** @param paddleCount how many paddles are on the court */
  constructor(paddleCount: number) {
    this._glow = new Array<number>(paddleCount).fill(0);
    this._spent = new Array<number>(paddleCount).fill(0);
    this._tilt = new Array<number>(paddleCount).fill(0);
    this.tiltSpeed = new Array<number>(paddleCount).fill(0);
    this.lean = new Array<number>(paddleCount).fill(0);
    this.leanFor = new Array<number>(paddleCount).fill(0);
  }

  /** How brightly the charge each paddle's meter just lost still burns, in [0, 1]. */
  public get spent(): readonly number[] {
    return this._spent;
  }

  /** The paddle's implants' core has lost a charge of its meter. */
  public onSpend(paddleIndex: number): void {
    this._spent[paddleIndex] = 1;
  }

  /**
   * How far each paddle leans, in radians (positive turns it clockwise), in the order of the
   * match's paddles.
   */
  public get tilt(): readonly number[] {
    return this._tilt;
  }

  /**
   * A paddle put spin on the ball (Arc): it whips over toward its motion, its face turned the way
   * it swept the ball, and springs back.
   * @param velocity the paddle's speed at the hit, px/s (positive = down)
   * @param strength how hard it spun the ball, in [0, 1]
   */
  public onWhip(paddleIndex: number, side: number, velocity: number, strength: number): void {
    // Moving down, the left paddle's face (its right side) turns down: clockwise; the right's,
    // counterclockwise
    const turn = Math.sign(velocity) * (side === 0 ? 1 : -1);
    const share = Math.min(1, WHIP.MIN_SHARE + strength);
    this.lean[paddleIndex] = turn * WHIP.MAX_ANGLE * share;
    this.leanFor[paddleIndex] = WHIP.HOLD;
  }

  /** Hit glow of each paddle in [0, 1], in the order of the match's paddles. */
  public get glow(): readonly number[] {
    return this._glow;
  }

  /** @param paddleIndex the paddle's place in the match's list */
  public onHit(paddleIndex: number): void {
    this._glow[paddleIndex] = 1;
  }

  public reset(): void {
    this._glow.fill(0);
    this._spent.fill(0);
    this._tilt.fill(0);
    this.tiltSpeed.fill(0);
    this.lean.fill(0);
    this.leanFor.fill(0);
  }

  public update(
    dt: number,
    paddles: readonly Paddle[],
    particles: ParticleSystem,
    rally: number,
  ): void {
    this.fit(paddles.length);
    paddles.forEach((paddle, i) => {
      this._glow[i] = Math.max(0, this._glow[i] - dt * GLOW_DECAY);
      this._spent[i] = Math.max(0, this._spent[i] - dt * SPENT_DECAY);
      this.springBack(i, dt);
      this.emitSparks(dt, paddle, particles, rally);
    });
  }

  /**
   * Keeps a value for every paddle on court: a match may bring one more (an opponent's second),
   * which starts unlit and upright, and takes it away again.
   */
  private fit(count: number): void {
    for (const values of [
      this._glow,
      this._spent,
      this._tilt,
      this.tiltSpeed,
      this.lean,
      this.leanFor,
    ]) {
      while (values.length < count) values.push(0);
      values.length = count;
    }
  }

  /**
   * A critically damped spring taking a whipped paddle to its lean, then back upright once the
   * lean is held; sub-stepped so a long frame stays stable.
   */
  private springBack(i: number, dt: number): void {
    this.leanFor[i] = Math.max(0, this.leanFor[i] - dt);
    const target = this.leanFor[i] > 0 ? this.lean[i] : 0;
    if (target === 0 && this._tilt[i] === 0 && this.tiltSpeed[i] === 0) return;

    const steps = Math.ceil(dt / (1 / 240));
    const h = dt / steps;
    const rate = WHIP.RATE;
    for (let s = 0; s < steps; s++) {
      const pull = rate * rate * (target - this._tilt[i]) - 2 * rate * this.tiltSpeed[i];
      this.tiltSpeed[i] += pull * h;
      this._tilt[i] += this.tiltSpeed[i] * h;
    }
    if (target === 0 && Math.abs(this._tilt[i]) < 1e-3 && Math.abs(this.tiltSpeed[i]) < 1e-2) {
      this._tilt[i] = 0;
      this.tiltSpeed[i] = 0;
    }
  }

  /** Occasionally sheds a spark; more often while moving fast or deep into a rally. */
  private emitSparks(dt: number, paddle: Paddle, particles: ParticleSystem, rally: number): void {
    const isMovingFast = Math.abs(paddle.targetY - paddle.y) > 8;
    const movementMultiplier = isMovingFast ? 2 : 1;
    const sparkChance = dt * (6 + Math.min(rally, 20) * 1.2) * movementMultiplier;

    if (Math.random() < sparkChance) {
      const direction = paddle.side === 0 ? 1 : -1;

      particles.addParticle({
        x: paddle.side === 0 ? paddle.x + paddle.spec.width : paddle.x,
        y: paddle.y + (Math.random() - 0.5) * paddle.spec.height,
        vx: direction * randomRange(SPARK_SPEED_MIN, SPARK_SPEED_MAX),
        vy: (Math.random() - 0.5) * 50,
        life: 0.7,
        color: paddle.color,
        size: randomRange(1, 2.8),
      });
    }
  }
}
