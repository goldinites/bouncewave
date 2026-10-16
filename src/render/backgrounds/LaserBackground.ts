import { COURT } from '@/match/config';
import { Background, BackgroundFrame } from '@/render/backgrounds/Background';
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

/** Laser light show: sweeping beams, a spectrum analyzer and an oscilloscope line. */
// Horizontal stretch of the dark ellipse behind the court
const VIGNETTE_STRETCH = (COURT.WIDTH * 0.5) / (COURT.HEIGHT * 0.4);

export class LaserBackground implements Background {
  public readonly overlayTint = 0.15;

  /** Gradients that never change, built on first use. */
  private gradients: { sky: CanvasGradient; vignette: CanvasGradient } | null = null;
  private readonly barHeights = new Array<number>(BAR_COUNT).fill(0);

  public render(frame: BackgroundFrame): void {
    const { ctx, pulse, laserIntensity } = frame;
    const gradients = (this.gradients ??= this.createGradients(ctx));

    ctx.fillStyle = gradients.sky;
    ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);

    const pulseAlpha = pulse * 0.1 * laserIntensity;
    if (pulseAlpha > 0.004) {
      ctx.fillStyle = `rgba(90, 70, 255, ${pulseAlpha})`;
      ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    this.renderBeams(frame);
    this.renderSpectrumBars(frame);
    this.renderOscilloscope(frame);

    ctx.restore();

    this.renderVignette(ctx, gradients.vignette);
  }

  private createGradients(ctx: CanvasRenderingContext2D): {
    sky: CanvasGradient;
    vignette: CanvasGradient;
  } {
    const centerX = COURT.WIDTH / 2;
    const centerY = COURT.HEIGHT * 0.45;
    const sky = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, COURT.WIDTH * 0.7);
    sky.addColorStop(0, '#2b0a5c');
    sky.addColorStop(1, '#05010d');

    // Centered on the origin; renderVignette moves and stretches it into place
    const vignette = ctx.createRadialGradient(0, 0, 0, 0, 0, COURT.HEIGHT * 0.4);
    vignette.addColorStop(0, 'rgba(4, 1, 12, 0.92)');
    vignette.addColorStop(0.55, 'rgba(4, 1, 12, 0.82)');
    vignette.addColorStop(1, 'rgba(4, 1, 12, 0)');

    return { sky, vignette };
  }

  private renderBeams({ ctx, pulse, time, laserIntensity, celebration }: BackgroundFrame): void {
    for (const [x, y, baseAngle, sweep, speed, phase, hue] of LASER_CONFIGURATIONS) {
      const angle = baseAngle + Math.sin(time * speed + phase) * sweep;
      // Victory sweeps each beam through the color wheel, out of phase with its neighbours
      const celebrationSwing = celebration * CELEBRATION_HUE_SWING * Math.sin(time * 3 + phase);
      const beamHue = 225 + ((hue - 185) / 135) * 50 + celebrationSwing;

      ctx.strokeStyle = `hsl(${beamHue}, 85%, 50%)`;
      ctx.globalAlpha = (0.07 + pulse * 0.06) * laserIntensity;
      ctx.lineWidth = 12 + pulse * 6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * BEAM_LENGTH, y + Math.sin(angle) * BEAM_LENGTH);
      ctx.stroke();

      // Bright core over the soft glow
      ctx.globalAlpha = (0.3 + pulse * 0.3) * laserIntensity;
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

  private renderOscilloscope({ ctx, spectrum, time, laserIntensity }: BackgroundFrame): void {
    ctx.globalAlpha = 0.06 + 0.24 * laserIntensity;
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
