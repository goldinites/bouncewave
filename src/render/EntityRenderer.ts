import { Particle, ShockwaveRing } from '@/render/particles';
import { Ball } from '@/match/Ball';
import { OVERDRIVE } from '@/match/Overdrive';
import { getRallyHeat } from '@/match/heat';
import { Paddle } from '@/match/Paddle';
import { glowMargin, sprites } from '@/render/SpriteCache';
import { TWO_PI } from '@/shared/math';
import { COLORS } from '@/shared/palette';

const CLIMAX_BALL_HUE = 34; // white-hot orange plasma at full climax
// Paddle neon in canvas pixels: always lit, flaring up to HOT on a hit
const PADDLE_GLOW = { BASE: 18, HOT: 48 } as const;

// The Overdrive meter rides along the player's paddle, on its goal side: one segment per
// perfect hit in the streak; once full they and the paddle's core pulse yellow. Charges an
// implants' core keeps after the streak broke are lit dimmer (ENERGY_ALPHA)
const OVERDRIVE_METER = {
  ENERGY_ALPHA: 0.45,
  GAP: 7, // px between the paddle and the meter
  SEGMENT: { WIDTH: 4, HEIGHT: 16, GAP: 5 },
  HALO: 3, // px of soft glow around a lit segment
  PULSE_SPEED: 10, // rad/s
} as const;

export class EntityRenderer {
  /** @param ctx
   @param paddle
   @param glow hit glow in [0, 1]
   @param overdrivePulse > 0 while the paddle's Overdrive is charged: its core pulses yellow
   @param tilt radians it leans by, about its center, positive clockwise */
  public static renderPaddle(
    ctx: CanvasRenderingContext2D,
    paddle: Paddle,
    glow: number,
    overdrivePulse = 0,
    tilt = 0,
  ): void {
    const { width, height } = paddle.spec;
    const topY = paddle.drawY - height / 2;

    ctx.save();
    if (tilt !== 0) {
      const centerX = paddle.x + width / 2;
      ctx.translate(centerX, paddle.drawY);
      ctx.rotate(tilt);
      ctx.translate(-centerX, -paddle.drawY);
    }
    // Pre-rendered neon; a hit fades the hot one in on top
    this.drawPaddleGlow(ctx, paddle, topY, PADDLE_GLOW.BASE);
    if (glow > 0.01) {
      ctx.globalAlpha = glow;
      this.drawPaddleGlow(ctx, paddle, topY, PADDLE_GLOW.HOT);
      ctx.globalAlpha = 1;
    }

    // Inner bright neon core, yellow-hot while Overdrive is charged
    ctx.shadowBlur = 0;
    ctx.fillStyle =
      overdrivePulse > 0
        ? `rgba(255, 229, 59, ${0.75 + 0.25 * overdrivePulse})`
        : `rgba(255, 255, 255, ${0.7 + glow * 0.3})`;
    this.roundRect(ctx, paddle.x + width / 2 - 2, topY + 8, 4, height - 16, 2);
    ctx.fill();

    ctx.restore();
  }

  private static drawPaddleGlow(
    ctx: CanvasRenderingContext2D,
    paddle: Paddle,
    topY: number,
    blur: number,
  ): void {
    sprites.draw(
      ctx,
      `paddle|${paddle.color}|${blur}|${paddle.spec.width}x${paddle.spec.height}`,
      paddle.x,
      topY,
      (_measureCtx, scale) => {
        const margin = glowMargin(blur, scale);
        return {
          left: -margin,
          top: -margin,
          width: paddle.spec.width + margin * 2,
          height: paddle.spec.height + margin * 2,
        };
      },
      (spriteCtx) => {
        spriteCtx.shadowColor = paddle.color;
        spriteCtx.shadowBlur = blur;
        spriteCtx.fillStyle = paddle.color;
        this.roundRect(spriteCtx, 0, 0, paddle.spec.width, paddle.spec.height, 6);
        spriteCtx.fill();
      },
    );
  }

  /**
   * Where each segment of a paddle's Overdrive meter stands: stacked along its goal side, filled
   * from the bottom up. Whatever the look draws them as.
   */
  public static meterSegments(paddle: Paddle): { x: number; y: number }[] {
    const { GAP, SEGMENT } = OVERDRIVE_METER;
    const x =
      paddle.side === 0 ? paddle.x - GAP - SEGMENT.WIDTH : paddle.x + paddle.spec.width + GAP;
    const columnHeight = OVERDRIVE.CHARGE * SEGMENT.HEIGHT + (OVERDRIVE.CHARGE - 1) * SEGMENT.GAP;
    return Array.from({ length: OVERDRIVE.CHARGE }, (_, i) => ({
      x,
      y: paddle.drawY + columnHeight / 2 - SEGMENT.HEIGHT - i * (SEGMENT.HEIGHT + SEGMENT.GAP),
    }));
  }

  /** A meter segment's size, px. */
  public static readonly METER_SEGMENT = OVERDRIVE_METER.SEGMENT;

  /** The player's Overdrive meter: segments along the goal side of their paddle, glowing. */
  public static renderOverdriveMeter(
    ctx: CanvasRenderingContext2D,
    paddle: Paddle,
    charge: number,
    time: number,
    streak: number = charge,
  ): void {
    const { SEGMENT, HALO, PULSE_SPEED, ENERGY_ALPHA } = OVERDRIVE_METER;
    const isFull = streak >= OVERDRIVE.CHARGE;
    const pulse = isFull ? 0.5 + 0.5 * Math.sin(time * PULSE_SPEED) : 1;
    const color = isFull ? COLORS.YELLOW : paddle.color;

    ctx.save();
    this.meterSegments(paddle).forEach(({ x, y }, i) => {
      const isLit = i < charge;
      if (isLit && i >= streak) {
        // Energy only: no halo, no pulse
        ctx.globalAlpha = ENERGY_ALPHA;
        ctx.fillStyle = paddle.color;
        ctx.fillRect(x, y, SEGMENT.WIDTH, SEGMENT.HEIGHT);
        return;
      }

      if (isLit) {
        // Halo as a wider faint block rather than shadowBlur
        ctx.globalAlpha = 0.18 + 0.17 * pulse;
        ctx.fillStyle = color;
        ctx.fillRect(x - HALO, y - HALO, SEGMENT.WIDTH + HALO * 2, SEGMENT.HEIGHT + HALO * 2);
      }

      ctx.globalAlpha = isLit ? 0.7 + 0.3 * pulse : 0.18;
      ctx.fillStyle = isLit ? color : '#ffffff';
      ctx.fillRect(x, y, SEGMENT.WIDTH, SEGMENT.HEIGHT);
    });
    ctx.restore();
  }

  /** The 0..1 pulse of a charged Overdrive, for the paddle's core. */
  public static overdrivePulse(charge: number, time: number): number {
    if (charge < OVERDRIVE.CHARGE) return 0;
    return 0.5 + 0.5 * Math.sin(time * OVERDRIVE_METER.PULSE_SPEED);
  }

  public static renderBall(
    ctx: CanvasRenderingContext2D,
    ball: Ball,
    rally: number,
    time: number,
    serveTime: number,
    climax = 0,
  ): void {
    ctx.save();

    ctx.globalAlpha = serveTime > 0 ? 0.05 : 1;

    const rallyIntensity = getRallyHeat(rally);
    // Climax pushes the plasma from yellow-green toward a white-hot orange
    const rallyHue = 52 + rallyIntensity * 30;
    const hue = rallyHue + (CLIMAX_BALL_HUE - rallyHue) * climax;
    const sat = 20 + rallyIntensity * 80;
    const glowSat = Math.min(100, sat + 35);
    const lit = 88 - rallyIntensity * 18 + climax * 8;
    const flicker =
      0.92 +
      Math.sin(time * (23 + climax * 17)) * 0.05 * (1 + climax * 1.5) +
      Math.random() * 0.04 * (1 + climax * 3);

    const currentRadius =
      serveTime > 0 ? ball.radius * (1 + 0.2 * Math.sin(time * 20)) : ball.radius;
    const x = ball.drawX;
    const y = ball.drawY;

    // Fading ball trail: one color, faded through globalAlpha (on top of the serve's fade)
    const baseAlpha = ctx.globalAlpha;
    const trailAlpha = 0.22 + rallyIntensity * 0.2;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `hsl(${hue}, ${glowSat}%, ${lit}%)`;
    ball.trail.forEach((point, index) => {
      const alpha = (index + 1) / ball.trail.length;
      ctx.globalAlpha = baseAlpha * alpha * trailAlpha;
      ctx.beginPath();
      ctx.arc(point.x, point.y, currentRadius * (0.35 + 0.55 * alpha), 0, TWO_PI);
      ctx.fill();
    });
    ctx.globalAlpha = baseAlpha;

    // Outer plasma corona
    const coronaRadius = currentRadius * (2 + rallyIntensity * 1.8 + climax * 1.6) * flicker;
    const coronaGradient = ctx.createRadialGradient(x, y, currentRadius * 0.6, x, y, coronaRadius);
    coronaGradient.addColorStop(0, `hsla(${hue}, ${glowSat}%, ${lit}%, 0.7)`);
    coronaGradient.addColorStop(0.35, `hsla(${hue + 10}, ${glowSat}%, ${lit - 12}%, 0.22)`);
    coronaGradient.addColorStop(1, `hsla(${hue + 25}, ${glowSat}%, ${lit - 15}%, 0)`);

    ctx.fillStyle = coronaGradient;
    ctx.beginPath();
    ctx.arc(x, y, coronaRadius, 0, TWO_PI);
    ctx.fill();

    // Tight glow hugging the core: a gradient ring, where shadowBlur would blur the core twice
    // a frame (and blurs cost more the hotter the ball burns)
    ctx.globalCompositeOperation = 'source-over';
    const haloRadius =
      currentRadius * (1 + 0.5 * (1.4 + rallyIntensity * 1.6 + climax * 1.4) * flicker);
    const haloGradient = ctx.createRadialGradient(x, y, currentRadius * 0.8, x, y, haloRadius);
    haloGradient.addColorStop(0, `hsla(${hue}, ${glowSat}%, ${lit - 8}%, 0.85)`);
    haloGradient.addColorStop(1, `hsla(${hue}, ${glowSat}%, ${lit - 8}%, 0)`);
    ctx.fillStyle = haloGradient;
    ctx.beginPath();
    ctx.arc(x, y, haloRadius, 0, TWO_PI);
    ctx.fill();

    // Solid ball core with inner gradient
    const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, currentRadius);
    coreGradient.addColorStop(0, COLORS.WHITE);
    coreGradient.addColorStop(0.45, `hsl(${hue - 6}, ${sat}%, ${Math.min(96, lit + 6)}%)`);
    coreGradient.addColorStop(1, `hsl(${hue + 14}, ${glowSat}%, ${lit - 12}%)`);

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(x, y, currentRadius, 0, TWO_PI);
    ctx.fill();

    // Internal electric arc filaments: they stay within 0.9 of the radius, so need no clip
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 2;

    for (let k = 0; k < 3; k++) {
      const arcAngle = time * (5 + k * 2) + k * 2.1;
      ctx.strokeStyle = `hsla(${hue + 20 + k * 14}, ${glowSat}%, ${70 + k * 5}%, 0.55)`;
      ctx.beginPath();
      ctx.arc(
        x + Math.cos(arcAngle * 0.7) * currentRadius * 0.35,
        y + Math.sin(arcAngle * 0.9) * currentRadius * 0.35,
        currentRadius * 0.55,
        arcAngle,
        arcAngle + 2.2,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  public static renderParticles(
    ctx: CanvasRenderingContext2D,
    particles: readonly Particle[],
  ): void {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
  }

  public static renderShockwaves(
    ctx: CanvasRenderingContext2D,
    rings: readonly ShockwaveRing[],
  ): void {
    ctx.globalCompositeOperation = 'lighter';
    for (const r of rings) {
      ctx.globalAlpha = r.life;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, TWO_PI);
      ctx.stroke();
    }
  }

  private static roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
  }
}
