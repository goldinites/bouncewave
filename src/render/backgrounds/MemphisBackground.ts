import { COURT } from '@/match/config';
import { Background, BackgroundFrame } from '@/render/backgrounds/Background';
import { measureText, paintText, sprites } from '@/render/SpriteCache';
import { mixHexColors, randomRange, TWO_PI } from '@/shared/math';
import { COLORS } from '@/shared/palette';

type MemphisShapeKind = 0 | 1 | 2 | 3 | 4 | 5;

interface MemphisShape {
  kind: MemphisShapeKind;
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
}

const SHAPE_COUNT = 24;
// Background gradient, cool at rest and hot at full climax or celebration
const GRADIENT_COOL = ['#1a0b4d', '#4a0f6e', '#7a1a73'];
const GRADIENT_HOT = ['#3d0a45', '#8f1460', '#c2432f'];
const CLIMAX_SPEEDUP = 2; // shapes move/spin up to (1 + this)× faster
const DROP_PUSH = 60; // px the drop shockwave throws shapes outward
const DROP_PEAK_TIME = 0.18; // s until the push peaks, then it eases back
// Envelope on the bass pulse that sizes the shapes (1/s): beats still pump,
// but a sudden loud hit swells over ~0.15 s instead of snapping
const PULSE_ATTACK = 12;
const PULSE_RELEASE = 6;

const SHAPE_COLORS = [COLORS.CYAN, COLORS.PINK, COLORS.YELLOW, COLORS.PURPLE];
const DOT_SPACING = 28;
const VHS_NOISE_STREAKS = 5;
const OSD_FONT = "700 16px 'Russo One', Orbitron, monospace";
const OSD_GLOW = 6;
const OSD_COLORS = {
  NORMAL: { text: 'rgba(255, 255, 255, 0.75)', glow: COLORS.CYAN },
  FAST_FORWARD: { text: 'rgba(255, 229, 59, 0.9)', glow: COLORS.PINK },
} as const;

/** 80s/90s Memphis design on a VHS screen: drifting shapes, dot grid, scan bar, OSD text. */
export class MemphisBackground implements Background {
  public readonly overlayTint = 0.3;
  private readonly shapes: MemphisShape[];

  // Shapes run on their own clock so speeding them up never makes them jump
  private shapeClock = 0;
  private shapePulse = 0;
  private dropAge = Infinity;
  private heat = 0;

  constructor() {
    this.shapes = Array.from({ length: SHAPE_COUNT }, (_, i) => ({
      kind: (i % 6) as MemphisShapeKind,
      x: Math.random() * COURT.WIDTH,
      y: Math.random() * COURT.HEIGHT,
      size: randomRange(14, 38),
      vx: (Math.random() - 0.5) * 16,
      vy: randomRange(6, 16),
      rotation: Math.random() * 6,
      rotationSpeed: (Math.random() - 0.5) * 1.2,
      color: SHAPE_COLORS[i % SHAPE_COLORS.length],
    }));
  }

  /** Throws the shapes outward; they ease back on their own (used by the victory). */
  public triggerDrop(): void {
    this.dropAge = 0;
  }

  /**
   * Advances the shapes' motion. Called every frame even while another background is shown,
   * so switching backgrounds never makes the shapes jump.
   * @param heat how hard the shapes dance, in [0, 1] (climax or celebration)
   */
  public advance(dt: number, pulse: number, heat: number): void {
    this.heat = heat;
    this.shapeClock += dt * (1 + CLIMAX_SPEEDUP * heat);
    this.dropAge += dt;

    // Shapes swell with an envelope instead of the raw pulse, so a single loud hit
    // (the climax drop's full-volume kick) can't make them jump in size in one frame
    const rate = pulse > this.shapePulse ? PULSE_ATTACK : PULSE_RELEASE;
    this.shapePulse += (pulse - this.shapePulse) * Math.min(1, dt * rate);
  }

  public render(frame: BackgroundFrame): void {
    const { ctx, time } = frame;

    // Gradient heats up toward pink/orange during the climax
    const bgGradient = ctx.createLinearGradient(0, 0, COURT.WIDTH, COURT.HEIGHT);
    [0, 0.55, 1].forEach((stop, i) => {
      bgGradient.addColorStop(stop, mixHexColors(GRADIENT_COOL[i], GRADIENT_HOT[i], this.heat));
    });
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);

    // Drifting grid dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    const offset = (time * 10) % DOT_SPACING;
    for (let y = -DOT_SPACING + offset; y < COURT.HEIGHT; y += DOT_SPACING) {
      for (let x = -DOT_SPACING + offset; x < COURT.WIDTH; x += DOT_SPACING) {
        ctx.fillRect(x, y, 2, 2);
      }
    }

    this.renderShapes(ctx);
    this.renderVhsOverlay(ctx, time);
    this.renderOsd(frame);
  }

  /** Outward push in px: rises smoothly from 0, peaks at DROP_PEAK_TIME, then fades. */
  private getDropPush(): number {
    if (!Number.isFinite(this.dropAge)) return 0;
    const t = this.dropAge / DROP_PEAK_TIME;
    return DROP_PUSH * t * Math.exp(1 - t);
  }

  /** Geometric shapes; they dance harder and glow brighter as the heat rises. */
  private renderShapes(ctx: CanvasRenderingContext2D): void {
    const clock = this.shapeClock;
    const pulse = this.shapePulse;
    const dropPush = this.getDropPush();
    const pulseScale = 0.25 + 0.35 * this.heat;
    const alphaBoost = 0.2 * this.heat;

    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    for (const shape of this.shapes) {
      let x = (((shape.x + shape.vx * clock) % COURT.WIDTH) + COURT.WIDTH) % COURT.WIDTH;
      let y = (((shape.y + shape.vy * clock) % COURT.HEIGHT) + COURT.HEIGHT) % COURT.HEIGHT;

      if (dropPush > 0.5) {
        const dx = x - COURT.WIDTH / 2;
        const dy = y - COURT.HEIGHT / 2;
        const distance = Math.hypot(dx, dy) || 1;
        x += (dx / distance) * dropPush;
        y += (dy / distance) * dropPush;
      }

      const s = shape.size * (1 + pulse * pulseScale);
      const isFilled = shape.kind > 3;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(shape.rotation + shape.rotationSpeed * clock);
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.globalAlpha = Math.min(
        1,
        (isFilled ? 0.35 + pulse * 0.2 : 0.55 + pulse * 0.3) + alphaBoost,
      );

      ctx.beginPath();
      this.tracePath(ctx, shape.kind, s);
      if (isFilled) {
        ctx.fill();
      } else {
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private tracePath(ctx: CanvasRenderingContext2D, kind: MemphisShapeKind, s: number): void {
    switch (kind) {
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
  }

  /** Random noise streaks and a rolling scan bar with RGB fringes. */
  private renderVhsOverlay(ctx: CanvasRenderingContext2D, time: number): void {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
    for (let i = 0; i < VHS_NOISE_STREAKS; i++) {
      ctx.fillRect(
        Math.random() * COURT.WIDTH,
        Math.random() * COURT.HEIGHT,
        20 + Math.random() * 120,
        1 + Math.random() * 1.5,
      );
    }

    const scanBarY = ((time * 55) % (COURT.HEIGHT + 90)) - 45;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, scanBarY, COURT.WIDTH, 22);
    ctx.fillStyle = 'rgba(255, 43, 214, 0.12)';
    ctx.fillRect(0, scanBarY + 22, COURT.WIDTH, 2);
    ctx.fillStyle = 'rgba(25, 240, 255, 0.12)';
    ctx.fillRect(0, scanBarY - 2, COURT.WIDTH, 2);
  }

  /** VCR on-screen display: play state and tape counter. */
  private renderOsd({ ctx, time, isRotated, climax }: BackgroundFrame): void {
    const seconds = Math.floor(time);
    const minutes = Math.floor(seconds / 60) % 60;
    const remainingSeconds = seconds % 60;
    const timeString = `SP 0:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;

    const playTextX = isRotated ? 46 : 26;
    const timeTextY = isRotated ? 38 : 58;

    // VCR fast-forward during the climax
    const isFastForward = climax > 0.5;
    this.renderOsdText(
      ctx,
      isFastForward ? '▶▶ FF' : '▶ PLAY',
      isFastForward ? OSD_COLORS.FAST_FORWARD : OSD_COLORS.NORMAL,
      playTextX,
      38,
      isRotated,
    );
    this.renderOsdText(ctx, timeString, OSD_COLORS.NORMAL, 26, timeTextY, isRotated);
  }

  /** Pre-rendered glowing text; the tape counter only changes once a second. */
  private renderOsdText(
    ctx: CanvasRenderingContext2D,
    text: string,
    colors: { text: string; glow: string },
    x: number,
    y: number,
    isRotated: boolean,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    if (isRotated) {
      ctx.rotate(Math.PI / 2);
    }
    sprites.draw(
      ctx,
      `osd|${colors.text}|${text}`,
      0,
      0,
      (measureCtx, scale) => measureText(measureCtx, scale, text, OSD_FONT, OSD_GLOW, 'left'),
      (spriteCtx) =>
        paintText(spriteCtx, text, OSD_FONT, colors.text, OSD_GLOW, colors.glow, 'left'),
    );
    ctx.restore();
  }
}
