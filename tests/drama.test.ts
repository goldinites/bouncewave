import { describe, expect, it } from 'vitest';
import { DRAMA, MatchPointDrama } from '@/fx/MatchPointDrama';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE, WINNING_SCORE } from '@/match/config';
import { Paddle } from '@/match/Paddle';

const setup = (leftScore: number, rightScore: number) => {
  const left = new Paddle(0, PADDLE.OFFSET_X, '#19f0ff');
  const right = new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6');
  left.score = leftScore;
  right.score = rightScore;
  const paddles: [Paddle, Paddle] = [left, right];

  const ball = new Ball();
  ball.x = COURT.WIDTH / 2;
  ball.vx = -400;
  return { ball, paddles, left, right };
};

const run = (
  drama: MatchPointDrama,
  seconds: number,
  ...args: [boolean, Ball, [Paddle, Paddle]]
) => {
  const steps = Math.round(seconds / 0.016);
  for (let i = 0; i < steps; i++) drama.update(0.016, ...args);
};

describe('MatchPointDrama', () => {
  it('stays idle outside match point', () => {
    const { ball, paddles } = setup(0, 0);
    const drama = new MatchPointDrama();
    run(drama, 1, true, ball, paddles);

    expect(drama.level).toBe(0);
    expect(drama.timeScale).toBe(1);
  });

  it('builds subtle tension on match point without slowing time', () => {
    const { ball, paddles } = setup(0, WINNING_SCORE - 1);
    const drama = new MatchPointDrama();
    run(drama, 1, true, ball, paddles);

    expect(drama.level).toBeCloseTo(DRAMA.MATCH_POINT_LEVEL, 2);
    expect(drama.timeScale).toBe(1);
  });

  it('detects the deciding ball only once it is behind the defender', () => {
    const { ball, paddles, left } = setup(0, WINNING_SCORE - 1);

    ball.x = left.x + PADDLE.WIDTH + 20;
    expect(MatchPointDrama.isDecidingBallPast(ball, paddles)).toBe(false);

    ball.x = left.x - ball.radius - 1;
    expect(MatchPointDrama.isDecidingBallPast(ball, paddles)).toBe(true);

    // Ball heading away from the endangered side never counts
    ball.vx = 400;
    expect(MatchPointDrama.isDecidingBallPast(ball, paddles)).toBe(false);
  });

  it('ignores a ball past the paddle of a player who is not facing match point', () => {
    const { ball, paddles, left } = setup(WINNING_SCORE - 1, 0);
    ball.x = left.x - ball.radius - 1;
    ball.vx = -400;

    expect(MatchPointDrama.isDecidingBallPast(ball, paddles)).toBe(false);
  });

  it('briefly slows time for the deciding ball, then recovers', () => {
    const { ball, paddles, left } = setup(0, WINNING_SCORE - 1);
    const drama = new MatchPointDrama();
    ball.x = left.x - ball.radius - 1;

    run(drama, 0.3, true, ball, paddles);
    expect(drama.timeScale).toBeLessThan(DRAMA.SLOWMO_SCALE + 0.05);
    expect(drama.level).toBeGreaterThan(0.8);

    run(drama, DRAMA.SLOWMO_DURATION + 0.5, true, ball, paddles);
    expect(drama.timeScale).toBeGreaterThan(0.99);
  });

  it('does nothing in demo or menu', () => {
    const { ball, paddles, left } = setup(0, WINNING_SCORE - 1);
    const drama = new MatchPointDrama();
    ball.x = left.x - ball.radius - 1;
    run(drama, 0.3, false, ball, paddles);

    expect(drama.level).toBe(0);
    expect(drama.timeScale).toBe(1);
  });

  it('reset drops all effects at once', () => {
    const { ball, paddles, left } = setup(0, WINNING_SCORE - 1);
    const drama = new MatchPointDrama();
    ball.x = left.x - ball.radius - 1;
    run(drama, 0.2, true, ball, paddles);

    drama.reset();
    expect(drama.level).toBe(0);
    expect(drama.timeScale).toBe(1);
  });
});
