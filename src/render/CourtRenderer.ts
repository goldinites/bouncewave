import { COURT } from '@/match/config';
import { glowMargin, sprites } from '@/render/SpriteCache';
import { COLORS } from '@/shared/palette';

/** The court's lines, whatever the look draws them in. */
export const COURT_LINES = {
  RAIL_THICKNESS: 4, // px, the strip along the inner edge of each wall
  NET_WIDTH: 3, // px
  NET_DASH: [12, 14], // px on, px off
} as const;
const RAIL_THICKNESS = COURT_LINES.RAIL_THICKNESS;
const RAIL_GLOW = 14;
const NET_LINE_WIDTH = COURT_LINES.NET_WIDTH;
const NET_DASH_PATTERN = COURT_LINES.NET_DASH;

export class CourtRenderer {
  public static render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Glowing boundary rails, top and bottom
    this.renderRail(ctx, COURT.TOP_WALL - RAIL_THICKNESS);
    this.renderRail(ctx, COURT.HEIGHT - COURT.BOTTOM_WALL);

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

  /** One rail (linear gradient cyan -> pink with a pink glow), pre-rendered. */
  private static renderRail(ctx: CanvasRenderingContext2D, y: number): void {
    sprites.draw(
      ctx,
      'rail',
      0,
      y,
      (_measureCtx, scale) => {
        const margin = glowMargin(RAIL_GLOW, scale);
        return {
          left: -margin,
          top: -margin,
          width: COURT.WIDTH + margin * 2,
          height: RAIL_THICKNESS + margin * 2,
        };
      },
      (spriteCtx) => {
        const railGradient = spriteCtx.createLinearGradient(0, 0, COURT.WIDTH, 0);
        railGradient.addColorStop(0, COLORS.CYAN);
        railGradient.addColorStop(1, COLORS.PINK);

        spriteCtx.fillStyle = railGradient;
        spriteCtx.shadowColor = COLORS.PINK;
        spriteCtx.shadowBlur = RAIL_GLOW;
        spriteCtx.fillRect(0, 0, COURT.WIDTH, RAIL_THICKNESS);
      },
    );
  }
}
