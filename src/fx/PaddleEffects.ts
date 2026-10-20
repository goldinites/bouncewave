import { ParticleSystem } from '@/fx/ParticleSystem';
import { Paddle } from '@/match/Paddle';
import { randomRange } from '@/shared/math';

const GLOW_DECAY = 4; // 1/s, from a fresh hit (1) to unlit (0)
const SPARK_SPEED_MIN = 30;
const SPARK_SPEED_MAX = 100;
// A spinning hit (Arc) whips the paddle: it snaps over toward its motion, then springs back
// past upright and settles, like a racket swung through the ball
const WHIP = {
  MAX_ANGLE: 0.38, // rad (~22°), off the strongest spin
  MIN_SHARE: 0.4, // of MAX_ANGLE even off the gentlest, so it always reads
  STIFFNESS: 900, // 1/s², ~30 rad/s: a quick snap back
  DAMPING: 22, // 1/s: one overshoot of about a third, then still within ~0.4 s
} as const;

/**
 * Paddle neon: a glow that flares on every hit and fades, and the sparks a paddle sheds
 * while it moves. Presentation only; the paddles themselves are never changed.
 */
export class PaddleEffects {
  private readonly _glow: number[];
  private readonly _tilt: number[];
  private readonly tiltSpeed: number[];

  /** @param paddleCount how many paddles are on the court */
  constructor(paddleCount: number) {
    this._glow = new Array<number>(paddleCount).fill(0);
    this._tilt = new Array<number>(paddleCount).fill(0);
    this.tiltSpeed = new Array<number>(paddleCount).fill(0);
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
    this._tilt[paddleIndex] = turn * WHIP.MAX_ANGLE * share;
    this.tiltSpeed[paddleIndex] = 0;
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
    this._tilt.fill(0);
    this.tiltSpeed.fill(0);
  }

  public update(
    dt: number,
    paddles: readonly Paddle[],
    particles: ParticleSystem,
    rally: number,
  ): void {
    paddles.forEach((paddle, i) => {
      this._glow[i] = Math.max(0, this._glow[i] - dt * GLOW_DECAY);
      this.springBack(i, dt);
      this.emitSparks(dt, paddle, particles, rally);
    });
  }

  /** A damped spring pulling a whipped paddle upright; sub-stepped so a long frame stays stable. */
  private springBack(i: number, dt: number): void {
    if (this._tilt[i] === 0 && this.tiltSpeed[i] === 0) return;
    const steps = Math.ceil(dt / (1 / 240));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      this.tiltSpeed[i] += (-WHIP.STIFFNESS * this._tilt[i] - WHIP.DAMPING * this.tiltSpeed[i]) * h;
      this._tilt[i] += this.tiltSpeed[i] * h;
    }
    if (Math.abs(this._tilt[i]) < 1e-3 && Math.abs(this.tiltSpeed[i]) < 1e-2) {
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
