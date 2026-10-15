import { Ball } from '@/match/Ball';
import { COURT } from '@/match/config';
import { AiSkill } from '@/match/difficulty';
import { Paddle } from '@/match/Paddle';
import { clamp } from '@/shared/math';

const AIM_DEADZONE = 6; // px; closer than this the paddle holds still

/** Steers the CPU paddles (and both paddles in the demo) toward the ball. */
export class AiController {
  /** Where each paddle aims relative to the ball, re-rolled whenever the ball heads its way. */
  private readonly aimErrors: [number, number] = [0, 0];

  public update(paddle: Paddle, ball: Ball, skill: AiSkill, dt: number): void {
    const isMovingTowardPaddle = paddle.index === 1 ? ball.vx > 0 : ball.vx < 0;
    const desiredY = isMovingTowardPaddle
      ? ball.y + this.aimErrors[paddle.index]
      : COURT.HEIGHT / 2;
    const deltaY = desiredY - paddle.targetY;

    const maxMovePerFrame = skill.speed * dt;

    const move =
      Math.abs(deltaY) > AIM_DEADZONE ? clamp(deltaY, -maxMovePerFrame, maxMovePerFrame) : 0;
    paddle.setTargetY(paddle.targetY + move);
  }

  /**
   * Picks a fresh aim error for a paddle that is about to receive the ball, so the AI
   * misjudges each return a little differently. Call it when the opponent hits the ball.
   */
  public rollAimError(paddle: Paddle, skill: AiSkill): void {
    this.aimErrors[paddle.index] = (Math.random() - 0.5) * skill.error;
  }

  public getAimError(paddle: Paddle): number {
    return this.aimErrors[paddle.index];
  }

  /** Forgets the aim errors (a new match, or back to the menu). */
  public reset(): void {
    this.aimErrors.fill(0);
  }
}
