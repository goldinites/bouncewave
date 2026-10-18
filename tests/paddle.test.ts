import { describe, expect, it } from 'vitest';
import { COURT, PADDLE } from '@/match/config';
import { Paddle } from '@/match/Paddle';

describe('Paddle', () => {
  it('initializes with centered position', () => {
    const paddle = new Paddle(0, 34, '#19f0ff');
    expect(paddle.x).toBe(34);
    expect(paddle.y).toBe(COURT.HEIGHT / 2);
    expect(paddle.targetY).toBe(COURT.HEIGHT / 2);
    expect(paddle.score).toBe(0);
  });

  it('clamps target position within margins', () => {
    const paddle = new Paddle(0, 34, '#19f0ff');

    // Attempt to set position beyond top boundary
    paddle.setTargetY(-100);
    const minY = PADDLE.TOP_MARGIN + PADDLE.HEIGHT / 2;
    expect(paddle.targetY).toBe(minY);

    // Attempt to set position beyond bottom boundary
    paddle.setTargetY(COURT.HEIGHT + 100);
    const maxY = COURT.HEIGHT - PADDLE.BOTTOM_MARGIN - PADDLE.HEIGHT / 2;
    expect(paddle.targetY).toBe(maxY);
  });

  it('updates position towards targetY smoothly', () => {
    const paddle = new Paddle(0, 34, '#19f0ff');
    paddle.y = 100;
    paddle.targetY = 200;

    paddle.update(0.016);

    expect(paddle.y).toBeGreaterThan(100);
    expect(paddle.y).toBeLessThan(200);
  });

  it('tracks smoothed velocity in the direction of motion', () => {
    const paddle = new Paddle(0, 34, '#19f0ff');
    paddle.targetY = 400;

    for (let i = 0; i < 5; i++) paddle.update(0.016);
    expect(paddle.velocity).toBeGreaterThan(0);

    paddle.targetY = 100;
    for (let i = 0; i < 30; i++) paddle.update(0.016);
    expect(paddle.velocity).toBeLessThan(0);
  });

  it('damps a single-frame jump instead of passing it through', () => {
    const paddle = new Paddle(0, 34, '#19f0ff');
    paddle.targetY = paddle.y + 200; // a jerky touch jump

    paddle.update(0.016);
    const rawSpeed = (paddle.y - COURT.HEIGHT / 2) / 0.016;
    expect(paddle.velocity).toBeLessThan(rawSpeed * 0.25);
  });

  it('resets score and position', () => {
    const paddle = new Paddle(0, 34, '#19f0ff');
    paddle.score = 5;
    paddle.y = 300;
    paddle.targetY = 300;

    paddle.resetScore();
    expect(paddle.score).toBe(0);
    expect(paddle.y).toBe(COURT.HEIGHT / 2);
    expect(paddle.targetY).toBe(COURT.HEIGHT / 2);
  });

  it('is drawn between where the last step began and where it ended', () => {
    const paddle = new Paddle(0, 34, '#19f0ff');
    paddle.rememberPosition();
    paddle.y += 40;

    paddle.interpolate(0.5);
    expect(paddle.drawY).toBe(COURT.HEIGHT / 2 + 20);
  });

  it('is drawn at the center straight after a reset', () => {
    const paddle = new Paddle(0, 34, '#19f0ff');
    paddle.y = 100;
    paddle.rememberPosition();
    paddle.resetPosition();

    paddle.interpolate(0.5);
    expect(paddle.drawY).toBe(COURT.HEIGHT / 2);
  });
});
