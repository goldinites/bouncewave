import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '@/constants/game.constants';
import { Paddle } from '@/entities/Paddle';

export class HudRenderer {
  public static render(
    ctx: CanvasRenderingContext2D,
    paddles: [Paddle, Paddle],
    serveTime: number,
    readyText: string,
    time: number,
    isRotated: boolean,
  ): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "900 64px Orbitron, 'Russo One', sans-serif";

    // Player scores
    paddles.forEach((paddle, index) => {
      ctx.shadowColor = paddle.color;
      ctx.shadowBlur = 22;
      ctx.fillStyle = paddle.color;
      ctx.globalAlpha = 0.9;

      const posX = GAME_WIDTH / 2 + (index ? 1 : -1) * 90;
      const posY = 82;
      this.renderText(ctx, String(paddle.score), posX, posY, isRotated);
    });

    // "GET READY" indicator
    if (serveTime > 0) {
      ctx.font = "700 22px Orbitron, 'Russo One', sans-serif";
      ctx.fillStyle = COLORS.WHITE;
      ctx.shadowColor = COLORS.WHITE;
      ctx.shadowBlur = 6;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 12);

      this.renderText(ctx, readyText, GAME_WIDTH / 2, GAME_HEIGHT / 2, isRotated);
    }

    ctx.restore();
  }

  private static renderText(
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
