import { COURT } from '@/match/config';
import { Background, BackgroundFrame } from '@/render/backgrounds/Background';
import { mixHexColors, TWO_PI } from '@/shared/math';
import { COLORS } from '@/shared/palette';

// Sky, cool at rest and hot at full climax or celebration — same heat language as Memphis
const SKY_COOL = ['#0a0330', '#3c1465', '#7a2a6e'];
const SKY_HOT = ['#2b0a45', '#9a1460', '#ff6a2f'];
const MOUNTAIN_COOL = '#241152';
const MOUNTAIN_HOT = '#5c1030';

const SUN_RADIUS = 125;
const SUN_BAND_COUNT = 9; // horizontal gaps sliced into the lower half of the sun
const SUN_BAND_GROWTH = 1.18; // each gap is this much taller than the one above it

// Relative x positions of the mountain peaks, picked by hand so they never align evenly
const MOUNTAIN_PEAKS: readonly [x: number, height: number][] = [
  [0.02, 46],
  [0.16, 70],
  [0.3, 38],
  [0.47, 86],
  [0.64, 44],
  [0.8, 68],
  [0.95, 40],
];

const GRID_ROWS = 13; // horizontal lines marching toward the viewer
const GRID_COLS = 16; // vertical lines fanning out from the vanishing point
const GRID_SCROLL_SPEED = 1; // loops of the floor per second
const GRID_SPREAD = 1.7; // how far the floor's outer columns splay past the court's edges
// Neon on the grid lines without shadowBlur: a wide faint stroke under each one
const GRID_HALO = { WIDTH: 6, ALPHA: 0.25 } as const;

/** Where the horizon sits, and how wide/tall the scene is, in whichever space is "up" right now. */
interface Layout {
  width: number;
  height: number;
  horizonY: number;
  vanishingX: number;
}

/** Classic outrun sunset: a banded sun over mountains and a receding neon grid floor. */
export class OutrunBackground implements Background {
  public readonly overlayTint = 0.22;

  public render(frame: BackgroundFrame): void {
    const { ctx, time, pulse, climax, celebration, isRotated } = frame;
    const heat = Math.max(climax, celebration);

    ctx.save();
    const layout = this.applyOrientation(ctx, isRotated);

    const sky = ctx.createLinearGradient(0, 0, 0, layout.horizonY);
    [0, 0.6, 1].forEach((stop, i) =>
      sky.addColorStop(stop, mixHexColors(SKY_COOL[i], SKY_HOT[i], heat)),
    );
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, layout.width, layout.height);

    this.renderMountains(ctx, heat, layout);
    this.renderSun(ctx, sky, heat, pulse, layout);
    this.renderGrid(ctx, time, heat, layout);
    this.renderHorizonGlow(ctx, heat, layout);

    ctx.restore();
  }

  /**
   * On a portrait phone the whole stage is swept ‑90° in CSS to turn the court vertical; left
   * uncompensated, the sunset's horizon would end up running top-to-bottom instead of side to
   * side. Pre-rotating the canvas by the opposite 90° — and swapping which of the court's own
   * dimensions counts as "width" — cancels that out, so the sky stays up and the ground down
   * exactly as it would in landscape, just scaled to the now-taller frame.
   */
  private applyOrientation(ctx: CanvasRenderingContext2D, isRotated: boolean): Layout {
    const width = isRotated ? COURT.HEIGHT : COURT.WIDTH;
    const height = isRotated ? COURT.WIDTH : COURT.HEIGHT;

    if (isRotated) {
      ctx.translate(COURT.WIDTH / 2, COURT.HEIGHT / 2);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-width / 2, -height / 2);
    }

    return { width, height, horizonY: height * 0.58, vanishingX: width / 2 };
  }

  private renderMountains(ctx: CanvasRenderingContext2D, heat: number, layout: Layout): void {
    const { width, horizonY } = layout;

    ctx.fillStyle = mixHexColors(MOUNTAIN_COOL, MOUNTAIN_HOT, heat);
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (const [x, height] of MOUNTAIN_PEAKS) {
      ctx.lineTo(x * width, horizonY - height);
    }
    ctx.lineTo(width, horizonY);
    ctx.closePath();
    ctx.fill();
  }

  /** The sun, with horizontal gaps sliced into it (gaps widening toward the bottom). */
  private renderSun(
    ctx: CanvasRenderingContext2D,
    sky: CanvasGradient,
    heat: number,
    pulse: number,
    layout: Layout,
  ): void {
    const { width, horizonY, vanishingX } = layout;
    const centerY = horizonY - 8;
    const radius = SUN_RADIUS * (1 + pulse * 0.08);

    const sunGradient = ctx.createLinearGradient(0, centerY - radius, 0, centerY + radius);
    sunGradient.addColorStop(0, COLORS.YELLOW);
    sunGradient.addColorStop(0.5, mixHexColors(COLORS.YELLOW, COLORS.PINK, 0.5 + heat * 0.3));
    sunGradient.addColorStop(1, mixHexColors(COLORS.PINK, '#ff6a2f', heat));

    // Pink halo as a gradient ring rather than shadowBlur, which re-blurs the whole disc
    const haloRadius = radius + 14 + pulse * 14;
    const halo = ctx.createRadialGradient(
      vanishingX,
      centerY,
      radius * 0.9,
      vanishingX,
      centerY,
      haloRadius,
    );
    halo.addColorStop(0, 'rgba(255, 43, 214, 0.55)');
    halo.addColorStop(1, 'rgba(255, 43, 214, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(vanishingX, centerY, haloRadius, 0, TWO_PI);
    ctx.fill();

    ctx.fillStyle = sunGradient;
    ctx.beginPath();
    ctx.arc(vanishingX, centerY, radius, 0, TWO_PI);
    ctx.fill();

    // Slice gaps into the lower half; repainting the sky's own gradient erases the sun there
    // without needing to clip, since outside the circle it just repaints the sky that's already
    // there
    ctx.fillStyle = sky;
    let gapY = centerY - radius * 0.05;
    let gapHeight = radius * 0.06;
    for (let i = 0; i < SUN_BAND_COUNT; i++) {
      ctx.fillRect(0, gapY, width, gapHeight);
      gapY += gapHeight * (1 + SUN_BAND_GROWTH);
      gapHeight *= SUN_BAND_GROWTH;
    }
  }

  /** Perspective grid floor: verticals fanning from the vanishing point, horizontals rushing in. */
  private renderGrid(
    ctx: CanvasRenderingContext2D,
    time: number,
    heat: number,
    layout: Layout,
  ): void {
    const { width, height, horizonY, vanishingX } = layout;
    const color = mixHexColors(COLORS.CYAN, COLORS.PINK, heat);

    ctx.save();
    ctx.strokeStyle = color;

    // Every column shares one style, so they go out as a single path: halo, then line
    ctx.beginPath();
    for (let i = 0; i <= GRID_COLS; i++) {
      const t = i / GRID_COLS - 0.5; // -0.5 .. 0.5
      ctx.moveTo(vanishingX, horizonY);
      ctx.lineTo(vanishingX + t * width * GRID_SPREAD, height);
    }
    this.strokeNeon(ctx, 0.45, 1.5);

    const scroll = (time * GRID_SCROLL_SPEED) % 1;
    for (let i = 0; i < GRID_ROWS; i++) {
      // 0 = just past the horizon, 1 = the bottom edge; squared so rows bunch up near the horizon
      const progress = (i + scroll) / GRID_ROWS;
      const eased = progress * progress;
      const y = horizonY + eased * (height - horizonY);

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      this.strokeNeon(ctx, 0.5 * (1 - eased * 0.3), 2);
    }
    ctx.restore();
  }

  /** Strokes the current path as a neon line: a wide faint halo, then the line itself. */
  private strokeNeon(ctx: CanvasRenderingContext2D, alpha: number, lineWidth: number): void {
    ctx.globalAlpha = alpha * GRID_HALO.ALPHA;
    ctx.lineWidth = lineWidth + GRID_HALO.WIDTH;
    ctx.stroke();

    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  private renderHorizonGlow(ctx: CanvasRenderingContext2D, heat: number, layout: Layout): void {
    const { width, horizonY } = layout;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = mixHexColors(COLORS.PURPLE, COLORS.PINK, heat);
    ctx.fillRect(0, horizonY - 2, width, 4);
    ctx.restore();
  }
}
