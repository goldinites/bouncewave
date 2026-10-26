import { Flare, Particle, ShockwaveRing } from '@/render/particles';
import { Ball } from '@/match/Ball';
import { OVERDRIVE } from '@/match/Overdrive';
import { getRallyHeat } from '@/match/heat';
import { Paddle } from '@/match/Paddle';
import { Squash } from '@/render/scene';
import { glowMargin, sprites } from '@/render/SpriteCache';
import { TWO_PI } from '@/shared/math';
import { COLORS } from '@/shared/palette';

const CLIMAX_BALL_HUE = 34; // white-hot orange plasma at full climax
// A squashed ball: flattened along its axis by this share of its squash, widened across it by
// SPREAD of that (the plasma keeps roughly its area)
const SQUASH_SHAPE = { FLATTEN: 0.45, SPREAD: 0.6 } as const;
// A wave's wake: the soft glow inside its front, this much as bright as the front
const WAKE_ALPHA = 0.22;
// A spark's streak: as long as STREAK s of its flight, at least a dot
const STREAK = 0.022; // s
// A perfect hit's star glint: rays THICK px at the root, the upright ones UPRIGHT of the
// level ones' reach
const GLINT = { THICK: 4, UPRIGHT: 0.55 } as const;
// A ball struck perfectly burns white-hot a moment: its plasma whitened by this share at most,
// its corona this much wider
const WHITE_HOT = { LIGHT: 0.85, CORONA: 0.6 } as const;
// Paddle neon in canvas pixels: always lit, flaring up to HOT on a hit
const PADDLE_GLOW = { BASE: 18, HOT: 48 } as const;
// The tutorial's mark on a paddle's perfect zone: a band of yellow light a little wider than the
// paddle, throbbing gently (steady with reduced motion)
const PERFECT_MARK = { OVERHANG: 4, GLOW: 14, PULSE: 6 } as const; // px, px, rad/s

// The Overdrive meter rides along the player's paddle, on its goal side: one segment per
// perfect hit in the streak; once full they and the paddle's core pulse yellow. Charges an
// implants' core keeps after the streak broke are lit plainly, with no glow: still clearly
// there (an empty segment is a faint white one), but not the streak's
const OVERDRIVE_METER = {
  ENERGY_ALPHA: 0.9,
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
   @param tilt radians it leans by, about its center, positive clockwise
   @param perfectMark how brightly its perfect zone is marked, in [0, 1] (the tutorial); 0 for none
   @param recoil px it is knocked back toward its own goal by a hit */
  public static renderPaddle(
    ctx: CanvasRenderingContext2D,
    paddle: Paddle,
    glow: number,
    overdrivePulse = 0,
    tilt = 0,
    perfectMark = 0,
    recoil = 0,
  ): void {
    const { width, height } = paddle.spec;
    const topY = paddle.drawY - height / 2;

    ctx.save();
    if (recoil !== 0) ctx.translate(paddle.side === 0 ? -recoil : recoil, 0);
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

    if (perfectMark > 0) {
      const zone = paddle.spec.perfectZone * height; // the zone, both halves
      ctx.globalAlpha = perfectMark;
      ctx.shadowColor = COLORS.YELLOW;
      ctx.shadowBlur = PERFECT_MARK.GLOW;
      ctx.fillStyle = COLORS.YELLOW;
      this.roundRect(
        ctx,
        paddle.x - PERFECT_MARK.OVERHANG,
        paddle.drawY - zone / 2,
        width + PERFECT_MARK.OVERHANG * 2,
        zone,
        3,
      );
      ctx.fill();
    }

    ctx.restore();
  }

  /** How brightly a marked perfect zone shows at `time`: throbbing, or steady for less motion. */
  public static perfectMarkAt(time: number, isMotionReduced: boolean): number {
    return isMotionReduced ? 0.9 : 0.7 + 0.3 * Math.sin(time * PERFECT_MARK.PULSE);
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
    spent = 0,
  ): void {
    const { SEGMENT, HALO, PULSE_SPEED, ENERGY_ALPHA } = OVERDRIVE_METER;
    const isFull = streak >= OVERDRIVE.CHARGE;
    const pulse = isFull ? 0.5 + 0.5 * Math.sin(time * PULSE_SPEED) : 1;
    const color = isFull ? COLORS.YELLOW : paddle.color;

    ctx.save();
    this.meterSegments(paddle).forEach(({ x, y }, i) => {
      const isLit = i < charge;
      if (i === charge && spent > 0) {
        // The charge the core just lost (spent, or to a hit that wasn't perfect): a white flare
        const flicker = spent > 0.5 ? (Math.floor(time * 30) % 2 === 0 ? 1 : 0.4) : 1;
        ctx.globalAlpha = spent * flicker;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - HALO, y - HALO, SEGMENT.WIDTH + HALO * 2, SEGMENT.HEIGHT + HALO * 2);
        return;
      }
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
    squash: Squash | null = null,
    whiteHot = 0,
  ): void {
    ctx.save();

    ctx.globalAlpha = serveTime > 0 ? 0.05 : 1;

    const rallyIntensity = getRallyHeat(rally);
    // Climax pushes the plasma from yellow-green toward a white-hot orange
    const rallyHue = 52 + rallyIntensity * 30;
    const hue = rallyHue + (CLIMAX_BALL_HUE - rallyHue) * climax;
    // Struck perfectly, it burns white-hot a moment
    const white = whiteHot * WHITE_HOT.LIGHT;
    const sat = (20 + rallyIntensity * 80) * (1 - white);
    const glowSat = Math.min(100, sat + 35) * (1 - white);
    const plainLit = 88 - rallyIntensity * 18 + climax * 8;
    const lit = plainLit + (97 - plainLit) * white;
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

    // Struck, the ball flattens against what struck it, and stretches as it springs back
    if (squash && squash.amount !== 0) {
      const along = 1 - squash.amount * SQUASH_SHAPE.FLATTEN;
      const across = 1 + squash.amount * SQUASH_SHAPE.FLATTEN * SQUASH_SHAPE.SPREAD;
      ctx.translate(x, y);
      if (squash.axis === 'x') ctx.scale(along, across);
      else ctx.scale(across, along);
      ctx.translate(-x, -y);
    }

    // Outer plasma corona
    const coronaRadius =
      currentRadius *
      (2 + rallyIntensity * 1.8 + climax * 1.6) *
      flicker *
      (1 + WHITE_HOT.CORONA * whiteHot);
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
      if (p.isStreak) {
        // A spark struck off a hit: a streak along its flight, thinning as it dies
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * (0.4 + 0.6 * p.life);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * STREAK, p.y - p.vy * STREAK);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.lineCap = 'butt';
  }

  /** The flashes of contact: a white-hot core in a ball of the struck thing's light. */
  public static renderFlares(ctx: CanvasRenderingContext2D, flares: readonly Flare[]): void {
    ctx.globalCompositeOperation = 'lighter';
    for (const f of flares) {
      ctx.globalAlpha = f.life;
      const radius = f.radius * (0.6 + 0.4 * f.life);
      const gradient = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, radius);
      gradient.addColorStop(0, COLORS.WHITE);
      gradient.addColorStop(0.25, COLORS.WHITE);
      gradient.addColorStop(0.5, f.color);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(f.x, f.y, radius, 0, TWO_PI);
      ctx.fill();
      if (f.spikes > 0) this.drawGlint(ctx, f);
    }
    ctx.globalAlpha = 1;
  }

  /** A star glint's four rays: white at the root, the level ones longer, shrinking as it dies. */
  private static drawGlint(ctx: CanvasRenderingContext2D, f: Flare): void {
    const thick = GLINT.THICK * f.life;
    for (const [reach, isLevel] of [
      [f.spikes * (0.5 + 0.5 * f.life), true],
      [f.spikes * GLINT.UPRIGHT * (0.5 + 0.5 * f.life), false],
    ] as const) {
      const ray = isLevel
        ? ctx.createLinearGradient(f.x - reach, 0, f.x + reach, 0)
        : ctx.createLinearGradient(0, f.y - reach, 0, f.y + reach);
      ray.addColorStop(0, 'rgba(255, 255, 255, 0)');
      ray.addColorStop(0.5, COLORS.WHITE);
      ray.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = ray;
      if (isLevel) ctx.fillRect(f.x - reach, f.y - thick / 2, reach * 2, thick);
      else ctx.fillRect(f.x - thick / 2, f.y - reach, thick, reach * 2);
    }
  }

  public static renderShockwaves(
    ctx: CanvasRenderingContext2D,
    rings: readonly ShockwaveRing[],
  ): void {
    ctx.globalCompositeOperation = 'lighter';
    for (const r of rings) {
      ctx.strokeStyle = r.color;
      if (r.wake > 0 && r.radius > r.wake) {
        // A wave: a band of soft light trailing just inside the front
        ctx.globalAlpha = r.life * WAKE_ALPHA;
        ctx.lineWidth = r.wake;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius - r.wake / 2, 0, TWO_PI);
        ctx.stroke();
      }
      ctx.globalAlpha = r.life;
      ctx.lineWidth = r.width * (0.5 + 0.5 * r.life);
      ctx.beginPath();
      if (r.heading === undefined || r.spread === undefined) {
        ctx.arc(r.x, r.y, r.radius, 0, TWO_PI);
      } else {
        ctx.arc(r.x, r.y, r.radius, r.heading - r.spread / 2, r.heading + r.spread / 2);
      }
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
