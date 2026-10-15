import {
  GAME_HEIGHT,
  PADDLE_BOTTOM_MARGIN,
  PADDLE_HEIGHT,
  PADDLE_TOP_MARGIN,
} from '@/constants/game.constants';
import { DEMO_AI_ERROR } from '@/constants/difficulty.constants';
import { Ball } from '@/entities/Ball';
import { Paddle } from '@/entities/Paddle';
import { DifficultyConfig } from '@/types/difficulty.types';
import { GameMode } from '@/types/game.types';
import { clamp } from '@/utils/math';

export class AiController {
  private static readonly DEMO_SPEED = 400;
  private static readonly DEADZONE = 6;

  public static update(
    paddle: Paddle,
    ball: Ball,
    gameMode: GameMode,
    difficultyConfig: DifficultyConfig,
    dt: number,
  ): void {
    const isMovingTowardPaddle = paddle.index === 1 ? ball.vx > 0 : ball.vx < 0;
    const desiredY = isMovingTowardPaddle ? ball.y + paddle.errorOffset : GAME_HEIGHT / 2;
    const deltaY = desiredY - paddle.targetY;

    const maxMovePerFrame =
      (gameMode === GameMode.DEMO ? this.DEMO_SPEED : difficultyConfig.speed) * dt;

    if (Math.abs(deltaY) > this.DEADZONE) {
      paddle.targetY += clamp(deltaY, -maxMovePerFrame, maxMovePerFrame);
    }

    const minY = PADDLE_TOP_MARGIN + PADDLE_HEIGHT / 2;
    const maxY = GAME_HEIGHT - PADDLE_BOTTOM_MARGIN - PADDLE_HEIGHT / 2;
    paddle.targetY = clamp(paddle.targetY, minY, maxY);
  }

  /**
   * Picks a fresh aim error for a paddle that is about to receive the ball, so the AI
   * misjudges each return a little differently. Call it when the opponent hits the ball.
   */
  public static rollAimError(
    paddle: Paddle,
    gameMode: GameMode,
    difficultyConfig: DifficultyConfig,
  ): void {
    const maxError = gameMode === GameMode.DEMO ? DEMO_AI_ERROR : difficultyConfig.error;
    paddle.errorOffset = (Math.random() - 0.5) * maxError;
  }
}
