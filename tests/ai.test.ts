import { describe, expect, it } from 'vitest';
import { AiController, DEMO_AI } from '@/match/AiController';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { DifficultyLevel, DIFFICULTY_CONFIGS } from '@/match/difficulty';
import { GameMode } from '@/match/modes';
import { Paddle } from '@/match/Paddle';

describe('AiController', () => {
  it('moves paddle toward ball when ball is heading towards CPU paddle', () => {
    const paddle = new Paddle(1, 800 - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6');
    paddle.targetY = 100;

    const ball = new Ball();
    ball.y = 400;
    ball.vx = 300; // moving towards paddle 1 (rightwards)

    new AiController().update(
      paddle,
      ball,
      GameMode.PLAYER_VS_AI,
      DIFFICULTY_CONFIGS[DifficultyLevel.NORMAL],
      0.1,
    );

    expect(paddle.targetY).toBeGreaterThan(100);
  });

  it('returns paddle toward center when ball is heading away from CPU paddle', () => {
    const paddle = new Paddle(1, 800 - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6');
    paddle.targetY = 100;

    const ball = new Ball();
    ball.y = 400;
    ball.vx = -300; // moving away from paddle 1

    new AiController().update(
      paddle,
      ball,
      GameMode.PLAYER_VS_AI,
      DIFFICULTY_CONFIGS[DifficultyLevel.NORMAL],
      0.1,
    );

    // Should move toward COURT.HEIGHT / 2 (250)
    expect(paddle.targetY).toBeGreaterThan(100);
    expect(paddle.targetY).toBeLessThanOrEqual(COURT.HEIGHT / 2);
  });

  it('rolls an aim error within the difficulty, or the wider demo error', () => {
    const paddle = new Paddle(1, 800 - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6');
    const hard = DIFFICULTY_CONFIGS[DifficultyLevel.HARD];
    const ai = new AiController();

    for (let i = 0; i < 50; i++) {
      ai.rollAimError(paddle, GameMode.PLAYER_VS_AI, hard);
      expect(Math.abs(ai.getAimError(paddle))).toBeLessThanOrEqual(hard.error / 2);

      ai.rollAimError(paddle, GameMode.DEMO, hard);
      expect(Math.abs(ai.getAimError(paddle))).toBeLessThanOrEqual(DEMO_AI.ERROR / 2);
    }
  });

  it('forgets the aim errors on reset', () => {
    const paddle = new Paddle(1, 800 - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6');
    const ai = new AiController();

    ai.rollAimError(paddle, GameMode.DEMO, DIFFICULTY_CONFIGS[DifficultyLevel.NORMAL]);
    ai.reset();

    expect(ai.getAimError(paddle)).toBe(0);
  });
});
