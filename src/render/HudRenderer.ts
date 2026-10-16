import { COURT } from '@/match/config';
import { Paddle } from '@/match/Paddle';
import { measureText, paintText, sprites } from '@/render/SpriteCache';
import { gameFont } from '@/shared/fonts';
import { COLORS } from '@/shared/palette';

const SCORE_POP_DURATION = 0.22; // s for a changed score to swell and settle
const SCORE_FONT = gameFont(700, 64);
const SCORE_GLOW = 22;
const READY_FONT = gameFont(700, 22);
const READY_GLOW = 6;

export class HudRenderer {
  private displayedScores: [number, number] = [-1, -1];
  private scorePop: [number, number] = [0, 0];

  /**
   * @param ctx
   * @param dt wall-clock seconds since the last frame (the HUD keeps animating in pause)
   * @param paddles
   * @param serveTime
   * @param readyText
   * @param time
   * @param isRotated
   * @param classic plain white blocky digits with no pop, color or glow, and no "get ready"
   *   prompt at all — the original scoreboard never had one
   */
  public render(
    ctx: CanvasRenderingContext2D,
    dt: number,
    paddles: [Paddle, Paddle],
    serveTime: number,
    readyText: string,
    time: number,
    isRotated: boolean,
    classic = false,
  ): void {
    const scores = [paddles[0].score, paddles[1].score] as const;

    scores.forEach((score, index) => {
      if (this.displayedScores[index] === -1) {
        this.displayedScores[index] = score;
      } else if (this.displayedScores[index] !== score) {
        this.displayedScores[index] = score;
        this.scorePop[index] = 1;
      }

      this.scorePop[index] = Math.max(0, this.scorePop[index] - dt / SCORE_POP_DURATION);
    });

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = classic ? "700 56px 'Courier New', monospace" : SCORE_FONT;

    // Player scores
    paddles.forEach((paddle, index) => {
      const pop = classic ? 0 : Math.sin((1 - this.scorePop[index]) * Math.PI);
      const scale = 1 + pop * 0.5;

      ctx.save();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = classic ? 1 : 0.9;

      const posX = COURT.WIDTH / 2 + (index ? 1 : -1) * 90;
      const posY = 82;

      ctx.translate(posX, posY);

      if (isRotated) {
        ctx.rotate(Math.PI / 2);
      }

      ctx.scale(scale, scale);

      const text = String(paddle.score);
      if (classic) {
        ctx.fillText(text, 0, 0);
      } else {
        sprites.draw(
          ctx,
          `score|${paddle.color}|${text}`,
          0,
          0,
          (measureCtx, renderScale) =>
            measureText(measureCtx, renderScale, text, SCORE_FONT, SCORE_GLOW),
          (spriteCtx) => paintText(spriteCtx, text, SCORE_FONT, paddle.color, SCORE_GLOW),
        );
      }

      ctx.restore();
    });

    // "GET READY" indicator — the original had no such prompt, so classic mode stays silent
    if (serveTime > 0 && !classic) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 12);

      this.renderReadyText(ctx, readyText, COURT.WIDTH / 2, COURT.HEIGHT / 2 + 8, isRotated);
    }

    ctx.restore();
  }

  private renderReadyText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    isRotated: boolean,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    if (isRotated) {
      ctx.rotate(Math.PI / 2);
    }

    sprites.draw(
      ctx,
      `ready|${text}`,
      0,
      0,
      (measureCtx, scale) => measureText(measureCtx, scale, text, READY_FONT, READY_GLOW),
      (spriteCtx) => paintText(spriteCtx, text, READY_FONT, COLORS.WHITE, READY_GLOW),
    );

    ctx.restore();
  }
}
