import { describe, expect, it } from 'vitest';
import { DIFFICULTY_CONFIGS } from '@/constants/difficulty.constants';
import {
  COURT_BOTTOM_WALL,
  COURT_TOP_WALL,
  GAME_HEIGHT,
  GAME_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_OFFSET_X,
  PADDLE_SPIN_DEADZONE,
  PADDLE_SPIN_MAX_ANGLE,
  PADDLE_WIDTH,
  PERFECT_HIT_BOOST,
  PERFECT_HIT_BOOST_DURATION,
} from '@/constants/game.constants';
import { Physics, PhysicsEvent } from '@/match/Physics';
import { Ball } from '@/entities/Ball';
import { Paddle } from '@/entities/Paddle';
import { DifficultyLevel } from '@/types/difficulty.types';

const NORMAL = DIFFICULTY_CONFIGS[DifficultyLevel.NORMAL];

const makePaddles = (): [Paddle, Paddle] => [
  new Paddle(0, PADDLE_OFFSET_X, '#19f0ff'),
  new Paddle(1, GAME_WIDTH - PADDLE_OFFSET_X - PADDLE_WIDTH, '#ff2bd6'),
];

const ofType = <T extends PhysicsEvent['type']>(events: PhysicsEvent[], type: T) =>
  events.filter((e): e is Extract<PhysicsEvent, { type: T }> => e.type === type);

/** Ball heading into the left paddle (centered at y = 250), `offsetY` from its center. */
const hitLeftPaddleAt = (offsetY: number, paddleVelocity = 0) => {
  const ball = new Ball();
  const paddles = makePaddles();
  const [left] = paddles;

  left.y = 250;
  left.targetY = 250;
  left.velocity = paddleVelocity;

  ball.x = left.x + PADDLE_WIDTH + 2;
  ball.y = 250 + offsetY;
  ball.vx = -400;
  ball.vy = 0;
  ball.speed = 400;

  const events = Physics.step(ball, paddles, NORMAL, 0.001);
  return { ball, paddles, events };
};

describe('Physics.step', () => {
  it('bounces off the top wall and reports it', () => {
    const ball = new Ball();
    ball.x = 400;
    ball.y = COURT_TOP_WALL + 5;
    ball.vy = -300;
    ball.vx = 200;

    const events = Physics.step(ball, makePaddles(), NORMAL, 0.016);

    expect(ball.vy).toBeGreaterThan(0);
    expect(ofType(events, 'wallBounce')).toHaveLength(1);
  });

  it('bounces off the bottom wall and reports it', () => {
    const ball = new Ball();
    ball.x = 400;
    ball.y = GAME_HEIGHT - COURT_BOTTOM_WALL - 5;
    ball.vy = 300;
    ball.vx = 200;

    const events = Physics.step(ball, makePaddles(), NORMAL, 0.016);

    expect(ball.vy).toBeLessThan(0);
    expect(ofType(events, 'wallBounce')).toHaveLength(1);
  });

  it('returns a ball off the left paddle, accelerates it and reports the hit', () => {
    const { ball, events } = hitLeftPaddleAt(0);
    const [hit] = ofType(events, 'paddleHit');

    expect(ball.vx).toBeGreaterThan(0);
    expect(ball.speed).toBeGreaterThan(400);
    expect(hit).toMatchObject({ paddleIndex: 0, isPerfect: true, speed: ball.speed });
  });

  it('only moves the ball: paddles, glow and AI aim are left to the caller', () => {
    const { paddles } = hitLeftPaddleAt(0);

    expect(paddles[0].glow).toBe(0);
    expect(paddles[1].errorOffset).toBe(0);
  });

  it('rewards a center hit with a temporary boost and marks it perfect', () => {
    const perfect = hitLeftPaddleAt(0);
    const offCenter = hitLeftPaddleAt(PADDLE_HEIGHT * 0.2);

    // Base speed progression is identical; only the temporary boost differs
    expect(perfect.ball.speed).toBe(offCenter.ball.speed);
    expect(perfect.ball.speedMultiplier).toBeCloseTo(1 + PERFECT_HIT_BOOST);
    expect(offCenter.ball.speedMultiplier).toBe(1);
    expect(ofType(offCenter.events, 'paddleHit')[0].isPerfect).toBe(false);
  });

  it('moves a boosted ball further per frame', () => {
    const run = (boosted: boolean) => {
      const ball = new Ball();
      ball.x = 400;
      ball.y = 250;
      ball.vx = 400;
      ball.vy = 0;
      ball.speed = 400;
      if (boosted) ball.applyBoost(PERFECT_HIT_BOOST, PERFECT_HIT_BOOST_DURATION);

      Physics.step(ball, makePaddles(), NORMAL, 0.016);
      return ball.x - 400;
    };

    expect(run(true)).toBeCloseTo(run(false) * (1 + PERFECT_HIT_BOOST));
  });

  it('sends edge hits out at a sharper angle than mid hits', () => {
    const mid = hitLeftPaddleAt(PADDLE_HEIGHT * 0.25);
    const edge = hitLeftPaddleAt(PADDLE_HEIGHT * 0.48);

    const angleOf = (b: Ball) => Math.abs(Math.atan2(b.vy, b.vx));
    expect(angleOf(edge.ball)).toBeGreaterThan(angleOf(mid.ball) * 2);
  });

  it('a paddle moving down sends a center hit downward', () => {
    const { ball } = hitLeftPaddleAt(0, 500);

    expect(ball.vx).toBeGreaterThan(0);
    expect(ball.vy).toBeGreaterThan(0);
  });

  it('reports a score and stops once the ball leaves the field', () => {
    const ball = new Ball();
    ball.x = -35;
    ball.vx = -500;

    const events = Physics.step(ball, makePaddles(), NORMAL, 0.016);

    expect(events.at(-1)).toMatchObject({ type: 'score', scoringPlayerIndex: 1 });
    expect(ofType(events, 'score')).toHaveLength(1);
  });
});

describe('Physics angles', () => {
  it('maps hit offset to a symmetric, monotonic bounce angle', () => {
    expect(Physics.getBounceAngle(0)).toBe(0);
    expect(Physics.getBounceAngle(-0.5)).toBeCloseTo(-Physics.getBounceAngle(0.5));
    expect(Physics.getBounceAngle(1)).toBeGreaterThan(Physics.getBounceAngle(0.5));
    expect(Physics.getBounceAngle(2)).toBe(Physics.getBounceAngle(1));
  });

  it('ignores tiny paddle speeds and caps the spin nudge', () => {
    expect(Physics.getSpinAngle(0)).toBe(0);
    expect(Physics.getSpinAngle(PADDLE_SPIN_DEADZONE)).toBe(0);
    expect(Physics.getSpinAngle(300)).toBeGreaterThan(0);
    expect(Physics.getSpinAngle(-300)).toBeCloseTo(-Physics.getSpinAngle(300));
    expect(Physics.getSpinAngle(100000)).toBeLessThanOrEqual(PADDLE_SPIN_MAX_ANGLE);
  });
});
