import { describe, expect, it } from 'vitest';
import { DRAMA, MatchPointDrama } from '@/fx/MatchPointDrama';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE, WINNING_SCORE } from '@/match/config';
import { Paddle } from '@/match/Paddle';

const DECIDING = WINNING_SCORE - 1;
const FRAME = 0.016;

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

/** Runs the drama for `seconds` and returns the times (s) at which heartbeats fell. */
const run = (
  drama: MatchPointDrama,
  seconds: number,
  ...args: [boolean, Ball, [Paddle, Paddle]]
): number[] => {
  const beats: number[] = [];
  const steps = Math.round(seconds / FRAME);
  for (let i = 0; i < steps; i++) {
    if (drama.update(FRAME, ...args)) beats.push((i + 1) * FRAME);
  }
  return beats;
};

describe('MatchPointDrama', () => {
  it('only counts as deciding when both sides are one point from winning', () => {
    expect(MatchPointDrama.isDecidingPoint(setup(DECIDING, DECIDING).paddles)).toBe(true);
    expect(MatchPointDrama.isDecidingPoint(setup(DECIDING, 3).paddles)).toBe(false);
    expect(MatchPointDrama.isDecidingPoint(setup(3, DECIDING).paddles)).toBe(false);
  });

  it('stays idle when only one side is on match point', () => {
    const { ball, paddles, left } = setup(3, DECIDING);
    ball.x = left.x - ball.radius - 1;
    const drama = new MatchPointDrama();

    expect(run(drama, 1, true, ball, paddles)).toEqual([]);
    expect(drama.level).toBe(0);
    expect(drama.timeScale).toBe(1);
  });

  it('builds tension on the deciding point without slowing time', () => {
    const { ball, paddles } = setup(DECIDING, DECIDING);
    const drama = new MatchPointDrama();
    run(drama, 2, true, ball, paddles);

    expect(drama.level).toBeCloseTo(DRAMA.LEVEL, 2);
    expect(drama.timeScale).toBe(1);
    expect(drama.zoom).toBe(1);
  });

  it('beats a heart that quickens as the deciding rally goes on', () => {
    const { ball, paddles } = setup(DECIDING, DECIDING);
    const beats = run(new MatchPointDrama(), 12, true, ball, paddles);

    expect(beats[0]).toBeCloseTo(DRAMA.HEARTBEAT_FIRST, 1);
    const firstGap = beats[1] - beats[0];
    const lastGap = beats.at(-1)! - beats.at(-2)!;
    expect(firstGap).toBeCloseTo(DRAMA.HEARTBEAT_START_INTERVAL, 1);
    expect(lastGap).toBeCloseTo(DRAMA.HEARTBEAT_MIN_INTERVAL, 1);
  });

  it('pulses the vignette on each beat', () => {
    const { ball, paddles } = setup(DECIDING, DECIDING);
    const drama = new MatchPointDrama();

    run(drama, DRAMA.HEARTBEAT_FIRST + FRAME, true, ball, paddles);
    expect(drama.vignette).toBeGreaterThan(drama.level + DRAMA.BEAT_PULSE * 0.8);
  });

  it('detects a ball past either paddle, in the direction it is flying', () => {
    const { ball, paddles, left, right } = setup(DECIDING, DECIDING);

    ball.x = left.x + PADDLE.WIDTH + 20;
    expect(MatchPointDrama.isBallPastPaddle(ball, paddles)).toBe(false);

    ball.x = left.x - ball.radius - 1;
    expect(MatchPointDrama.isBallPastPaddle(ball, paddles)).toBe(true);

    ball.vx = 400;
    ball.x = right.x + PADDLE.WIDTH + ball.radius + 1;
    expect(MatchPointDrama.isBallPastPaddle(ball, paddles)).toBe(true);
  });

  it('slows time, zooms in and stops the heart once the deciding ball is past', () => {
    const { ball, paddles, left } = setup(DECIDING, DECIDING);
    const drama = new MatchPointDrama();
    run(drama, 1, true, ball, paddles);

    ball.x = left.x - ball.radius - 1;
    const beats = run(drama, 1, true, ball, paddles);

    expect(beats).toEqual([]);
    expect(drama.timeScale).toBeCloseTo(DRAMA.SLOWMO_SCALE, 2);
    expect(drama.zoom).toBeCloseTo(1 + DRAMA.ZOOM, 2);
    expect(drama.level).toBeGreaterThan(0.95);
  });

  it('holds the slow motion until the point is over, but never past the limit', () => {
    const { ball, paddles, left } = setup(DECIDING, DECIDING);
    const drama = new MatchPointDrama();
    ball.x = left.x - ball.radius - 1;

    run(drama, DRAMA.SLOWMO_MAX_DURATION - 0.2, true, ball, paddles);
    expect(drama.timeScale).toBeLessThan(DRAMA.SLOWMO_SCALE + 0.01);

    run(drama, 1, true, ball, paddles);
    expect(drama.timeScale).toBeGreaterThan(0.99);
  });

  it('does nothing in demo or menu', () => {
    const { ball, paddles, left } = setup(DECIDING, DECIDING);
    const drama = new MatchPointDrama();
    ball.x = left.x - ball.radius - 1;

    expect(run(drama, 1, false, ball, paddles)).toEqual([]);
    expect(drama.level).toBe(0);
    expect(drama.timeScale).toBe(1);
  });

  it('reset drops all effects at once', () => {
    const { ball, paddles, left } = setup(DECIDING, DECIDING);
    const drama = new MatchPointDrama();
    ball.x = left.x - ball.radius - 1;
    run(drama, 0.3, true, ball, paddles);

    drama.reset();
    expect(drama.level).toBe(0);
    expect(drama.vignette).toBe(0);
    expect(drama.timeScale).toBe(1);
    expect(drama.zoom).toBe(1);
  });
});
