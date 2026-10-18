import { ParticleSystem } from '@/fx/ParticleSystem';
import { PADDLE } from '@/match/config';
import { Paddle } from '@/match/Paddle';
import { randomRange } from '@/shared/math';

const GLOW_DECAY = 4; // 1/s, from a fresh hit (1) to unlit (0)
const SPARK_SPEED_MIN = 30;
const SPARK_SPEED_MAX = 100;

/**
 * Paddle neon: a glow that flares on every hit and fades, and the sparks a paddle sheds
 * while it moves. Presentation only; the paddles themselves are never changed.
 */
export class PaddleEffects {
  private readonly _glow: number[];

  /** @param paddleCount how many paddles are on the court */
  constructor(paddleCount: number) {
    this._glow = new Array<number>(paddleCount).fill(0);
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
  }

  public update(
    dt: number,
    paddles: readonly Paddle[],
    particles: ParticleSystem,
    rally: number,
  ): void {
    paddles.forEach((paddle, i) => {
      this._glow[i] = Math.max(0, this._glow[i] - dt * GLOW_DECAY);
      this.emitSparks(dt, paddle, particles, rally);
    });
  }

  /** Occasionally sheds a spark; more often while moving fast or deep into a rally. */
  private emitSparks(dt: number, paddle: Paddle, particles: ParticleSystem, rally: number): void {
    const isMovingFast = Math.abs(paddle.targetY - paddle.y) > 8;
    const movementMultiplier = isMovingFast ? 2 : 1;
    const sparkChance = dt * (6 + Math.min(rally, 20) * 1.2) * movementMultiplier;

    if (Math.random() < sparkChance) {
      const direction = paddle.side === 0 ? 1 : -1;

      particles.addParticle({
        x: paddle.side === 0 ? paddle.x + PADDLE.WIDTH : paddle.x,
        y: paddle.y + (Math.random() - 0.5) * PADDLE.HEIGHT,
        vx: direction * randomRange(SPARK_SPEED_MIN, SPARK_SPEED_MAX),
        vy: (Math.random() - 0.5) * 50,
        life: 0.7,
        color: paddle.color,
        size: randomRange(1, 2.8),
      });
    }
  }
}
