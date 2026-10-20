import { Ball } from '@/match/Ball';
import { COURT, BALL } from '@/match/config';
import { DifficultyConfig } from '@/match/difficulty';
import { Paddle } from '@/match/Paddle';
import { Side } from '@/match/side';
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

// What a perfect hit does; how big the perfect zone is depends on the paddle (PaddleSpec)
export const PERFECT_HIT = {
  BOOST: 0.25, // temporary extra speed share right after a perfect hit
  BOOST_DURATION: 0.8, // seconds for the boost to fade out
  // A center hit alone goes out flat, the easiest ball to return; a perfect one lets the
  // paddle's motion steer it much harder (up to ~60° instead of ~11°), and already at a modest
  // paddle speed, so it can be aimed
  SPIN_MAX_ANGLE: 1.05,
  SPIN_REFERENCE_SPEED: 300, // px/s where the steer reaches ~76% of its max
} as const;

/** Something that happened to the ball during a physics step, in the order it happened. */
export type PhysicsEvent =
  | { type: 'wallBounce'; x: number; y: number }
  | {
      type: 'paddleHit';
      /** Which of the paddles hit it (an index into the list `step` was given). */
      paddleIndex: number;
      isPerfect: boolean;
      x: number;
      y: number;
      /** Ball speed right after the hit (acceleration applied). */
      speed: number;
    }
  | { type: 'score'; scoringPlayerIndex: Side; y: number };

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
    paddles: readonly Paddle[],
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
      // A spinning ball's path turns with time, not with distance: a boost doesn't bend it more
      if (ball.spin !== 0) Physics.turn(ball, dt / subSteps);
      ball.x += ball.vx * subDt;
      ball.y += ball.vy * subDt;

      const topBoundary = COURT.TOP_WALL + ball.radius;
      const bottomBoundary = COURT.HEIGHT - COURT.BOTTOM_WALL - ball.radius;

      // Top wall collision
      if (ball.y < topBoundary) {
        ball.y = topBoundary;
        ball.vy = Math.abs(ball.vy);
        ball.spin = 0;
        events.push({ type: 'wallBounce', x: ball.x, y: ball.y });
      }

      // Bottom wall collision
      if (ball.y > bottomBoundary) {
        ball.y = bottomBoundary;
        ball.vy = -Math.abs(ball.vy);
        ball.spin = 0;
        events.push({ type: 'wallBounce', x: ball.x, y: ball.y });
      }

      // Paddle collisions
      for (let i = 0; i < paddles.length; i++) {
        const paddle = paddles[i];
        const spec = paddle.spec;
        const isLeft = paddle.side === 0;
        const isCollidingX = isLeft
          ? ball.vx < 0 &&
            ball.x - ball.radius <= paddle.x + spec.width &&
            ball.x + ball.radius >= paddle.x
          : ball.vx > 0 &&
            ball.x + ball.radius >= paddle.x &&
            ball.x - ball.radius <= paddle.x + spec.width;

        const isCollidingY = Math.abs(ball.y - paddle.y) <= spec.height / 2 + ball.radius * 0.8;

        if (isCollidingX && isCollidingY) {
          const hitOffset = clamp((ball.y - paddle.y) / (spec.height / 2), -1, 1);
          const isPerfect = Math.abs(hitOffset) <= spec.perfectZone * paddle.perfectZoneScale;
          const steer = isPerfect
            ? Physics.getSpinAngle(
                paddle.velocity,
                PERFECT_HIT.SPIN_MAX_ANGLE,
                PERFECT_HIT.SPIN_REFERENCE_SPEED,
              )
            : Physics.getSpinAngle(paddle.velocity);
          const spin = steer * spec.spin;
          const bounceAngle = clamp(
            Physics.getBounceAngle(hitOffset) + spin,
            -BOUNCE.MAX_ANGLE,
            BOUNCE.MAX_ANGLE,
          );
          const direction = isLeft ? 1 : -1;

          ball.speed = Math.min(
            ball.speed * (1 + difficultyConfig.acceleration * spec.power),
            difficultyConfig.maxSpeed,
          );

          if (isPerfect) {
            ball.applyBoost(PERFECT_HIT.BOOST, PERFECT_HIT.BOOST_DURATION);
          } else {
            ball.clearBoost();
          }
          ball.vx = direction * Math.cos(bounceAngle) * ball.speed;
          ball.vy = Math.sin(bounceAngle) * ball.speed;
          ball.spin = 0;
          ball.x = isLeft ? paddle.x + spec.width + ball.radius : paddle.x - ball.radius;

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
   * Turns a spinning ball's flight by its spin over `dt` seconds, keeping its speed, and fades
   * the spin. A path never turns steeper than a paddle can send it: there the spin is spent, so
   * the ball neither turns back toward its hitter nor crawls along a wall.
   */
  private static turn(ball: Ball, dt: number): void {
    const angle = ball.spin * dt;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const vx = ball.vx * cos - ball.vy * sin;
    const vy = ball.vx * sin + ball.vy * cos;
    const steepness = Math.atan2(Math.abs(vy), Math.abs(vx));

    if (Math.sign(vx) !== Math.sign(ball.vx) || steepness > BOUNCE.MAX_ANGLE) {
      ball.spin = 0;
      return;
    }
    ball.vx = vx;
    ball.vy = vy;
    ball.spin *= Math.exp(-ball.spinDecay * dt);
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
   * @param maxAngle what it saturates at: SPIN.MAX_ANGLE, or more on a perfect hit
   * @param referenceSpeed paddle speed where it reaches ~76% of `maxAngle`
   */
  public static getSpinAngle(
    paddleVelocity: number,
    maxAngle: number = SPIN.MAX_ANGLE,
    referenceSpeed: number = SPIN.REFERENCE_SPEED,
  ): number {
    const effective = Math.max(0, Math.abs(paddleVelocity) - SPIN.DEADZONE);
    return Math.sign(paddleVelocity) * Math.tanh(effective / referenceSpeed) * maxAngle;
  }
}
