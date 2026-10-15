import { describe, expect, it } from 'vitest';
import { DEMO_AI_ERROR, DIFFICULTY_CONFIGS } from '@/constants/difficulty.constants';
import { GAME_HEIGHT, PADDLE_OFFSET_X, PADDLE_WIDTH } from '@/constants/game.constants';
import { AiController } from '@/core/AiController';
import { Ball } from '@/entities/Ball';
import { Paddle } from '@/entities/Paddle';
import { DifficultyLevel } from '@/types/difficulty.types';
import { GameMode } from '@/types/game.types';

describe('AiController', () => {
  it('moves paddle toward ball when ball is heading towards CPU paddle', () => {
    const paddle = new Paddle(1, 800 - PADDLE_OFFSET_X - PADDLE_WIDTH, '#ff2bd6');
    paddle.targetY = 100;

    const ball = new Ball();
    ball.y = 400;
    ball.vx = 300; // moving towards paddle 1 (rightwards)

    AiController.update(
      paddle,
      ball,
      GameMode.PLAYER_VS_AI,
      DIFFICULTY_CONFIGS[DifficultyLevel.NORMAL],
      0.1,
    );

    expect(paddle.targetY).toBeGreaterThan(100);
  });

  it('returns paddle toward center when ball is heading away from CPU paddle', () => {
    const paddle = new Paddle(1, 800 - PADDLE_OFFSET_X - PADDLE_WIDTH, '#ff2bd6');
    paddle.targetY = 100;

    const ball = new Ball();
    ball.y = 400;
    ball.vx = -300; // moving away from paddle 1

    AiController.update(
      paddle,
      ball,
      GameMode.PLAYER_VS_AI,
      DIFFICULTY_CONFIGS[DifficultyLevel.NORMAL],
      0.1,
    );

    // Should move toward GAME_HEIGHT / 2 (250)
    expect(paddle.targetY).toBeGreaterThan(100);
    expect(paddle.targetY).toBeLessThanOrEqual(GAME_HEIGHT / 2);
  });

  it('rolls an aim error within the difficulty, or the wider demo error', () => {
    const paddle = new Paddle(1, 800 - PADDLE_OFFSET_X - PADDLE_WIDTH, '#ff2bd6');
    const hard = DIFFICULTY_CONFIGS[DifficultyLevel.HARD];

    for (let i = 0; i < 50; i++) {
      AiController.rollAimError(paddle, GameMode.PLAYER_VS_AI, hard);
      expect(Math.abs(paddle.errorOffset)).toBeLessThanOrEqual(hard.error / 2);

      AiController.rollAimError(paddle, GameMode.DEMO, hard);
      expect(Math.abs(paddle.errorOffset)).toBeLessThanOrEqual(DEMO_AI_ERROR / 2);
    }
  });
});
