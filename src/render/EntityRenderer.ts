import { Particle, ShockwaveRing } from '@/fx/ParticleSystem';
import { Ball } from '@/match/Ball';
import { PADDLE } from '@/match/config';
import { getRallyHeat } from '@/match/heat';
import { Paddle } from '@/match/Paddle';
import { TWO_PI } from '@/shared/math';
import { COLORS } from '@/shared/palette';

const CLIMAX_BALL_HUE = 34; // white-hot orange plasma at full climax

export class EntityRenderer {
  /** @param ctx
   @param paddle
   @param glow hit glow in [0, 1] */
  public static renderPaddle(ctx: CanvasRenderingContext2D, paddle: Paddle, glow: number): void {
    const topY = paddle.y - PADDLE.HEIGHT / 2;

    ctx.save();
    ctx.shadowColor = paddle.color;
    ctx.shadowBlur = 18 + glow * 30;
    ctx.fillStyle = paddle.color;

    this.roundRect(ctx, paddle.x, topY, PADDLE.WIDTH, PADDLE.HEIGHT, 6);
    ctx.fill();

    // Inner bright neon core
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + glow * 0.3})`;
    this.roundRect(ctx, paddle.x + PADDLE.WIDTH / 2 - 2, topY + 8, 4, PADDLE.HEIGHT - 16, 2);
    ctx.fill();

    ctx.restore();
  }

  /** Flat white block, no glow or rounded corners — a paddle as it looked in 1972. */
  public static renderClassicPaddle(ctx: CanvasRenderingContext2D, paddle: Paddle): void {
    const topY = paddle.y - PADDLE.HEIGHT / 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(paddle.x, topY, PADDLE.WIDTH, PADDLE.HEIGHT);
  }

  /** The ball as a plain white square, the way the original hardware drew it. */
  public static renderClassicBall(ctx: CanvasRenderingContext2D, ball: Ball): void {
    const size = ball.radius * 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ball.x - ball.radius, ball.y - ball.radius, size, size);
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
    const x = ball.x;
    const y = ball.y;

    // Fading ball trail
    ctx.globalCompositeOperation = 'lighter';
    ball.trail.forEach((point, index) => {
      const alpha = (index + 1) / ball.trail.length;
      ctx.fillStyle = `hsla(${hue}, ${glowSat}%, ${lit}%, ${alpha * (0.22 + rallyIntensity * 0.2)})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, currentRadius * (0.35 + 0.55 * alpha), 0, TWO_PI);
      ctx.fill();
    });

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

    // Solid ball core with inner gradient
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.shadowColor = `hsl(${hue}, ${glowSat}%, ${lit - 8}%)`;
    ctx.shadowBlur = currentRadius * (1.4 + rallyIntensity * 1.6 + climax * 1.4) * flicker;

    const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, currentRadius);
    coreGradient.addColorStop(0, COLORS.WHITE);
    coreGradient.addColorStop(0.45, `hsl(${hue - 6}, ${sat}%, ${Math.min(96, lit + 6)}%)`);
    coreGradient.addColorStop(1, `hsl(${hue + 14}, ${glowSat}%, ${lit - 12}%)`);

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(x, y, currentRadius, 0, TWO_PI);
    ctx.fill();
    ctx.shadowBlur = currentRadius * (0.6 + rallyIntensity * 0.5) * flicker;
    ctx.fill();
    ctx.restore();

    // Internal electric arc filaments
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, currentRadius, 0, TWO_PI);
    ctx.clip();
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

  public static renderParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
  }

  public static renderShockwaves(ctx: CanvasRenderingContext2D, rings: ShockwaveRing[]): void {
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
