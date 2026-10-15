import {
  BALL_OUT_OF_BOUNDS_OFFSET,
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
import { Ball } from '@/entities/Ball';
import { Paddle } from '@/entities/Paddle';
import { DifficultyConfig } from '@/types/difficulty.types';
import { clamp } from '@/utils/math';

/** Something that happened to the ball during a physics step, in the order it happened. */
export type PhysicsEvent =
  | { type: 'wallBounce'; x: number; y: number }
  | {
      type: 'paddleHit';
      paddleIndex: 0 | 1;
      isPerfect: boolean;
      x: number;
      y: number;
      /** Ball speed right after the hit (acceleration applied). */
      speed: number;
    }
  | { type: 'score'; scoringPlayerIndex: 0 | 1; y: number };

/**
 * Ball movement and collisions only. It changes the ball, and nothing else: effects, sound,
 * rally counting and AI reactions belong to whoever handles the returned events.
 */
export class Physics {
  /**
   * Advances the ball by `dt` with sub-stepping so fast balls never tunnel through paddles.
   * Stops early on a score; the ball is then out of bounds until the next serve.
   */
  public static step(
    ball: Ball,
    paddles: [Paddle, Paddle],
    difficultyConfig: DifficultyConfig,
    dt: number,
  ): PhysicsEvent[] {
    const events: PhysicsEvent[] = [];

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
        events.push({ type: 'wallBounce', x: ball.x, y: ball.y });
      }

      // Bottom wall collision
      if (ball.y > bottomBoundary) {
        ball.y = bottomBoundary;
        ball.vy = -Math.abs(ball.vy);
        events.push({ type: 'wallBounce', x: ball.x, y: ball.y });
      }

      // Paddle collisions
      for (const i of [0, 1] as const) {
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

          events.push({
            type: 'paddleHit',
            paddleIndex: i,
            isPerfect,
            x: ball.x,
            y: ball.y,
            speed: ball.speed,
          });
          break;
        }
      }

      // Out of bounds / score check
      if (ball.x < -BALL_OUT_OF_BOUNDS_OFFSET) {
        events.push({ type: 'score', scoringPlayerIndex: 1, y: ball.y });
        return events;
      }
      if (ball.x > GAME_WIDTH + BALL_OUT_OF_BOUNDS_OFFSET) {
        events.push({ type: 'score', scoringPlayerIndex: 0, y: ball.y });
        return events;
      }
    }

    return events;
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
