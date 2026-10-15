import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { DifficultyConfig } from '@/match/difficulty';
import { GameMode } from '@/match/modes';
import { Paddle } from '@/match/Paddle';
import { clamp } from '@/shared/math';

// Both paddles of the attract-mode demo behind the menu, whatever the difficulty
export const DEMO_AI = {
  SPEED: 400,
  ERROR: 80, // aim error, as DifficultyConfig.error
} as const;

export class AiController {
  private static readonly DEADZONE = 6;

  public static update(
    paddle: Paddle,
    ball: Ball,
    gameMode: GameMode,
    difficultyConfig: DifficultyConfig,
    dt: number,
  ): void {
    const isMovingTowardPaddle = paddle.index === 1 ? ball.vx > 0 : ball.vx < 0;
    const desiredY = isMovingTowardPaddle ? ball.y + paddle.errorOffset : COURT.HEIGHT / 2;
    const deltaY = desiredY - paddle.targetY;

    const maxMovePerFrame =
      (gameMode === GameMode.DEMO ? DEMO_AI.SPEED : difficultyConfig.speed) * dt;

    if (Math.abs(deltaY) > this.DEADZONE) {
      paddle.targetY += clamp(deltaY, -maxMovePerFrame, maxMovePerFrame);
    }

    const minY = PADDLE.TOP_MARGIN + PADDLE.HEIGHT / 2;
    const maxY = COURT.HEIGHT - PADDLE.BOTTOM_MARGIN - PADDLE.HEIGHT / 2;
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
    const maxError = gameMode === GameMode.DEMO ? DEMO_AI.ERROR : difficultyConfig.error;
    paddle.errorOffset = (Math.random() - 0.5) * maxError;
  }
}
