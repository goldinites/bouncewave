import { COURT } from '@/match/config';
import { Background, BackgroundFrame } from '@/render/backgrounds/Background';
import { mixHexColors, TWO_PI } from '@/shared/math';
import { COLORS } from '@/shared/palette';

// Sky, cool at rest and hot at full climax or celebration — same heat language as Memphis
const SKY_COOL = ['#0a0330', '#3c1465', '#7a2a6e'];
const SKY_HOT = ['#2b0a45', '#9a1460', '#ff6a2f'];
const MOUNTAIN_COOL = '#241152';
const MOUNTAIN_HOT = '#5c1030';

const HORIZON_Y = COURT.HEIGHT * 0.58;
const SUN_CENTER_Y = HORIZON_Y - 8;
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

const VANISHING_X = COURT.WIDTH / 2;
const GRID_ROWS = 13; // horizontal lines marching toward the viewer
const GRID_COLS = 16; // vertical lines fanning out from the vanishing point
const GRID_SCROLL_SPEED = 1; // loops of the floor per second
const GRID_SPREAD = 1.7; // how far the floor's outer columns splay past the court's edges

/** Classic outrun sunset: a banded sun over mountains and a receding neon grid floor. */
export class OutrunBackground implements Background {
  public readonly overlayTint = 0.22;

  public render(frame: BackgroundFrame): void {
    const { ctx, time, pulse, climax, celebration } = frame;
    const heat = Math.max(climax, celebration);

    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    [0, 0.6, 1].forEach((stop, i) =>
      sky.addColorStop(stop, mixHexColors(SKY_COOL[i], SKY_HOT[i], heat)),
    );
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);

    this.renderMountains(ctx, heat);
    this.renderSun(ctx, sky, heat, pulse);
    this.renderGrid(ctx, time, heat);
    this.renderHorizonGlow(ctx, heat);
  }

  private renderMountains(ctx: CanvasRenderingContext2D, heat: number): void {
    ctx.fillStyle = mixHexColors(MOUNTAIN_COOL, MOUNTAIN_HOT, heat);
    ctx.beginPath();
    ctx.moveTo(0, HORIZON_Y);
    for (const [x, height] of MOUNTAIN_PEAKS) {
      ctx.lineTo(x * COURT.WIDTH, HORIZON_Y - height);
    }
    ctx.lineTo(COURT.WIDTH, HORIZON_Y);
    ctx.closePath();
    ctx.fill();
  }

  /** The sun, with horizontal gaps sliced into it (gaps widening toward the bottom). */
  private renderSun(
    ctx: CanvasRenderingContext2D,
    sky: CanvasGradient,
    heat: number,
    pulse: number,
  ): void {
    const radius = SUN_RADIUS * (1 + pulse * 0.08);

    const sunGradient = ctx.createLinearGradient(
      0,
      SUN_CENTER_Y - radius,
      0,
      SUN_CENTER_Y + radius,
    );
    sunGradient.addColorStop(0, COLORS.YELLOW);
    sunGradient.addColorStop(0.5, mixHexColors(COLORS.YELLOW, COLORS.PINK, 0.5 + heat * 0.3));
    sunGradient.addColorStop(1, mixHexColors(COLORS.PINK, '#ff6a2f', heat));

    ctx.save();
    ctx.shadowColor = COLORS.PINK;
    ctx.shadowBlur = 20 + pulse * 20;
    ctx.fillStyle = sunGradient;
    ctx.beginPath();
    ctx.arc(VANISHING_X, SUN_CENTER_Y, radius, 0, TWO_PI);
    ctx.fill();
    ctx.restore();

    // Slice gaps into the lower half; repainting the sky's own gradient erases the sun there
    // without needing to clip, since outside the circle it just repaints the sky that's already
    // there
    ctx.fillStyle = sky;
    let gapY = SUN_CENTER_Y - radius * 0.05;
    let gapHeight = radius * 0.06;
    for (let i = 0; i < SUN_BAND_COUNT; i++) {
      ctx.fillRect(0, gapY, COURT.WIDTH, gapHeight);
      gapY += gapHeight * (1 + SUN_BAND_GROWTH);
      gapHeight *= SUN_BAND_GROWTH;
    }
  }

  /** Perspective grid floor: verticals fanning from the vanishing point, horizontals rushing in. */
  private renderGrid(ctx: CanvasRenderingContext2D, time: number, heat: number): void {
    const color = mixHexColors(COLORS.CYAN, COLORS.PINK, heat);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;

    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= GRID_COLS; i++) {
      const t = i / GRID_COLS - 0.5; // -0.5 .. 0.5
      ctx.beginPath();
      ctx.moveTo(VANISHING_X, HORIZON_Y);
      ctx.lineTo(VANISHING_X + t * COURT.WIDTH * GRID_SPREAD, COURT.HEIGHT);
      ctx.stroke();
    }

    const scroll = (time * GRID_SCROLL_SPEED) % 1;
    ctx.lineWidth = 2;
    for (let i = 0; i < GRID_ROWS; i++) {
      // 0 = just past the horizon, 1 = the bottom edge; squared so rows bunch up near the horizon
      const progress = (i + scroll) / GRID_ROWS;
      const eased = progress * progress;
      const y = HORIZON_Y + eased * (COURT.HEIGHT - HORIZON_Y);

      ctx.globalAlpha = 0.5 * (1 - eased * 0.3);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(COURT.WIDTH, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderHorizonGlow(ctx: CanvasRenderingContext2D, heat: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = mixHexColors(COLORS.PURPLE, COLORS.PINK, heat);
    ctx.fillRect(0, HORIZON_Y - 2, COURT.WIDTH, 4);
    ctx.restore();
  }
}
