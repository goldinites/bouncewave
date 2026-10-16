import { COURT } from '@/match/config';
import { Background, BackgroundFrame } from '@/render/backgrounds/Background';
import { clamp, lerp, randomRange, TWO_PI } from '@/shared/math';
import { COLORS } from '@/shared/palette';

interface Star {
  angle: number;
  /** Progress from the vanishing point (0) to the edge of the tunnel (1). */
  distance: number;
  speed: number;
  trailLength: number;
}

const STAR_COUNT = 90;
const STAR_SPEED = { BASE: 0.22, CLIMAX: 1.1 }; // progress/s, center to edge
const STAR_TRAIL = { BASE: 10, CLIMAX: 90 }; // px — the hyperspace streak at full heat

const RING_COUNT = 13;
const RING_SPEED = { BASE: 0.3, CLIMAX: 1.15 }; // loops/s
const RING_SPIN = 0.05; // rad/s the whole tunnel slowly rolls, so it never looks static
// Neon on the rings without shadowBlur: a wide faint stroke under each one
const RING_HALO = { WIDTH: 5, ALPHA: 0.3 } as const;

const CORE_RADIUS = 15;
const CORE_SPIN_SPEED = 0.7; // rad/s at rest

// How far laserIntensity (full behind the menus, low during play) is allowed to dim things
// that sit right where the ball travels. A floor, not a straight multiply, so play never goes
// dark — just calmer than the menus' full glam. The core sits exactly on the ball; the rings
// are the same idea applied more gently, since only their innermost few are ever that close.
const CORE_INTENSITY_FLOOR = 0.3;
const RING_INTENSITY_FLOOR = 0.55;

// Victory/climax-drop shockwave: a bright ring punches out from the core and fades
const DROP_DURATION = 0.5;

// Outside of a climax the tunnel's own color drifts on its own slow clock — blue to green to
// violet and back — rather than sitting on one fixed hue forever. A climax still overrides it
// with the usual hot pink/orange, same as every other background's heat language.
const AMBIENT_HUE_SPEED = 3; // deg/s — a full lap of the color wheel takes two minutes
const HOT_HUE = 322; // COLORS.PINK's hue

/** Hue in degrees, taking the shorter way around the color wheel. */
function lerpHue(from: number, to: number, t: number): number {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return (from + delta * t + 360) % 360;
}

// The rings cycle through this list of shapes forever: triangle, square, then a polygon round
// enough to read as a circle. "Sides" is just a number a regular-polygon formula takes, so
// easing from one entry to the next — 3 toward 4, 4 toward 44 — morphs the actual geometry
// (corners rounding off or sharpening) instead of cross-fading between two fixed shapes.
const SHAPE_CYCLE = [3, 4, 44];
const SHAPE_LEG_DURATION = 20; // s to morph from one shape in the cycle to the next
const SHAPE_SAMPLES = 48; // outline points per ring; enough to read as round at 44 "sides"

/** A point on a regular polygon's outline (possibly a fractional side count, mid-morph). */
function polygonPoint(angle: number, sides: number, circumradius: number): [number, number] {
  const sector = TWO_PI / sides;
  const folded = (((angle % sector) + sector) % sector) - sector / 2;
  const r = (circumradius * Math.cos(Math.PI / sides)) / Math.cos(folded);
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}

/**
 * A vector-graphics hyperspace tunnel: streaking stars and receding neon rings rushing past a
 * spinning wireframe core at the vanishing point — the arcade vector-game image (Star Wars,
 * Battlezone, Elite) rather than a synthwave landscape. Built around the canvas center, so
 * unlike a horizon it reads the same right-side up on a portrait phone with no extra work.
 */
export class HyperspaceBackground implements Background {
  public readonly overlayTint = 0.26;

  private readonly stars: Star[];
  private ringClock = 0;
  private ringSpin = 0;
  private coreSpin = 0;
  private dropAge = Infinity;

  constructor() {
    this.stars = Array.from({ length: STAR_COUNT }, () => this.resetStar(Math.random()));
  }

  public triggerDrop(): void {
    this.dropAge = 0;
  }

  /** Keeps the tunnel rushing and the stars streaking even while another background is shown. */
  public advance(dt: number, _pulse: number, heat: number): void {
    this.dropAge += dt;

    const ringSpeed = RING_SPEED.BASE + (RING_SPEED.CLIMAX - RING_SPEED.BASE) * heat;
    this.ringClock += dt * ringSpeed;
    this.ringSpin += dt * RING_SPIN;
    this.coreSpin += dt * (CORE_SPIN_SPEED + heat * 1.5);

    const starSpeed = STAR_SPEED.BASE + (STAR_SPEED.CLIMAX - STAR_SPEED.BASE) * heat;
    for (const star of this.stars) {
      star.distance += dt * star.speed * (starSpeed / STAR_SPEED.BASE);
      if (star.distance > 1) Object.assign(star, this.resetStar(0));
    }
  }

  public render(frame: BackgroundFrame): void {
    const { ctx, time, pulse, climax, celebration, laserIntensity } = frame;
    const heat = Math.max(climax, celebration);
    const ambientHue = (time * AMBIENT_HUE_SPEED) % 360;
    const cyclePos = (time / SHAPE_LEG_DURATION) % SHAPE_CYCLE.length;
    const legIndex = Math.floor(cyclePos);
    const sides = lerp(
      SHAPE_CYCLE[legIndex],
      SHAPE_CYCLE[(legIndex + 1) % SHAPE_CYCLE.length],
      cyclePos - legIndex,
    );
    const cx = COURT.WIDTH / 2;
    const cy = COURT.HEIGHT / 2;
    const maxRadius = Math.hypot(COURT.WIDTH, COURT.HEIGHT) / 2 + 30;

    // The backdrop stays dark, but its faint tint drifts with the same ambient hue — subtler
    // than the rings and core since it only ever reaches low lightness
    const skyHue = lerpHue(ambientHue, HOT_HUE, heat);
    const sky = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
    sky.addColorStop(0, `hsl(${skyHue}, 55%, ${14 + heat * 8}%)`);
    sky.addColorStop(0.55, `hsl(${skyHue}, 50%, ${8 + heat * 6}%)`);
    sky.addColorStop(1, '#020108');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);

    // Only the core sits exactly on the ball and the net line, so only it needs to clear out
    // of the player's way during play; the rings get a gentler version of the same easing, and
    // the stars — spread across the whole frame, never under the ball specifically — stay as
    // lively as ever. (Full-strength laserIntensity would flatten the whole scene at once,
    // like the laser background's beams do, which is right for an atmospheric wash but leaves
    // a tunnel with nothing left to look at.)
    this.renderStars(ctx, cx, cy, maxRadius, heat);
    this.renderTunnel(ctx, cx, cy, maxRadius, heat, laserIntensity, ambientHue, sides);
    this.renderDropShockwave(ctx, cx, cy, maxRadius);
    this.renderCore(ctx, cx, cy, heat, pulse, laserIntensity, ambientHue);
  }

  private resetStar(distance: number): Star {
    return {
      angle: Math.random() * TWO_PI,
      distance,
      speed: randomRange(0.6, 1.4),
      trailLength: randomRange(0.6, 1.4),
    };
  }

  /** Points of light streaking outward from the core; the streak stretches with the heat. */
  private renderStars(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    maxRadius: number,
    heat: number,
  ): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    for (const star of this.stars) {
      const inner = star.distance * maxRadius;
      const trail =
        (STAR_TRAIL.BASE + (STAR_TRAIL.CLIMAX - STAR_TRAIL.BASE) * heat) * star.trailLength;
      const outer = Math.min(maxRadius, inner + trail);
      const dx = Math.cos(star.angle);
      const dy = Math.sin(star.angle);

      ctx.strokeStyle = COLORS.WHITE;
      ctx.globalAlpha = 0.15 + star.distance * 0.55;
      ctx.lineWidth = 0.6 + star.distance * 1.8;
      ctx.beginPath();
      ctx.moveTo(cx + dx * inner, cy + dy * inner);
      ctx.lineTo(cx + dx * outer, cy + dy * outer);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Concentric shapes rushing out from the vanishing point, the ambient hue cooling to hot
   * pink. `sides` morphs the rings between triangle, square and circle over its own slow clock.
   */
  private renderTunnel(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    maxRadius: number,
    heat: number,
    laserIntensity: number,
    ambientHue: number,
    sides: number,
  ): void {
    const visibility = RING_INTENSITY_FLOOR + (1 - RING_INTENSITY_FLOOR) * laserIntensity;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.ringSpin);

    for (let i = 0; i < RING_COUNT; i++) {
      const progress = ((i / RING_COUNT + this.ringClock) % 1) + 1e-6;
      const eased = progress * progress; // bunch up near the core, like the other backgrounds' grids
      const radius = eased * maxRadius;
      const hue = lerpHue(ambientHue, HOT_HUE, heat * 0.6 + (1 - progress) * 0.4);
      const color = `hsl(${hue}, 90%, 58%)`;

      const alpha = (1 - progress) * 0.55 * visibility;
      const lineWidth = 1.5 + (1 - progress) * 1.5;
      ctx.strokeStyle = color;

      ctx.beginPath();
      for (let s = 0; s <= SHAPE_SAMPLES; s++) {
        const [x, y] = polygonPoint((s / SHAPE_SAMPLES) * TWO_PI, sides, radius);
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.globalAlpha = alpha * RING_HALO.ALPHA;
      ctx.lineWidth = lineWidth + RING_HALO.WIDTH;
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The victory/climax-drop shockwave: one bright ring punching out from the core. */
  private renderDropShockwave(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    maxRadius: number,
  ): void {
    if (this.dropAge >= DROP_DURATION) return;

    const t = this.dropAge / DROP_DURATION;
    const radius = maxRadius * t;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - t) * 0.8;
    ctx.strokeStyle = COLORS.WHITE;
    ctx.lineWidth = 6 * (1 - t) + 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TWO_PI);
    ctx.stroke();
    ctx.restore();
  }

  /** A small spinning wireframe diamond glowing at the vanishing point — the light at the end. */
  private renderCore(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    heat: number,
    pulse: number,
    laserIntensity: number,
    ambientHue: number,
  ): void {
    const glowRadius = CORE_RADIUS * (1.8 + pulse * 1.2 + heat * 0.6);
    const color = `hsl(${lerpHue(ambientHue, HOT_HUE, heat)}, 90%, 58%)`;
    const visibility = CORE_INTENSITY_FLOOR + (1 - CORE_INTENSITY_FLOOR) * laserIntensity;

    ctx.save();
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    glow.addColorStop(0.4, color);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = visibility;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, TWO_PI);
    ctx.fill();
    ctx.restore();

    const size = CORE_RADIUS * (0.9 + pulse * 0.3);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.coreSpin);
    ctx.strokeStyle = COLORS.WHITE;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = clamp(0.6 + pulse * 0.4, 0, 1) * visibility;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}
