import { describe, expect, it } from 'vitest';
import {
  GAME_HEIGHT,
  PADDLE_BOTTOM_MARGIN,
  PADDLE_HEIGHT,
  PADDLE_TOP_MARGIN,
} from '@/constants/game.constants';
import { Paddle } from '@/entities/Paddle';
import { ParticleSystem } from '@/entities/ParticleSystem';

describe('Paddle', () => {
  it('initializes with centered position', () => {
    const paddle = new Paddle(0, 34, '#19f0ff');
    expect(paddle.x).toBe(34);
    expect(paddle.y).toBe(GAME_HEIGHT / 2);
    expect(paddle.targetY).toBe(GAME_HEIGHT / 2);
    expect(paddle.score).toBe(0);
  });

  it('clamps target position within margins', () => {
    const paddle = new Paddle(0, 34, '#19f0ff');

    // Attempt to set position beyond top boundary
    paddle.setTargetY(-100);
    const minY = PADDLE_TOP_MARGIN + PADDLE_HEIGHT / 2;
    expect(paddle.targetY).toBe(minY);

    // Attempt to set position beyond bottom boundary
    paddle.setTargetY(GAME_HEIGHT + 100);
    const maxY = GAME_HEIGHT - PADDLE_BOTTOM_MARGIN - PADDLE_HEIGHT / 2;
    expect(paddle.targetY).toBe(maxY);
  });

  it('updates position towards targetY smoothly', () => {
    const paddle = new Paddle(0, 34, '#19f0ff');
    paddle.y = 100;
    paddle.targetY = 200;

    const particles = new ParticleSystem();
    paddle.update(0.016, particles, 0);

    expect(paddle.y).toBeGreaterThan(100);
    expect(paddle.y).toBeLessThan(200);
  });

  it('resets score and position', () => {
    const paddle = new Paddle(0, 34, '#19f0ff');
    paddle.score = 5;
    paddle.y = 300;
    paddle.targetY = 300;

    paddle.resetScore();
    expect(paddle.score).toBe(0);
    expect(paddle.y).toBe(GAME_HEIGHT / 2);
    expect(paddle.targetY).toBe(GAME_HEIGHT / 2);
  });
});
