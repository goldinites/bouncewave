import { COURT } from '@/match/config';
import { COLORS } from '@/shared/palette';
const RAIL_THICKNESS = 4; // glowing strip along the inner edge of each wall
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
    ctx.fillRect(0, COURT.TOP_WALL - RAIL_THICKNESS, COURT.WIDTH, RAIL_THICKNESS);
    // Bottom rail
    ctx.fillRect(0, COURT.HEIGHT - COURT.BOTTOM_WALL, COURT.WIDTH, RAIL_THICKNESS);

    // Dashed center net line
    ctx.shadowBlur = 0;
    ctx.setLineDash(NET_DASH_PATTERN);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = NET_LINE_WIDTH;

    ctx.beginPath();
    ctx.moveTo(COURT.WIDTH / 2, COURT.TOP_WALL + RAIL_THICKNESS);
    ctx.lineTo(COURT.WIDTH / 2, COURT.HEIGHT - COURT.BOTTOM_WALL - RAIL_THICKNESS);
    ctx.stroke();

    ctx.restore();
  }

  /** Flat white rails and net, no glow — the court as it looked on a vintage arcade monitor. */
  public static renderClassic(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, COURT.TOP_WALL - RAIL_THICKNESS, COURT.WIDTH, RAIL_THICKNESS);
    ctx.fillRect(0, COURT.HEIGHT - COURT.BOTTOM_WALL, COURT.WIDTH, RAIL_THICKNESS);

    ctx.setLineDash(NET_DASH_PATTERN);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = NET_LINE_WIDTH;

    ctx.beginPath();
    ctx.moveTo(COURT.WIDTH / 2, COURT.TOP_WALL + RAIL_THICKNESS);
    ctx.lineTo(COURT.WIDTH / 2, COURT.HEIGHT - COURT.BOTTOM_WALL - RAIL_THICKNESS);
    ctx.stroke();

    ctx.restore();
  }
}
