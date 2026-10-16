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

  it('takes the serve angle from the random source it is given', () => {
    const ball = new Ball();
    ball.serve(1, BALL.INITIAL_SPEED, () => 0.5);

    expect(ball.vy).toBe(0);
    expect(ball.vx).toBe(BALL.INITIAL_SPEED);
  });

  it('serves ball leftwards when direction is -1', () => {
    const ball = new Ball();
    ball.serve(-1);

    expect(ball.vx).toBeLessThan(0);
  });

  it('keeps nine points of trail at 60 fps, newest last', () => {
    const ball = new Ball();
    for (let i = 0; i < 20; i++) {
      ball.x = i * 10;
      ball.y = i * 5;
      ball.updateTrail(1 / 60);
    }

    expect(ball.trail.length).toBe(9);
    expect(ball.trail[ball.trail.length - 1]).toEqual({ x: 190, y: 95 });
  });

  it('draws a trail of the same length at any frame rate', () => {
    // A ball flying right at 600 px/s, a second at each frame rate
    const trailLength = (fps: number) => {
      const ball = new Ball();
      for (let i = 0; i <= fps; i++) {
        ball.x = (i / fps) * 600;
        ball.updateTrail(1 / fps);
      }
      return ball.trail[ball.trail.length - 1].x - ball.trail[0].x;
    };

    expect(trailLength(120)).toBeCloseTo(trailLength(60), -1);
    expect(trailLength(30)).toBeCloseTo(trailLength(60), -1);
    expect(trailLength(60)).toBeLessThanOrEqual(BALL.TRAIL_DURATION * 600);
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
