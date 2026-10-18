import { Ball } from '@/match/Ball';
import { PADDLE } from '@/match/config';
import { Paddle } from '@/match/Paddle';
import { isDecidingPoint, MatchRules, STANDARD_RULES } from '@/match/rules';
import { approach, clamp, lerp } from '@/shared/math';

export const DRAMA = {
  LEVEL: 0.6, // tension for the whole deciding rally: vignette, muffled music
  LEVEL_SMOOTHING: 4.1, // 1/s
  // Heartbeat through the deciding rally, quickening the longer it lasts
  HEARTBEAT_FIRST: 0.4, // s from the start of the deciding point to the first beat
  HEARTBEAT_START_INTERVAL: 0.85, // s between beats at first
  HEARTBEAT_MIN_INTERVAL: 0.45, // s between beats once fully quickened
  HEARTBEAT_QUICKEN_TIME: 8, // s of rally to go from the first interval to the last
  BEAT_PULSE: 0.35, // extra vignette on each beat
  BEAT_PULSE_DECAY: 4, // 1/s
  // Once the deciding ball is past a paddle
  SLOWMO_SCALE: 0.1, // simulation speed
  SLOWMO_MAX_DURATION: 2.5, // s wall-clock; the point is normally scored well before
  TIME_SCALE_SMOOTHING: 6.3, // 1/s
  ZOOM: 0.2, // extra camera zoom on the ball at full slow motion
} as const;

/**
 * Presentation-only tension on the deciding point, when both sides are one point from winning.
 *
 * - The whole rally: `level` rises (vignette, muffled music) and a heartbeat quickens, each beat
 *   pulsing the vignette.
 * - Once the ball has slipped past a paddle — the match is decided — the heartbeat stops, time
 *   slows right down and the camera closes in on the ball until the point is scored.
 *
 * Rules and outcome are never affected.
 */
export class MatchPointDrama {
  private _timeScale = 1;
  private _level = 0;
  private beatPulse = 0;
  private decidingTime = 0;
  private nextBeatAt: number = DRAMA.HEARTBEAT_FIRST;
  private slowMoElapsed = 0;
  private hasTriggered = false;

  /** Multiplier for the simulation step (1 = normal speed). */
  public get timeScale(): number {
    return this._timeScale;
  }

  /** Tension in [0, 1], for the music. */
  public get level(): number {
    return this._level;
  }

  /**
   * Edge darkening: the tension plus the heartbeat's pulse. Not capped at 1, so the pulse
   * still shows when the tension is already at its maximum; the renderer limits the opacity.
   */
  public get vignette(): number {
    return this._level + this.beatPulse;
  }

  /** Camera zoom on the ball (1 = none), following the slow motion in and out. */
  public get zoom(): number {
    const slowMo = clamp((1 - this._timeScale) / (1 - DRAMA.SLOWMO_SCALE), 0, 1);
    return 1 + DRAMA.ZOOM * slowMo;
  }

  /** Both sides are one point from winning: the next point decides the match. */
  public static isDecidingPoint(
    paddles: [Paddle, Paddle],
    rules: MatchRules = STANDARD_RULES,
  ): boolean {
    return isDecidingPoint([paddles[0].score, paddles[1].score], rules);
  }

  /** True once the ball is behind either paddle: on the deciding point, the match is over. */
  public static isBallPastPaddle(ball: Ball, paddles: [Paddle, Paddle]): boolean {
    const [left, right] = paddles;
    if (ball.vx < 0) return ball.x + ball.radius < left.x;
    if (ball.vx > 0) return ball.x - ball.radius > right.x + PADDLE.WIDTH;
    return false;
  }

  /**
   * @param realDt   wall-clock frame time, so effects aren't slowed by their own time scale
   * @param isActive false outside of a real match (demo, menu)
   * @param ball
   * @param paddles
   * @param rules the match's, which say when the deciding point comes
   * @returns true on the frames a heartbeat should sound
   */
  public update(
    realDt: number,
    isActive: boolean,
    ball: Ball,
    paddles: [Paddle, Paddle],
    rules: MatchRules = STANDARD_RULES,
  ): boolean {
    const isDeciding = isActive && MatchPointDrama.isDecidingPoint(paddles, rules);

    if (isDeciding && !this.hasTriggered && MatchPointDrama.isBallPastPaddle(ball, paddles)) {
      this.hasTriggered = true;
      this.slowMoElapsed = 0;
    }

    const isSlowMo = this.hasTriggered && this.slowMoElapsed < DRAMA.SLOWMO_MAX_DURATION;
    if (isSlowMo) this.slowMoElapsed += realDt;

    const targetScale = isSlowMo ? DRAMA.SLOWMO_SCALE : 1;
    this._timeScale = approach(this._timeScale, targetScale, DRAMA.TIME_SCALE_SMOOTHING, realDt);

    const targetLevel = isSlowMo ? 1 : isDeciding ? DRAMA.LEVEL : 0;
    this._level = approach(this._level, targetLevel, DRAMA.LEVEL_SMOOTHING, realDt);

    this.beatPulse = Math.max(0, this.beatPulse - realDt * DRAMA.BEAT_PULSE_DECAY);
    return isDeciding && !this.hasTriggered && this.advanceHeartbeat(realDt);
  }

  /** Call on every serve so the next deciding ball can trigger again. */
  public onServe(): void {
    this.hasTriggered = false;
    this.slowMoElapsed = 0;
    this._timeScale = 1;
  }

  /** Drop all effects immediately (game over, return to menu). */
  public reset(): void {
    this.onServe();
    this._level = 0;
    this.beatPulse = 0;
    this.decidingTime = 0;
    this.nextBeatAt = DRAMA.HEARTBEAT_FIRST;
  }

  /** @returns whether a beat falls in this frame */
  private advanceHeartbeat(realDt: number): boolean {
    this.decidingTime += realDt;
    if (this.decidingTime < this.nextBeatAt) return false;

    const quickening = clamp(this.decidingTime / DRAMA.HEARTBEAT_QUICKEN_TIME, 0, 1);
    this.nextBeatAt += lerp(
      DRAMA.HEARTBEAT_START_INTERVAL,
      DRAMA.HEARTBEAT_MIN_INTERVAL,
      quickening,
    );
    this.beatPulse = DRAMA.BEAT_PULSE;
    return true;
  }
}
