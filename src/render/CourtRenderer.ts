import {
  COURT_NET_DASH_PATTERN,
  COURT_NET_LINE_WIDTH,
  GAME_HEIGHT,
  GAME_WIDTH,
} from '@/constants/game.constants';

export class CourtRenderer {
  public static render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Glowing boundary rails (linear gradient cyan -> pink)
    const railGradient = ctx.createLinearGradient(0, 0, GAME_WIDTH, 0);
    railGradient.addColorStop(0, '#19f0ff');
    railGradient.addColorStop(1, '#ff2bd6');

    ctx.fillStyle = railGradient;
    ctx.shadowColor = '#ff2bd6';
    ctx.shadowBlur = 14;

    // Top rail
    ctx.fillRect(0, 10, GAME_WIDTH, 4);
    // Bottom rail
    ctx.fillRect(0, GAME_HEIGHT - 14, GAME_WIDTH, 4);

    // Dashed center net line
    ctx.shadowBlur = 0;
    ctx.setLineDash(COURT_NET_DASH_PATTERN);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = COURT_NET_LINE_WIDTH;

    ctx.beginPath();
    ctx.moveTo(GAME_WIDTH / 2, 18);
    ctx.lineTo(GAME_WIDTH / 2, GAME_HEIGHT - 18);
    ctx.stroke();

    ctx.restore();
  }
}
