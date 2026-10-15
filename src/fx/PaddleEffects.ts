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
  private readonly _glow: [number, number] = [0, 0];

  /** Hit glow of each paddle in [0, 1]. */
  public get glow(): readonly [number, number] {
    return this._glow;
  }

  public onHit(paddleIndex: 0 | 1): void {
    this._glow[paddleIndex] = 1;
  }

  public reset(): void {
    this._glow.fill(0);
  }

  public update(
    dt: number,
    paddles: [Paddle, Paddle],
    particles: ParticleSystem,
    rally: number,
  ): void {
    for (const paddle of paddles) {
      this._glow[paddle.index] = Math.max(0, this._glow[paddle.index] - dt * GLOW_DECAY);
      this.emitSparks(dt, paddle, particles, rally);
    }
  }

  /** Occasionally sheds a spark; more often while moving fast or deep into a rally. */
  private emitSparks(dt: number, paddle: Paddle, particles: ParticleSystem, rally: number): void {
    const isMovingFast = Math.abs(paddle.targetY - paddle.y) > 8;
    const movementMultiplier = isMovingFast ? 2 : 1;
    const sparkChance = dt * (6 + Math.min(rally, 20) * 1.2) * movementMultiplier;

    if (Math.random() < sparkChance) {
      const direction = paddle.index === 0 ? 1 : -1;

      particles.addParticle({
        x: paddle.index === 0 ? paddle.x + PADDLE.WIDTH : paddle.x,
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
