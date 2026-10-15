import {
  BALL_INITIAL_SPEED,
  BALL_OUT_OF_BOUNDS_OFFSET,
  COLORS,
  COURT_BOTTOM_WALL,
  COURT_TOP_WALL,
  GAME_HEIGHT,
  GAME_WIDTH,
  PADDLE_BOUNCE_CURVE,
  PADDLE_HEIGHT,
  PADDLE_MAX_BOUNCE_ANGLE,
  PADDLE_SPIN_DEADZONE,
  PADDLE_SPIN_MAX_ANGLE,
  PADDLE_SPIN_REFERENCE_SPEED,
  PADDLE_WIDTH,
  PERFECT_HIT_BOOST,
  PERFECT_HIT_BOOST_DURATION,
  PERFECT_HIT_ZONE,
} from '@/constants/game.constants';
import {
  PARTICLE_HIT_BURST_COUNT_BASE,
  PARTICLE_PERFECT_BURST_COUNT,
  PARTICLE_PERFECT_BURST_SPEED,
  PERFECT_SHOCKWAVE_EXPANSION_SPEED,
  SCREEN_FLASH_PERFECT_HIT,
  SCREEN_SHAKE_PERFECT_BONUS,
  SHOCKWAVE_EXPANSION_SPEED,
} from '@/constants/visual.constants';
import { Ball } from '@/entities/Ball';
import { Paddle } from '@/entities/Paddle';
import { ParticleSystem } from '@/entities/ParticleSystem';
import { DifficultyConfig } from '@/types/difficulty.types';
import { GameMode } from '@/types/game.types';
import { clamp } from '@/utils/math';

export interface PhysicsCallbacks {
  onWallBounce: () => void;
  onPaddleHit: (paddleIndex: number, rally: number, isPerfect: boolean) => void;
  onScore: (scoringPlayerIndex: number) => void;
  onScreenShake: (amount: number) => void;
  onScreenFlash: (amount: number) => void;
}

export class Physics {
  public static updateBallMovement(
    ball: Ball,
    paddles: [Paddle, Paddle],
    particleSystem: ParticleSystem,
    difficultyConfig: DifficultyConfig,
    gameMode: GameMode,
    rallyRef: { current: number },
    dt: number,
    callbacks: PhysicsCallbacks,
  ): void {
    // Boost scales movement only; base speed (and acceleration progression) stays intact
    const speedMultiplier = ball.speedMultiplier;
    ball.updateBoost(dt);

    const subSteps = Math.ceil((ball.speed * speedMultiplier * dt) / 10);
    const subDt = (dt / subSteps) * speedMultiplier;

    for (let step = 0; step < subSteps; step++) {
      ball.x += ball.vx * subDt;
      ball.y += ball.vy * subDt;

      const topBoundary = COURT_TOP_WALL + ball.radius;
      const bottomBoundary = GAME_HEIGHT - COURT_BOTTOM_WALL - ball.radius;

      // Top wall collision
      if (ball.y < topBoundary) {
        ball.y = topBoundary;
        ball.vy = Math.abs(ball.vy);
        callbacks.onScreenShake(2);
        callbacks.onWallBounce();
      }

      // Bottom wall collision
      if (ball.y > bottomBoundary) {
        ball.y = bottomBoundary;
        ball.vy = -Math.abs(ball.vy);
        callbacks.onScreenShake(2);
        callbacks.onWallBounce();
      }

      // Paddle collisions
      for (let i = 0; i < 2; i++) {
        const paddle = paddles[i];
        const isCollidingX =
          i === 0
            ? ball.vx < 0 &&
              ball.x - ball.radius <= paddle.x + PADDLE_WIDTH &&
              ball.x + ball.radius >= paddle.x
            : ball.vx > 0 &&
              ball.x + ball.radius >= paddle.x &&
              ball.x - ball.radius <= paddle.x + PADDLE_WIDTH;

        const isCollidingY = Math.abs(ball.y - paddle.y) <= PADDLE_HEIGHT / 2 + ball.radius * 0.8;

        if (isCollidingX && isCollidingY) {
          const hitOffset = clamp((ball.y - paddle.y) / (PADDLE_HEIGHT / 2), -1, 1);
          const isPerfect = Math.abs(hitOffset) <= PERFECT_HIT_ZONE;
          const bounceAngle = clamp(
            Physics.getBounceAngle(hitOffset) + Physics.getSpinAngle(paddle.velocity),
            -PADDLE_MAX_BOUNCE_ANGLE,
            PADDLE_MAX_BOUNCE_ANGLE,
          );
          const direction = i === 0 ? 1 : -1;

          ball.speed = Math.min(
            ball.speed * (1 + difficultyConfig.acceleration),
            difficultyConfig.maxSpeed,
          );

          if (isPerfect) {
            ball.applyBoost(PERFECT_HIT_BOOST, PERFECT_HIT_BOOST_DURATION);
          } else {
            ball.clearBoost();
          }
          ball.vx = direction * Math.cos(bounceAngle) * ball.speed;
          ball.vy = Math.sin(bounceAngle) * ball.speed;
          ball.x = i === 0 ? paddle.x + PADDLE_WIDTH + ball.radius : paddle.x - ball.radius;

          paddle.glow = 1.0;
          rallyRef.current++;

          const shakeMagnitude =
            3 +
            (ball.speed - BALL_INITIAL_SPEED) / 90 +
            (isPerfect ? SCREEN_SHAKE_PERFECT_BONUS : 0);
          callbacks.onScreenShake(shakeMagnitude);

          const burstCount = PARTICLE_HIT_BURST_COUNT_BASE + Math.min(rallyRef.current, 20);
          particleSystem.burst(ball.x, ball.y, paddle.color, burstCount);
          particleSystem.shockwave(ball.x, ball.y, paddle.color, SHOCKWAVE_EXPANSION_SPEED);

          if (isPerfect) {
            particleSystem.burst(
              ball.x,
              ball.y,
              COLORS.WHITE,
              PARTICLE_PERFECT_BURST_COUNT,
              PARTICLE_PERFECT_BURST_SPEED,
            );
            particleSystem.shockwave(
              ball.x,
              ball.y,
              COLORS.WHITE,
              PERFECT_SHOCKWAVE_EXPANSION_SPEED,
            );
            callbacks.onScreenFlash(SCREEN_FLASH_PERFECT_HIT);
          }

          // Update opponent's AI prediction error
          const opponent = paddles[1 - i];
          const maxError = gameMode === GameMode.DEMO ? 80 : difficultyConfig.error;
          opponent.errorOffset = (Math.random() - 0.5) * maxError;

          callbacks.onPaddleHit(i, rallyRef.current, isPerfect);
          break;
        }
      }

      // Out of bounds / score check
      if (ball.x < -BALL_OUT_OF_BOUNDS_OFFSET) {
        callbacks.onScore(1); // Player 2 scores
        return;
      }
      if (ball.x > GAME_WIDTH + BALL_OUT_OF_BOUNDS_OFFSET) {
        callbacks.onScore(0); // Player 1 scores
        return;
      }
    }
  }

  /**
   * Maps a normalized hit offset ([-1, 1]) to an outgoing angle.
   * The curve keeps center hits nearly straight and reserves steep angles for edge hits.
   */
  public static getBounceAngle(hitOffset: number): number {
    const offset = clamp(hitOffset, -1, 1);
    return (
      Math.sign(offset) * Math.pow(Math.abs(offset), PADDLE_BOUNCE_CURVE) * PADDLE_MAX_BOUNCE_ANGLE
    );
  }

  /**
   * Angle nudge from paddle motion at impact (positive velocity = down = steeper downward shot).
   * Small speeds are ignored and large ones saturate, so jerky touch input stays harmless.
   */
  public static getSpinAngle(paddleVelocity: number): number {
    const effective = Math.max(0, Math.abs(paddleVelocity) - PADDLE_SPIN_DEADZONE);
    return (
      Math.sign(paddleVelocity) *
      Math.tanh(effective / PADDLE_SPIN_REFERENCE_SPEED) *
      PADDLE_SPIN_MAX_ANGLE
    );
  }
}
