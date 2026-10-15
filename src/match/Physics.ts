import { Ball } from '@/match/Ball';
import { COURT, PADDLE, BALL } from '@/match/config';
import { DifficultyConfig } from '@/match/difficulty';
import { Paddle } from '@/match/Paddle';
import { clamp } from '@/shared/math';

// Hit offset is normalized to [-1, 1] from paddle center to edge
const BOUNCE = {
  MAX_ANGLE: 1.1, // radians, reached at the very edge
  CURVE: 1.6, // >1 keeps mid hits flatter and sharpens edge hits
} as const;

// Paddle inertia: moving paddle nudges the outgoing angle, kept soft for jerky touch input
export const SPIN = {
  DEADZONE: 40, // px/s ignored as jitter
  REFERENCE_SPEED: 600, // px/s where the nudge reaches ~76% of max
  MAX_ANGLE: 0.2, // radians (~11°), saturates softly via tanh
} as const;

export const PERFECT_HIT = {
  ZONE: 0.15, // central share of the half-height that counts as perfect
  BOOST: 0.25, // temporary extra speed share right after a perfect hit
  BOOST_DURATION: 0.8, // seconds for the boost to fade out
} as const;

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

      const topBoundary = COURT.TOP_WALL + ball.radius;
      const bottomBoundary = COURT.HEIGHT - COURT.BOTTOM_WALL - ball.radius;

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
              ball.x - ball.radius <= paddle.x + PADDLE.WIDTH &&
              ball.x + ball.radius >= paddle.x
            : ball.vx > 0 &&
              ball.x + ball.radius >= paddle.x &&
              ball.x - ball.radius <= paddle.x + PADDLE.WIDTH;

        const isCollidingY = Math.abs(ball.y - paddle.y) <= PADDLE.HEIGHT / 2 + ball.radius * 0.8;

        if (isCollidingX && isCollidingY) {
          const hitOffset = clamp((ball.y - paddle.y) / (PADDLE.HEIGHT / 2), -1, 1);
          const isPerfect = Math.abs(hitOffset) <= PERFECT_HIT.ZONE;
          const bounceAngle = clamp(
            Physics.getBounceAngle(hitOffset) + Physics.getSpinAngle(paddle.velocity),
            -BOUNCE.MAX_ANGLE,
            BOUNCE.MAX_ANGLE,
          );
          const direction = i === 0 ? 1 : -1;

          ball.speed = Math.min(
            ball.speed * (1 + difficultyConfig.acceleration),
            difficultyConfig.maxSpeed,
          );

          if (isPerfect) {
            ball.applyBoost(PERFECT_HIT.BOOST, PERFECT_HIT.BOOST_DURATION);
          } else {
            ball.clearBoost();
          }
          ball.vx = direction * Math.cos(bounceAngle) * ball.speed;
          ball.vy = Math.sin(bounceAngle) * ball.speed;
          ball.x = i === 0 ? paddle.x + PADDLE.WIDTH + ball.radius : paddle.x - ball.radius;

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
      if (ball.x < -BALL.OUT_OF_BOUNDS_OFFSET) {
        events.push({ type: 'score', scoringPlayerIndex: 1, y: ball.y });
        return events;
      }
      if (ball.x > COURT.WIDTH + BALL.OUT_OF_BOUNDS_OFFSET) {
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
    return Math.sign(offset) * Math.pow(Math.abs(offset), BOUNCE.CURVE) * BOUNCE.MAX_ANGLE;
  }

  /**
   * Angle nudge from paddle motion at impact (positive velocity = down = steeper downward shot).
   * Small speeds are ignored and large ones saturate, so jerky touch input stays harmless.
   */
  public static getSpinAngle(paddleVelocity: number): number {
    const effective = Math.max(0, Math.abs(paddleVelocity) - SPIN.DEADZONE);
    return Math.sign(paddleVelocity) * Math.tanh(effective / SPIN.REFERENCE_SPEED) * SPIN.MAX_ANGLE;
  }
}
