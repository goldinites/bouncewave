import { Ball } from '@/match/Ball';
import { COURT } from '@/match/config';
import { Paddle } from '@/match/Paddle';
import { ARC } from '@/match/skills/Arc';
import { measureText, paintText, sprites } from '@/render/SpriteCache';
import { gameFont } from '@/shared/fonts';
import { TWO_PI } from '@/shared/math';

// Arc: two streaks circling a spinning ball, the way it spins; brighter the harder it does
const SPIN_STREAKS = {
  RADIUS: 1.75, // times the ball's
  LENGTH: 1.1, // rad of each streak
  TURN: 16, // rad/s they circle at, at full spin
  ALPHA: 0.85,
} as const;

// Reflex: the slowed world turns blue and its balls split into red and cyan ghosts
const TIME_WARP = {
  TINT: '40, 110, 255',
  TINT_ALPHA: 0.2, // at full strength
  GHOST_OFFSET: 4, // px either side of the ball
  GHOST_ALPHA: 0.45,
} as const;

// Its label: over the slowing paddle, flickering in and fading out
const WARP_LABEL = {
  FONT: gameFont(800, 20),
  GLOW: 8,
  COLOR: '#7fb6ff',
  RISE: 64, // px over the paddle's center
  DURATION: 0.9, // s it shows for
} as const;

/** How skills look on the court (docs/PROGRESSION.md): each has a sign the player can read. */
export class SkillRenderer {
  /** Streaks circling a spinning ball, so a curve can be told from its first frames. */
  public static renderSpin(ctx: CanvasRenderingContext2D, ball: Ball, time: number): void {
    const strength = Math.min(1, Math.abs(ball.spin) / ARC.MAX_SPIN);
    if (strength < 0.05) return;

    const turn = time * SPIN_STREAKS.TURN * Math.sign(ball.spin);
    const radius = ball.radius * SPIN_STREAKS.RADIUS;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = SPIN_STREAKS.ALPHA * strength;
    ctx.strokeStyle = '#bff4ff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const start of [turn, turn + Math.PI]) {
      ctx.beginPath();
      ctx.arc(ball.drawX, ball.drawY, radius, start, start + SPIN_STREAKS.LENGTH);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** A blue cast over everything while the world is slowed, `level` in [0, 1]. */
  public static renderTint(ctx: CanvasRenderingContext2D, level: number): void {
    ctx.fillStyle = `rgba(${TIME_WARP.TINT}, ${TIME_WARP.TINT_ALPHA * level})`;
    ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);
  }

  /** A slowed ball's chromatic ghosts, drawn under it. */
  public static renderGhosts(ctx: CanvasRenderingContext2D, ball: Ball, level: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = TIME_WARP.GHOST_ALPHA * level;
    for (const [dx, color] of [
      [-TIME_WARP.GHOST_OFFSET, '#ff3355'],
      [TIME_WARP.GHOST_OFFSET, '#33e0ff'],
    ] as const) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ball.drawX + dx, ball.drawY, ball.radius, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * The slowed world's label over the paddle that slowed it, `age` seconds after.
   * @param isRotated the picture is turned for a phone held upright: the label is turned back
   */
  public static renderLabel(
    ctx: CanvasRenderingContext2D,
    text: string,
    paddle: Paddle,
    age: number,
    isRotated: boolean,
  ): void {
    if (age >= WARP_LABEL.DURATION) return;
    const share = age / WARP_LABEL.DURATION;
    // A glitch: it flickers on for the first frames, then fades
    const flicker = share < 0.2 ? (Math.floor(age * 40) % 2 === 0 ? 1 : 0.35) : 1;
    const towardMiddle = paddle.side === 0 ? 1 : -1;

    ctx.save();
    ctx.globalAlpha = flicker * (1 - share * share);
    if (isRotated) {
      // Upright, it reads beside the paddle, toward the middle of the court
      ctx.translate(paddle.x + towardMiddle * WARP_LABEL.RISE, paddle.drawY);
      ctx.rotate(Math.PI / 2);
    } else {
      const y = paddle.drawY - WARP_LABEL.RISE;
      ctx.translate(paddle.x + towardMiddle * WARP_LABEL.RISE, Math.max(y, COURT.TOP_WALL + 24));
    }
    sprites.draw(
      ctx,
      `warp|${text}`,
      0,
      0,
      (measureCtx, scale) => measureText(measureCtx, scale, text, WARP_LABEL.FONT, WARP_LABEL.GLOW),
      (spriteCtx) => paintText(spriteCtx, text, WARP_LABEL.FONT, WARP_LABEL.COLOR, WARP_LABEL.GLOW),
    );
    ctx.restore();
  }
}
