/*
 * A paddle that plays a script, for the stands that film the game (e2e/impact, e2e/video): it
 * meets the ball at the spot on its face the script asks for, hit by hit, or lets it past.
 * Imported by the stands after they have seeded Math.random, as everything of the game is.
 */
import { predictArrival } from '@/match/AiController';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { Paddle } from '@/match/Paddle';
import { PaddleController } from '@/match/PaddleController';

/**
 * Meets the ball at the spot on the paddle's face that `offsetFor` asks for, in [-1, 1] of its
 * half-height (within the perfect zone a perfect hit, off it a plain one at an angle); null lets
 * the ball past.
 */
export class ScriptedController implements PaddleController {
  constructor(private readonly offsetFor: () => number | null) {}

  public steer(paddle: Paddle, ball: Ball): void {
    const isComing = paddle.side === 0 ? ball.vx < 0 : ball.vx > 0;
    if (!isComing) {
      paddle.setTargetY(COURT.HEIGHT / 2);
      return;
    }
    // Where the ball's centre will be as its edge touches the face
    const face =
      paddle.side === 0 ? paddle.x + paddle.spec.width + ball.radius : paddle.x - ball.radius;
    const arrival = predictArrival(face, ball.x, ball.y, ball.vx, ball.vy, ball.radius);
    const offset = this.offsetFor();
    // No offset: the paddle lets the ball past, as far from it as it can get
    const target =
      offset === null
        ? arrival.y < COURT.HEIGHT / 2
          ? COURT.HEIGHT
          : 0
        : // The paddle takes the ball on its side away from the nearer wall, never pinned to it
          arrival.y - (Math.sign(arrival.y - COURT.HEIGHT / 2) * offset * paddle.spec.height) / 2;
    paddle.setTargetY(target);
  }

  public topSpeed(paddle: Paddle): number {
    return PADDLE.KEYBOARD_SPEED * paddle.spec.speed;
  }

  public onServe(): void {}
  public onIncomingShot(): void {}
  public onPoint(): void {}
  public reset(): void {}
}
