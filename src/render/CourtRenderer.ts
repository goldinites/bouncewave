import { COURT } from '@/match/config';
import { Ripple, RIPPLE_LIFE } from '@/render/particles';
import { glowMargin, sprites } from '@/render/SpriteCache';
import { mixHexColors } from '@/shared/math';
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
// A struck wall: its rail glows where the ball hit (GLOW px across at full strength) and a wave
// runs off both ways at SPEED px/s, a bright front with a TAIL px fade behind it
const RIPPLE = { GLOW: 46, SPEED: 1000, TAIL: 70, HEIGHT: 8 } as const;

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

  /** The struck lines lighting up, the walls' rails and the goal lines, and their waves. */
  public static renderRipples(ctx: CanvasRenderingContext2D, ripples: readonly Ripple[]): void {
    if (ripples.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const ripple of ripples) {
      const { x, y, age, strength } = ripple;
      const fade = 1 - age / RIPPLE_LIFE;
      // A rail's own color where it was struck, cyan at the left end to pink at the right
      const color = ripple.color ?? mixHexColors(COLORS.CYAN, COLORS.PINK, x / COURT.WIDTH);
      // Drawn as along a rail; a goal line's turned upright about where it was struck
      const length = ripple.isUpright ? COURT.HEIGHT : COURT.WIDTH;
      const at = ripple.isUpright ? y : x;
      ctx.save();
      if (ripple.isUpright) {
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 2);
        ctx.translate(-y, -x);
      }
      const across = ripple.isUpright ? x : y;

      // The spot struck, flaring and going out first
      const glow = RIPPLE.GLOW * (0.5 + 0.5 * strength);
      ctx.globalAlpha = fade * fade * strength;
      const spot = ctx.createRadialGradient(at, across, 0, at, across, glow);
      spot.addColorStop(0, COLORS.WHITE);
      spot.addColorStop(0.3, color);
      spot.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = spot;
      ctx.fillRect(at - glow, across - glow / 2, glow * 2, glow);

      // Two fronts running off along the line, their tails toward the spot
      ctx.globalAlpha = fade * (0.4 + 0.6 * strength);
      for (const way of [-1, 1]) {
        const front = at + way * RIPPLE.SPEED * age;
        if (front < 0 || front > length) continue;
        const tail = front - way * Math.min(RIPPLE.TAIL, RIPPLE.SPEED * age);
        const wave = ctx.createLinearGradient(front, 0, tail, 0);
        wave.addColorStop(0, COLORS.WHITE);
        wave.addColorStop(0.2, color);
        wave.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = wave;
        ctx.fillRect(
          Math.min(front, tail),
          across - RIPPLE.HEIGHT / 2,
          Math.abs(front - tail),
          RIPPLE.HEIGHT,
        );
      }
      ctx.restore();
    }
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
