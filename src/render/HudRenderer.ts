import { COURT } from '@/match/config';
import { Paddle } from '@/match/Paddle';
import { COLORS } from '@/shared/palette';

const SCORE_POP_DURATION = 0.22; // s for a changed score to swell and settle

export class HudRenderer {
  private displayedScores: [number, number] = [-1, -1];
  private scorePop: [number, number] = [0, 0];

  /** @param dt wall-clock seconds since the last frame (the HUD keeps animating in pause) */
  public render(
    ctx: CanvasRenderingContext2D,
    dt: number,
    paddles: [Paddle, Paddle],
    serveTime: number,
    readyText: string,
    time: number,
    isRotated: boolean,
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
    ctx.font = "700 64px Orbitron, 'Russo One', sans-serif";

    // Player scores
    paddles.forEach((paddle, index) => {
      const pop = Math.sin((1 - this.scorePop[index]) * Math.PI);

      const scale = 1 + pop * 0.5;

      ctx.save();

      ctx.shadowColor = paddle.color;
      ctx.shadowBlur = 22;
      ctx.fillStyle = paddle.color;
      ctx.globalAlpha = 0.9;

      const posX = COURT.WIDTH / 2 + (index ? 1 : -1) * 90;
      const posY = 82;

      ctx.translate(posX, posY);

      if (isRotated) {
        ctx.rotate(Math.PI / 2);
      }

      ctx.scale(scale, scale);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(paddle.score), 0, 0);

      ctx.restore();
    });

    // "GET READY" indicator
    if (serveTime > 0) {
      ctx.font = "700 22px Orbitron, 'Russo One', sans-serif";
      ctx.fillStyle = COLORS.WHITE;
      ctx.shadowColor = COLORS.WHITE;
      ctx.shadowBlur = 6;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 12);

      this.renderText(ctx, readyText, COURT.WIDTH / 2, COURT.HEIGHT / 2 + 8, isRotated);
    }

    ctx.restore();
  }

  private renderText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    isRotated: boolean,
  ): void {
    ctx.save();

    if (isRotated) {
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 0);
    } else {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y);
    }

    ctx.restore();
  }
}
