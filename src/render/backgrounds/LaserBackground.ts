import { COURT } from '@/match/config';
import { Background, BackgroundFrame } from '@/render/backgrounds/Background';
import { mixHexColors } from '@/shared/math';
import { COLORS } from '@/shared/palette';

type LaserConfig = [
  x: number,
  y: number,
  baseAngle: number,
  sweep: number,
  speed: number,
  phase: number,
  hue: number,
];

const LASER_CONFIGURATIONS: LaserConfig[] = [
  [0, 0, 0.8, 0.45, 0.7, 0, 185],
  [0, 0, 0.45, 0.4, -0.9, 2, 320],
  [COURT.WIDTH, 0, 2.35, 0.45, 0.8, 1, 320],
  [COURT.WIDTH, 0, 2.7, 0.4, -0.6, 4, 185],
  [COURT.WIDTH / 2, 0, 1.57, 0.8, 0.5, 3, 270],
  [COURT.WIDTH * 0.25, COURT.HEIGHT, -1.2, 0.5, 0.8, 5, 320],
  [COURT.WIDTH * 0.75, COURT.HEIGHT, -1.95, 0.5, -0.7, 6, 185],
];

// The climax mix is louder, so spectrum bars lose up to this share of alpha and height
const CLIMAX_SPECTRUM_DAMPING = 0.3;
// Victory sweeps each beam's hue by up to this many degrees
const CELEBRATION_HUE_SWING = 180;
// How far laserIntensity (full behind the menus, low during play) may dim the show. A floor,
// not a straight multiply, so the beams stay faintly on during play instead of going black
const LIGHT_INTENSITY_FLOOR = 0.35;
// The glow behind the beams, middle to edge: violet at rest, warming a little toward plum at
// full climax or celebration, in the same heat language as the other backdrops
const SKY_COOL = ['#2b0a5c', '#05010d'];
const SKY_HOT = ['#4a0c4c', '#0e020c'];
// The sky gradient is rebuilt only when the heat moves by a step this size
const HEAT_STEPS = 40;

const BEAM_LENGTH = 900;
const BAR_COUNT = 32;
const BOTTOM_BAR_ROWS = 14;
const TOP_BAR_ROWS = 7;
const WAVE_POINTS = 64;
const BOTTOM_ROW_COLORS = Array.from(
  { length: BOTTOM_BAR_ROWS },
  (_, j) => `hsl(${185 + j * 10}, 100%, ${55 + j}%)`,
);
const TOP_ROW_COLORS = Array.from(
  { length: TOP_BAR_ROWS },
  (_, j) => `hsl(${320 - j * 8}, 100%, 60%)`,
);

// Horizontal stretch of the dark ellipse behind the court
const VIGNETTE_STRETCH = (COURT.WIDTH * 0.5) / (COURT.HEIGHT * 0.4);

/** Laser light show: sweeping beams, a spectrum analyzer and an oscilloscope line. */
export class LaserBackground implements Background {
  public readonly scene = 'lasers';
  public readonly overlayTint = 0.15;

  /** The vignette never changes, so it is built on first use. */
  private vignette: CanvasGradient | null = null;
  private sky: { heatStep: number; value: CanvasGradient } | null = null;
  private readonly barHeights = new Array<number>(BAR_COUNT).fill(0);

  public render(frame: BackgroundFrame): void {
    const { ctx, pulse, laserIntensity, climax, celebration } = frame;
    const lights = LIGHT_INTENSITY_FLOOR + (1 - LIGHT_INTENSITY_FLOOR) * laserIntensity;

    ctx.fillStyle = this.getSky(ctx, Math.max(climax, celebration));
    ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);

    const pulseAlpha = pulse * 0.1 * lights;
    if (pulseAlpha > 0.004) {
      ctx.fillStyle = `rgba(90, 70, 255, ${pulseAlpha})`;
      ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    this.renderBeams(frame, lights);
    this.renderSpectrumBars(frame);
    this.renderOscilloscope(frame, lights);

    ctx.restore();

    this.renderVignette(ctx, (this.vignette ??= this.createVignette(ctx)));
  }

  /** The glow behind the beams, warmed by the heat; cached per heat step. */
  private getSky(ctx: CanvasRenderingContext2D, heat: number): CanvasGradient {
    const heatStep = Math.round(heat * HEAT_STEPS);
    if (this.sky?.heatStep === heatStep) return this.sky.value;

    const centerX = COURT.WIDTH / 2;
    const centerY = COURT.HEIGHT * 0.45;
    const value = ctx.createRadialGradient(
      centerX,
      centerY,
      10,
      centerX,
      centerY,
      COURT.WIDTH * 0.7,
    );
    SKY_COOL.forEach((cool, i) =>
      value.addColorStop(i, mixHexColors(cool, SKY_HOT[i], heatStep / HEAT_STEPS)),
    );
    this.sky = { heatStep, value };
    return value;
  }

  private createVignette(ctx: CanvasRenderingContext2D): CanvasGradient {
    // Centered on the origin; renderVignette moves and stretches it into place
    const vignette = ctx.createRadialGradient(0, 0, 0, 0, 0, COURT.HEIGHT * 0.4);
    vignette.addColorStop(0, 'rgba(4, 1, 12, 0.78)');
    vignette.addColorStop(0.55, 'rgba(4, 1, 12, 0.62)');
    vignette.addColorStop(1, 'rgba(4, 1, 12, 0)');
    return vignette;
  }

  private renderBeams({ ctx, pulse, time, celebration }: BackgroundFrame, lights: number): void {
    for (const [x, y, baseAngle, sweep, speed, phase, hue] of LASER_CONFIGURATIONS) {
      const angle = baseAngle + Math.sin(time * speed + phase) * sweep;
      // Victory sweeps each beam through the color wheel, out of phase with its neighbours
      const celebrationSwing = celebration * CELEBRATION_HUE_SWING * Math.sin(time * 3 + phase);

      ctx.strokeStyle = `hsl(${hue + celebrationSwing}, 90%, 55%)`;
      ctx.globalAlpha = (0.07 + pulse * 0.06) * lights;
      ctx.lineWidth = 12 + pulse * 6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * BEAM_LENGTH, y + Math.sin(angle) * BEAM_LENGTH);
      ctx.stroke();

      // Bright core over the soft glow
      ctx.globalAlpha = (0.3 + pulse * 0.3) * lights;
      ctx.lineWidth = 1.4 + pulse;
      ctx.stroke();
    }
  }

  private renderSpectrumBars({ ctx, spectrum, time, climax }: BackgroundFrame): void {
    // The climax mix is louder, so calm the bars down to keep the focus on play
    const spectrumCalm = 1 - CLIMAX_SPECTRUM_DAMPING * climax;
    const barWidth = COURT.WIDTH / BAR_COUNT;
    const barHeights = this.barHeights;
    for (let i = 0; i < BAR_COUNT; i++) {
      barHeights[i] = Math.round(
        spectrum.getBarLevel(i, BAR_COUNT, time) * BOTTOM_BAR_ROWS * spectrumCalm,
      );
    }

    // Each row of cells shares a color, so it is one path and one fill
    // Bottom cyan bars
    ctx.globalAlpha = 0.5 * spectrumCalm;
    for (let j = 0; j < BOTTOM_BAR_ROWS; j++) {
      ctx.fillStyle = BOTTOM_ROW_COLORS[j];
      ctx.beginPath();
      for (let i = 0; i < BAR_COUNT; i++) {
        if (barHeights[i] > j) {
          ctx.rect(i * barWidth + 2, COURT.HEIGHT - 24 - j * 8, barWidth - 4, 6);
        }
      }
      ctx.fill();
    }

    // Top pink bars, mirrored
    ctx.globalAlpha = 0.25 * spectrumCalm;
    for (let j = 0; j < TOP_BAR_ROWS; j++) {
      ctx.fillStyle = TOP_ROW_COLORS[j];
      ctx.beginPath();
      for (let i = 0; i < BAR_COUNT; i++) {
        if (barHeights[BAR_COUNT - 1 - i] > j * 2) {
          ctx.rect(i * barWidth + 2, 22 + j * 8, barWidth - 4, 6);
        }
      }
      ctx.fill();
    }
  }

  private renderOscilloscope({ ctx, spectrum, time }: BackgroundFrame, lights: number): void {
    ctx.globalAlpha = 0.3 * lights;
    ctx.strokeStyle = COLORS.CYAN;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= WAVE_POINTS; i++) {
      const x = (i / WAVE_POINTS) * COURT.WIDTH;
      const waveOffset = spectrum.getWaveform(i * 4) * 70;
      const y = COURT.HEIGHT / 2 + waveOffset + Math.sin(i * 0.35 + time * 3) * 5;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  /** Dark elliptical shadow behind the court so the play area stays readable. */
  private renderVignette(ctx: CanvasRenderingContext2D, gradient: CanvasGradient): void {
    ctx.save();
    ctx.translate(COURT.WIDTH / 2, COURT.HEIGHT / 2);
    ctx.scale(VIGNETTE_STRETCH, 1);
    ctx.fillStyle = gradient;
    // Exactly the court in the stretched space: nothing outside it is ever seen
    const halfWidth = COURT.WIDTH / 2 / VIGNETTE_STRETCH;
    ctx.fillRect(-halfWidth, -COURT.HEIGHT / 2, halfWidth * 2, COURT.HEIGHT);
    ctx.restore();
  }
}
