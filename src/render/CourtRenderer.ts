import { COURT } from '@/match/config';
import { glowMargin, sprites } from '@/render/SpriteCache';
import { COLORS } from '@/shared/palette';

const RAIL_THICKNESS = 4; // glowing strip along the inner edge of each wall
const RAIL_GLOW = 14;
const NET_LINE_WIDTH = 3;
const NET_DASH_PATTERN = [12, 14];

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
