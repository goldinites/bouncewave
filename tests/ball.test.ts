import { describe, expect, it } from 'vitest';
import { Ball } from '@/match/Ball';
import { COURT, BALL } from '@/match/config';

describe('Ball', () => {
  it('serves ball towards direction with initial speed', () => {
    const ball = new Ball();
    ball.serve(1);

    expect(ball.x).toBe(COURT.WIDTH / 2);
    expect(ball.y).toBe(COURT.HEIGHT / 2);
    expect(ball.speed).toBe(BALL.INITIAL_SPEED);
    expect(ball.vx).toBeGreaterThan(0);
    expect(ball.trail).toEqual([]);
  });

  it('serves ball leftwards when direction is -1', () => {
    const ball = new Ball();
    ball.serve(-1);

    expect(ball.vx).toBeLessThan(0);
  });

  it('manages trail length without exceeding maximum', () => {
    const ball = new Ball();
    for (let i = 0; i < 20; i++) {
      ball.x = i * 10;
      ball.y = i * 5;
      ball.updateTrail();
    }

    expect(ball.trail.length).toBe(BALL.TRAIL_MAX_LENGTH);
    expect(ball.trail[ball.trail.length - 1]).toEqual({ x: 190, y: 95 });
  });

  it('fades a temporary boost out over its duration', () => {
    const ball = new Ball();
    ball.applyBoost(0.2, 1);

    expect(ball.speedMultiplier).toBeCloseTo(1.2);
    ball.updateBoost(0.5);
    expect(ball.speedMultiplier).toBeCloseTo(1.1);
    ball.updateBoost(0.6);
    expect(ball.speedMultiplier).toBe(1);
  });

  it('clears the boost on serve', () => {
    const ball = new Ball();
    ball.applyBoost(0.2, 1);
    ball.serve(1);

    expect(ball.speedMultiplier).toBe(1);
  });

  it('updates dynamic radius on high rally and speed', () => {
    const ball = new Ball();
    ball.speed = 800;

    const initialRadius = ball.radius;
    ball.updateRadius(0.1, 14, 920);

    expect(ball.radius).toBeGreaterThan(initialRadius);
    expect(ball.radius).toBeGreaterThan(BALL.INITIAL_RADIUS);
  });
});
