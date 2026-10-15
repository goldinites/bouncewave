import { PADDLE_WIDTH, WINNING_SCORE } from '@/constants/game.constants';
import {
  DRAMA_LEVEL_SMOOTHING,
  DRAMA_MATCH_POINT_LEVEL,
  DRAMA_SLOWMO_DURATION,
  DRAMA_SLOWMO_SCALE,
  DRAMA_TIME_SCALE_SMOOTHING,
} from '@/constants/visual.constants';
import { Ball } from '@/entities/Ball';
import { Paddle } from '@/entities/Paddle';

/**
 * Presentation-only tension on match point.
 *
 * - While either side is one point from winning, `level` rises slightly (vignette, muffled music).
 * - Once the deciding ball has slipped past the defender's paddle — the point can no longer
 *   be saved — time briefly slows and `level` peaks. Rules and outcome are never affected.
 */
export class MatchPointDrama {
  private _timeScale = 1;
  private _level = 0;
  private slowMoTimeLeft = 0;
  private hasTriggered = false;

  /** Multiplier for the simulation step (1 = normal speed). */
  public get timeScale(): number {
    return this._timeScale;
  }

  /** Effect intensity in [0, 1] for audio and visuals. */
  public get level(): number {
    return this._level;
  }

  public static isMatchPoint(paddles: [Paddle, Paddle]): boolean {
    return paddles.some((p) => p.score === WINNING_SCORE - 1);
  }

  /** True once the ball is behind the paddle of a player facing match point: the point is lost. */
  public static isDecidingBallPast(ball: Ball, paddles: [Paddle, Paddle]): boolean {
    const [left, right] = paddles;

    if (right.score === WINNING_SCORE - 1 && ball.vx < 0) {
      return ball.x + ball.radius < left.x;
    }
    if (left.score === WINNING_SCORE - 1 && ball.vx > 0) {
      return ball.x - ball.radius > right.x + PADDLE_WIDTH;
    }
    return false;
  }

  /**
   * @param realDt     wall-clock frame time, so effects aren't slowed by their own time scale
   * @param isActive   false outside of a real match (demo, menu)
   * @param ball
   * @param paddles
   */
  public update(realDt: number, isActive: boolean, ball: Ball, paddles: [Paddle, Paddle]): void {
    const isMatchPoint = isActive && MatchPointDrama.isMatchPoint(paddles);

    if (isMatchPoint && !this.hasTriggered && MatchPointDrama.isDecidingBallPast(ball, paddles)) {
      this.hasTriggered = true;
      this.slowMoTimeLeft = DRAMA_SLOWMO_DURATION;
    }

    this.slowMoTimeLeft = Math.max(0, this.slowMoTimeLeft - realDt);
    const isSlowMo = this.slowMoTimeLeft > 0;

    const targetScale = isSlowMo ? DRAMA_SLOWMO_SCALE : 1;
    this._timeScale +=
      (targetScale - this._timeScale) * Math.min(1, realDt * DRAMA_TIME_SCALE_SMOOTHING);

    const targetLevel = isSlowMo ? 1 : isMatchPoint ? DRAMA_MATCH_POINT_LEVEL : 0;
    this._level += (targetLevel - this._level) * Math.min(1, realDt * DRAMA_LEVEL_SMOOTHING);
  }

  /** Call on every serve so the next deciding ball can trigger again. */
  public onServe(): void {
    this.hasTriggered = false;
    this.slowMoTimeLeft = 0;
    this._timeScale = 1;
  }

  /** Drop all effects immediately (game over, return to menu). */
  public reset(): void {
    this.onServe();
    this._level = 0;
  }
}
