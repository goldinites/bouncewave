import { GAME_HEIGHT, GAME_WIDTH, TWO_PI } from '@/constants/game.constants';
import { LASER_CONFIGURATIONS, MEMPHIS_SHAPE_COUNT } from '@/constants/visual.constants';
import { MemphisShape, MemphisShapeKind } from '@/types/game.types';
import { clamp, randomRange } from '@/utils/math';

export class BackgroundRenderer {
  private frequencyData = new Uint8Array(128);
  private timeDomainData = new Uint8Array(256);
  private memphisShapes: MemphisShape[] = [];
  public laserIntensity = 1.0;
  public backgroundIndex = 0;

  constructor() {
    this.backgroundIndex = Math.floor(Math.random() * 2);
    this.initMemphisShapes();
  }

  public nextBackground(): void {
    this.backgroundIndex = (this.backgroundIndex + 1) % 2;
  }

  private initMemphisShapes(): void {
    const colors = ['#19f0ff', '#ff2bd6', '#ffe53b', '#b79bff'];
    this.memphisShapes = Array.from({ length: MEMPHIS_SHAPE_COUNT }, (_, i) => ({
      kind: (i % 6) as MemphisShapeKind,
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT,
      size: randomRange(14, 38),
      vx: (Math.random() - 0.5) * 16,
      vy: randomRange(6, 16),
      rotation: Math.random() * 6,
      rotationSpeed: (Math.random() - 0.5) * 1.2,
      color: colors[i % 4],
    }));
  }

  private updateAudioData(analyser: AnalyserNode | null): void {
    if (analyser) {
      analyser.getByteFrequencyData(this.frequencyData);
      analyser.getByteTimeDomainData(this.timeDomainData);
    } else {
      this.frequencyData.fill(0);
      this.timeDomainData.fill(128);
    }
  }

  private getAudioPulse(shake: number): number {
    const bassAvg = (this.frequencyData[1] + this.frequencyData[2] + this.frequencyData[3]) / 765;
    const pulseFromAudio = clamp((bassAvg - 0.35) * 2.2, 0, 1);
    const pulseFromShake = clamp(shake / 12, 0, 1);
    return Math.max(pulseFromAudio, pulseFromShake);
  }

  private getSpectrumLevel(index: number, total: number, time: number): number {
    const bucket = 1 + Math.floor(Math.pow(index / total, 1.5) * 80);
    const maxFreqVal = Math.max(this.frequencyData[bucket], this.frequencyData[bucket + 1]);
    const normalized = (maxFreqVal / 255) * (0.9 + (index / total) * 0.9);
    const syntheticLfo = 0.1 + 0.08 * Math.sin(time * 2.2 + index * 0.6);
    return Math.min(1, Math.max(normalized, syntheticLfo));
  }

  public render(
    ctx: CanvasRenderingContext2D,
    analyser: AnalyserNode | null,
    time: number,
    shake: number,
    isRotated: boolean,
  ): void {
    this.updateAudioData(analyser);
    const pulse = this.getAudioPulse(shake);

    if (this.backgroundIndex === 0) {
      this.renderLaserBackground(ctx, pulse, time);
    } else {
      this.renderMemphisBackground(ctx, pulse, time, isRotated);
    }

    // Semi-transparent dark overlay tint
    ctx.fillStyle = `rgba(10, 2, 32, ${this.backgroundIndex ? 0.3 : 0.15})`;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  private renderLaserBackground(ctx: CanvasRenderingContext2D, pulse: number, time: number): void {
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

    ctx.fillStyle = `rgba(90, 70, 255, ${pulse * 0.1 * this.laserIntensity})`;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    // Rotating laser beams
    for (const [x, y, baseAngle, sweep, speed, phase, hue] of LASER_CONFIGURATIONS) {
      const angle = baseAngle + Math.sin(time * speed + phase) * sweep;
      const beamHue = 225 + ((hue - 185) / 135) * 50;

      ctx.strokeStyle = `hsl(${beamHue}, 85%, 50%)`;
      ctx.globalAlpha = (0.07 + pulse * 0.06) * this.laserIntensity;
      ctx.lineWidth = 12 + pulse * 6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * 900, y + Math.sin(angle) * 900);
      ctx.stroke();

      ctx.globalAlpha = (0.3 + pulse * 0.3) * this.laserIntensity;
      ctx.lineWidth = 1.4 + pulse;
      ctx.stroke();
    }

    // Spectrum analyzer bars
    const barCount = 32;
    const barWidth = GAME_WIDTH / barCount;
    const barHeights: number[] = [];
    for (let i = 0; i < barCount; i++) {
      barHeights.push(Math.round(this.getSpectrumLevel(i, barCount, time) * 14));
    }

    // Bottom cyan bars
    ctx.globalAlpha = 0.5;
    for (let j = 0; j < 14; j++) {
      ctx.fillStyle = `hsl(${185 + j * 10}, 100%, ${55 + j}%)`;
      for (let i = 0; i < barCount; i++) {
        if (barHeights[i] > j) {
          ctx.fillRect(i * barWidth + 2, GAME_HEIGHT - 24 - j * 8, barWidth - 4, 6);
        }
      }
    }

    // Top pink bars
    ctx.globalAlpha = 0.25;
    for (let j = 0; j < 7; j++) {
      ctx.fillStyle = `hsl(${320 - j * 8}, 100%, 60%)`;
      for (let i = 0; i < barCount; i++) {
        if (barHeights[barCount - 1 - i] > j * 2) {
          ctx.fillRect(i * barWidth + 2, 22 + j * 8, barWidth - 4, 6);
        }
      }
    }

    // Center oscilloscope wave
    ctx.globalAlpha = 0.06 + 0.24 * this.laserIntensity;
    ctx.strokeStyle = '#19f0ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const x = (i / 64) * GAME_WIDTH;
      const waveOffset = ((this.timeDomainData[i * 4] - 128) / 128) * 70;
      const y = GAME_HEIGHT / 2 + waveOffset + Math.sin(i * 0.35 + time * 3) * 5;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();

    // Radial vignette shadow
    ctx.save();
    ctx.translate(centerX, GAME_HEIGHT / 2);
    ctx.scale((GAME_WIDTH * 0.5) / (GAME_HEIGHT * 0.4), 1);
    const vignetteGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, GAME_HEIGHT * 0.4);
    vignetteGrad.addColorStop(0, 'rgba(4, 1, 12, 0.92)');
    vignetteGrad.addColorStop(0.55, 'rgba(4, 1, 12, 0.82)');
    vignetteGrad.addColorStop(1, 'rgba(4, 1, 12, 0)');
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(-GAME_WIDTH, -GAME_HEIGHT, GAME_WIDTH * 2, GAME_HEIGHT * 2);
    ctx.restore();
  }

  private renderMemphisBackground(
    ctx: CanvasRenderingContext2D,
    pulse: number,
    time: number,
    isRotated: boolean,
  ): void {
    const bgGradient = ctx.createLinearGradient(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bgGradient.addColorStop(0, '#1a0b4d');
    bgGradient.addColorStop(0.55, '#4a0f6e');
    bgGradient.addColorStop(1, '#7a1a73');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Memphis grid dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    const offset = (time * 10) % 28;
    for (let y = -28 + offset; y < GAME_HEIGHT; y += 28) {
      for (let x = -28 + offset; x < GAME_WIDTH; x += 28) {
        ctx.fillRect(x, y, 2, 2);
      }
    }

    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    // 80s geometric shapes
    for (const shape of this.memphisShapes) {
      const x = (((shape.x + shape.vx * time) % GAME_WIDTH) + GAME_WIDTH) % GAME_WIDTH;
      const y = (((shape.y + shape.vy * time) % GAME_HEIGHT) + GAME_HEIGHT) % GAME_HEIGHT;
      const s = shape.size * (1 + pulse * 0.25);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(shape.rotation + shape.rotationSpeed * time);
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.globalAlpha = shape.kind > 3 ? 0.35 + pulse * 0.2 : 0.55 + pulse * 0.3;

      ctx.beginPath();
      switch (shape.kind) {
        case 0: // Triangle
          ctx.moveTo(0, -s);
          ctx.lineTo(s * 0.87, s * 0.5);
          ctx.lineTo(-s * 0.87, s * 0.5);
          ctx.closePath();
          break;
        case 1: // Circle
          ctx.arc(0, 0, s * 0.8, 0, TWO_PI);
          break;
        case 2: // Zigzag line
          for (let j = 0; j <= 6; j++) {
            ctx.lineTo(-s + (j * s) / 3, (j % 2 ? -1 : 1) * s * 0.35);
          }
          break;
        case 3: // Plus/Cross
          ctx.moveTo(-s, 0);
          ctx.lineTo(s, 0);
          ctx.moveTo(0, -s);
          ctx.lineTo(0, s);
          break;
        case 4: // Square
          ctx.rect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4);
          break;
        default: // Semicircle
          ctx.arc(0, 0, s * 0.8, 0, Math.PI);
          ctx.closePath();
      }

      if (shape.kind > 3) {
        ctx.fill();
      } else {
        ctx.stroke();
      }
      ctx.restore();
    }

    // VHS noise glitches & scanlines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(
        Math.random() * GAME_WIDTH,
        Math.random() * GAME_HEIGHT,
        20 + Math.random() * 120,
        1 + Math.random() * 1.5,
      );
    }

    const scanBarY = ((time * 55) % (GAME_HEIGHT + 90)) - 45;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, scanBarY, GAME_WIDTH, 22);
    ctx.fillStyle = 'rgba(255, 43, 214, 0.12)';
    ctx.fillRect(0, scanBarY + 22, GAME_WIDTH, 2);
    ctx.fillStyle = 'rgba(25, 240, 255, 0.12)';
    ctx.fillRect(0, scanBarY - 2, GAME_WIDTH, 2);

    // VHS OSD Text
    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = "700 16px 'Russo One', Orbitron, monospace";
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.shadowColor = '#19f0ff';
    ctx.shadowBlur = 6;

    const seconds = Math.floor(time);
    const minutes = Math.floor(seconds / 60) % 60;
    const remainingSeconds = seconds % 60;
    const timeString = `SP 0:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;

    this.renderOsdText(ctx, '▶ PLAY', 26, 38, isRotated);
    this.renderOsdText(ctx, timeString, 26, 58, isRotated);
    ctx.restore();
  }

  private renderOsdText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    isRotated: boolean,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    if (isRotated) {
      ctx.rotate(Math.PI / 2);
    }
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
}
