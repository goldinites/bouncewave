import { COURT } from '@/match/config';
import { COLORS } from '@/shared/palette';
const NET_LINE_WIDTH = 3;
const NET_DASH_PATTERN = [12, 14];

export class CourtRenderer {
  public static render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Glowing boundary rails (linear gradient cyan -> pink)
    const railGradient = ctx.createLinearGradient(0, 0, COURT.WIDTH, 0);
    railGradient.addColorStop(0, COLORS.CYAN);
    railGradient.addColorStop(1, COLORS.PINK);

    ctx.fillStyle = railGradient;
    ctx.shadowColor = COLORS.PINK;
    ctx.shadowBlur = 14;

    // Top rail
    ctx.fillRect(0, 10, COURT.WIDTH, 4);
    // Bottom rail
    ctx.fillRect(0, COURT.HEIGHT - 14, COURT.WIDTH, 4);

    // Dashed center net line
    ctx.shadowBlur = 0;
    ctx.setLineDash(NET_DASH_PATTERN);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = NET_LINE_WIDTH;

    ctx.beginPath();
    ctx.moveTo(COURT.WIDTH / 2, 18);
    ctx.lineTo(COURT.WIDTH / 2, COURT.HEIGHT - 18);
    ctx.stroke();

    ctx.restore();
  }
}
