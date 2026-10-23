import { COURT } from '@/match/config';
import { Background, BackgroundFrame } from '@/render/backgrounds/Background';
import { clamp, mixHexColors, TWO_PI } from '@/shared/math';
import { COLORS } from '@/shared/palette';

// Sky, cool at rest and hot at full climax or celebration
const SKY_COOL = ['#0a0330', '#3c1465', '#7a2a6e'];
const SKY_HOT = ['#2b0a45', '#9a1460', '#ff6a2f'];
// The floor under the grid: the sky's horizon color at rest, but it heats only to a deep
// crimson, so a hot rally doesn't flood the lower half of the court in orange
const FLOOR_COOL = SKY_COOL[2];
const FLOOR_HOT = '#7a1840';
const MOUNTAIN_COOL = '#241152';
const MOUNTAIN_HOT = '#5c1030';
// The far range, paler in the haze, behind the sun
const FAR_MOUNTAIN_COOL = '#4a2384';
const FAR_MOUNTAIN_HOT = '#8a2458';

const SUN_RADIUS = 125;
const SUN_BAND_COUNT = 9; // horizontal gaps sliced into the lower half of the sun
const SUN_BAND_GROWTH = 1.18; // each gap is this much taller than the one above it

// Relative x positions of the mountain peaks, picked by hand so they never align evenly; low
// in the middle, a valley for the sun to set into
const MOUNTAIN_PEAKS: readonly [x: number, height: number][] = [
  [0.02, 58],
  [0.12, 88],
  [0.24, 52],
  [0.34, 66],
  [0.44, 22],
  [0.56, 26],
  [0.66, 70],
  [0.77, 48],
  [0.88, 90],
  [0.98, 56],
];
// The far range: more peaks, taller and softer, its ridge catching a faint pink light
const FAR_PEAKS: readonly [x: number, height: number][] = [
  [0, 70],
  [0.07, 104],
  [0.15, 82],
  [0.21, 122],
  [0.3, 90],
  [0.38, 112],
  [0.46, 78],
  [0.53, 96],
  [0.61, 84],
  [0.69, 118],
  [0.77, 92],
  [0.85, 126],
  [0.93, 88],
  [1, 100],
];
// How far the sun's center sits above the horizon, in radii: enough of it shows for its gaps
const SUN_RISE = 0.35;

// Stars over the sunset, in shares of the sky above the far range; they twinkle at a few
// brightness levels, one fill apiece
const STARS = { COUNT: 48, LEVELS: 3, SIZE: 1.5 } as const;

/**
 * Palms in the foreground: where each one's foot stands (shares of the frame across, and how
 * far down the floor from the horizon), how tall it is (a share of the frame's shorter side)
 * and which way it leans.
 */
const PALMS = [
  { x: 0.06, depth: 1.02, height: 0.62, lean: 1 },
  { x: 0.17, depth: 0.45, height: 0.36, lean: 1 },
  { x: 0.94, depth: 1.02, height: 0.58, lean: -1 },
  { x: 0.84, depth: 0.5, height: 0.34, lean: -1 },
] as const;
const PALM_FRONDS = 7;
const PALM_FILL = '#120424';
const PALM_SWAY = { RATE: 0.7, ANGLE: 0.04 } as const;

const GRID_ROWS = 13; // horizontal lines marching toward the viewer
const GRID_COLS = 16; // vertical lines fanning out from the vanishing point
// The sky gradient is rebuilt only when the heat moves by a step this size
const HEAT_STEPS = 40;
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
  public readonly scene = 'outrun';
  public readonly overlayTint = 0.22;

  private sky: { key: string; value: CanvasGradient } | null = null;
  private readonly stars = Array.from({ length: STARS.COUNT }, () => ({
    x: Math.random(),
    y: Math.random() ** 1.4,
    phase: Math.random() * TWO_PI,
    rate: 0.8 + Math.random() * 1.2,
  }));

  public render(frame: BackgroundFrame): void {
    const { ctx, time, pulse, climax, celebration, isRotated } = frame;
    const heat = Math.max(climax, celebration);

    ctx.save();
    const layout = this.applyOrientation(ctx, isRotated);

    const sky = this.getSky(ctx, heat, layout);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, layout.width, layout.horizonY);
    ctx.fillStyle = mixHexColors(FLOOR_COOL, FLOOR_HOT, heat);
    ctx.fillRect(0, layout.horizonY, layout.width, layout.height - layout.horizonY);

    this.renderStars(ctx, time, layout);
    // The sun sets between the ranges: behind the near mountains, in front of the far ones
    this.renderFarMountains(ctx, heat, layout);
    this.renderSun(ctx, sky, heat, pulse, layout);
    this.renderMountains(ctx, heat, layout);
    this.renderGrid(ctx, time, heat, layout);
    this.renderHorizonGlow(ctx, heat, layout);
    this.renderPalms(ctx, time, heat, layout);

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

  /** Sky gradient down to the horizon; cached per heat step and orientation. */
  private getSky(ctx: CanvasRenderingContext2D, heat: number, layout: Layout): CanvasGradient {
    const heatStep = Math.round(heat * HEAT_STEPS);
    const key = `${heatStep}|${layout.horizonY}`;
    if (this.sky?.key === key) return this.sky.value;

    const value = ctx.createLinearGradient(0, 0, 0, layout.horizonY);
    [0, 0.6, 1].forEach((stop, i) =>
      value.addColorStop(stop, mixHexColors(SKY_COOL[i], SKY_HOT[i], heatStep / HEAT_STEPS)),
    );
    this.sky = { key, value };
    return value;
  }

  /** Stars twinkling over the sunset, batched by brightness. */
  private renderStars(ctx: CanvasRenderingContext2D, time: number, layout: Layout): void {
    const skyHeight = layout.horizonY - FAR_PEAKS.reduce((top, [, h]) => Math.max(top, h), 0);

    ctx.save();
    ctx.fillStyle = COLORS.WHITE;
    for (let level = 1; level <= STARS.LEVELS; level++) {
      ctx.beginPath();
      for (const star of this.stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(time * star.rate + star.phase);
        if (Math.ceil(twinkle * STARS.LEVELS) !== level) continue;
        ctx.rect(star.x * layout.width, star.y * skyHeight, STARS.SIZE, STARS.SIZE);
      }
      // Fainter toward the horizon's glow anyway, so the brightest are none too bright
      ctx.globalAlpha = 0.15 + (0.55 * level) / STARS.LEVELS;
      ctx.fill();
    }
    ctx.restore();
  }

  /** Adds a mountain range to the current path: its peaks joined up over the horizon. */
  private traceRange(
    ctx: CanvasRenderingContext2D,
    peaks: readonly [x: number, height: number][],
    layout: Layout,
  ): void {
    const { width, horizonY } = layout;
    ctx.moveTo(0, horizonY);
    for (const [x, height] of peaks) {
      ctx.lineTo(x * width, horizonY - height);
    }
    ctx.lineTo(width, horizonY);
    ctx.closePath();
  }

  /** The far range in the haze behind the sun, a faint pink light along its ridge. */
  private renderFarMountains(ctx: CanvasRenderingContext2D, heat: number, layout: Layout): void {
    ctx.beginPath();
    this.traceRange(ctx, FAR_PEAKS, layout);
    ctx.fillStyle = mixHexColors(FAR_MOUNTAIN_COOL, FAR_MOUNTAIN_HOT, heat);
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = COLORS.PINK;
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  /** The near range in front of the sun, its ridge traced in neon. */
  private renderMountains(ctx: CanvasRenderingContext2D, heat: number, layout: Layout): void {
    ctx.beginPath();
    this.traceRange(ctx, MOUNTAIN_PEAKS, layout);
    ctx.fillStyle = mixHexColors(MOUNTAIN_COOL, MOUNTAIN_HOT, heat);
    ctx.fill();

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = mixHexColors(COLORS.CYAN, COLORS.PINK, heat);
    this.strokeNeon(ctx, 0.45, 1.2);
    ctx.restore();
  }

  /**
   * Palms on the floor at either side: curved trunks and drooping fronds, dark against the
   * sunset with a neon rim, swaying a little. All of them in one path.
   */
  private renderPalms(
    ctx: CanvasRenderingContext2D,
    time: number,
    heat: number,
    layout: Layout,
  ): void {
    const { width, height, horizonY } = layout;
    const unit = Math.min(width, height);

    ctx.beginPath();
    PALMS.forEach((palm, i) => {
      const footX = palm.x * width;
      const footY = horizonY + palm.depth * (height - horizonY);
      const tall = palm.height * unit;
      const sway = Math.sin(time * PALM_SWAY.RATE + i * 1.7) * PALM_SWAY.ANGLE;
      // The trunk bows toward the court and its crown leans out over it
      const crownX = footX + palm.lean * tall * (0.22 + sway);
      const crownY = footY - tall;
      const bendX = footX - palm.lean * tall * 0.05;
      const bendY = footY - tall * 0.55;
      const base = tall * 0.035;
      const top = tall * 0.018;

      ctx.moveTo(footX - base, footY);
      ctx.quadraticCurveTo(bendX - base, bendY, crownX - top, crownY);
      ctx.lineTo(crownX + top, crownY);
      ctx.quadraticCurveTo(bendX + base, bendY, footX + base, footY);
      ctx.closePath();

      // Fronds fanning out from the crown and arching over
      for (let k = 0; k < PALM_FRONDS; k++) {
        const angle = -Math.PI - 0.35 + (k / (PALM_FRONDS - 1)) * (Math.PI + 0.7) + sway * 2;
        this.traceFrond(ctx, crownX, crownY, angle, tall * (0.42 + (k % 2) * 0.08));
      }
    });
    ctx.fillStyle = PALM_FILL;
    ctx.fill();

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = mixHexColors(COLORS.PINK, '#ff6a2f', heat);
    ctx.globalAlpha = clamp(0.55 + heat * 0.3, 0, 1);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  /** Adds a frond to the current path: a long narrow leaf whose tip droops toward the floor. */
  private traceFrond(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    length: number,
  ): void {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const droop = length * 0.32;
    const tipX = x + dx * length;
    const tipY = y + dy * length + droop;
    const midX = x + dx * length * 0.55;
    const midY = y + dy * length * 0.55 - droop * 0.15;
    const half = length * 0.13;

    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(midX - dy * half, midY + dx * half, tipX, tipY);
    ctx.quadraticCurveTo(midX + dy * half, midY - dx * half, x, y);
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
    const radius = SUN_RADIUS * (1 + pulse * 0.08);
    const centerY = horizonY - SUN_RADIUS * SUN_RISE;

    // Nothing of the sun shows below the horizon: it is setting behind the floor
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, horizonY);
    ctx.clip();

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

    // Slice gaps into the lower half by repainting the sky's own gradient over it, only as wide
    // as the sun: the mountains are drawn afterwards, so nothing else is cut
    ctx.fillStyle = sky;
    let gapY = centerY - radius * 0.05;
    let gapHeight = radius * 0.06;
    for (let i = 0; i < SUN_BAND_COUNT && gapY < horizonY; i++) {
      ctx.fillRect(vanishingX - radius, gapY, radius * 2, gapHeight);
      gapY += gapHeight * (1 + SUN_BAND_GROWTH);
      gapHeight *= SUN_BAND_GROWTH;
    }
    ctx.restore();
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
