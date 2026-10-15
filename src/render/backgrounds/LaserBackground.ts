import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '@/constants/game.constants';
import {
  CELEBRATION_HUE_SWING,
  CLIMAX_SPECTRUM_DAMPING,
  LASER_CONFIGURATIONS,
} from '@/constants/visual.constants';
import { Background, BackgroundFrame } from '@/render/backgrounds/Background';

const BEAM_LENGTH = 900;
const BAR_COUNT = 32;
const BOTTOM_BAR_ROWS = 14;
const TOP_BAR_ROWS = 7;
const WAVE_POINTS = 64;

/** Laser light show: sweeping beams, a spectrum analyzer and an oscilloscope line. */
export class LaserBackground implements Background {
  public render(frame: BackgroundFrame): void {
    const { ctx, pulse, laserIntensity } = frame;
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT * 0.45;

    const bgGradient = ctx.createRadialGradient(
      centerX,
      centerY,
      10,
      centerX,
      centerY,
      GAME_WIDTH * 0.7,
    );
    bgGradient.addColorStop(0, '#2b0a5c');
    bgGradient.addColorStop(1, '#05010d');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.fillStyle = `rgba(90, 70, 255, ${pulse * 0.1 * laserIntensity})`;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    this.renderBeams(frame);
    this.renderSpectrumBars(frame);
    this.renderOscilloscope(frame);

    ctx.restore();

    this.renderVignette(ctx);
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
    const barWidth = GAME_WIDTH / BAR_COUNT;
    const barHeights: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      barHeights.push(
        Math.round(spectrum.getBarLevel(i, BAR_COUNT, time) * BOTTOM_BAR_ROWS * spectrumCalm),
      );
    }

    // Bottom cyan bars
    ctx.globalAlpha = 0.5 * spectrumCalm;
    for (let j = 0; j < BOTTOM_BAR_ROWS; j++) {
      ctx.fillStyle = `hsl(${185 + j * 10}, 100%, ${55 + j}%)`;
      for (let i = 0; i < BAR_COUNT; i++) {
        if (barHeights[i] > j) {
          ctx.fillRect(i * barWidth + 2, GAME_HEIGHT - 24 - j * 8, barWidth - 4, 6);
        }
      }
    }

    // Top pink bars, mirrored
    ctx.globalAlpha = 0.25 * spectrumCalm;
    for (let j = 0; j < TOP_BAR_ROWS; j++) {
      ctx.fillStyle = `hsl(${320 - j * 8}, 100%, 60%)`;
      for (let i = 0; i < BAR_COUNT; i++) {
        if (barHeights[BAR_COUNT - 1 - i] > j * 2) {
          ctx.fillRect(i * barWidth + 2, 22 + j * 8, barWidth - 4, 6);
        }
      }
    }
  }

  private renderOscilloscope({ ctx, spectrum, time, laserIntensity }: BackgroundFrame): void {
    ctx.globalAlpha = 0.06 + 0.24 * laserIntensity;
    ctx.strokeStyle = COLORS.CYAN;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= WAVE_POINTS; i++) {
      const x = (i / WAVE_POINTS) * GAME_WIDTH;
      const waveOffset = spectrum.getWaveform(i * 4) * 70;
      const y = GAME_HEIGHT / 2 + waveOffset + Math.sin(i * 0.35 + time * 3) * 5;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  /** Dark elliptical shadow behind the court so the play area stays readable. */
  private renderVignette(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    ctx.scale((GAME_WIDTH * 0.5) / (GAME_HEIGHT * 0.4), 1);
    const vignetteGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, GAME_HEIGHT * 0.4);
    vignetteGrad.addColorStop(0, 'rgba(4, 1, 12, 0.92)');
    vignetteGrad.addColorStop(0.55, 'rgba(4, 1, 12, 0.82)');
    vignetteGrad.addColorStop(1, 'rgba(4, 1, 12, 0)');
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(-GAME_WIDTH, -GAME_HEIGHT, GAME_WIDTH * 2, GAME_HEIGHT * 2);
    ctx.restore();
  }
}
