import { COURT } from '@/match/config';
import { Background, BackgroundFrame } from '@/render/backgrounds/Background';
import { clamp, mixHexColors } from '@/shared/math';
import { COLORS } from '@/shared/palette';

// The first tier of the challenges (docs/CHALLENGES.md): an underground league in an old
// warehouse. Corrugated walls under a steel truss, lamps swinging on their wires through the
// smoke, crates, a crowd behind a chain-link fence, and on the wall a homemade neon pong sign

// Where things stand, as shares of the frame's height (or width), so either orientation fits
const LAYOUT = {
  TRUSS: 0.08, // the truss's lower chord
  FLOOR: 0.66, // where the wall meets the concrete
  FENCE: 0.16, // the fence's height above the floor
  SIGN_Y: 0.4, // the sign's middle, below the HUD's condition line and above the fence
} as const;

const WALL = { COOL: ['#100722', '#0c051c'], HOT: ['#22081f', '#1a0619'], RIB: 12 } as const;
const TRUSS_COLOR = '#231140';
const FLOOR_COLOR = '#0c0716';
const CRATE = { FILL: '#24122d', EDGE: '#3a2044' } as const;
const CROWD_COLOR = '#030108';
const FENCE = { ALPHA: 0.2, MESH: 16 } as const;
// Warm tungsten light: not a palette neon, it's what makes the place feel real
const LAMP = { COLOR: '#ffb347', CORE: '#fff1d6', COUNT: 3, WIRE: 0.2, SWING: 0.16 } as const;
const LAMP_SWING_SPEED = 1.2; // rad/s of the swing's phase
const CONE = { HALF_TOP: 8, HALF_FLOOR: 0.15, ALPHA: 0.24 } as const;
// Light from the far end of the hall behind the crowd, so their silhouettes read against it
const BACKLIGHT = { HEIGHT: 0.2, ALPHA: 0.5 } as const;

// The sign: three hollow tubes and a hollow square, never filled, so nothing on it can pass
// for a real paddle or the real ball
const SIGN = { WIDTH: 240, HEIGHT: 92, TUBE: 3, HALO: 7, HALO_ALPHA: 0.28 } as const;
const SIGN_BALL_SPEED = 4; // shares of the flight per second, from one paddle to the other
const SIGN_FLICKER = { RATE: 9, SHARE: 0.04 } as const;

const PEOPLE = 46;
const ARM_SHARE = 0.55; // of the crowd with an arm to raise
const SPECTRUM_BARS = 12; // the crowd shares this many analyzer bars, a group each
const PHONE_FLASH = { RATE: 2.5, SHARE: 0.03 } as const;
const SMOKE = { COUNT: 4, SPEED: 0.012 } as const; // drift in shares of the width per second

// How far laserIntensity (full behind the menus, low during play) may dim the lamps: a floor,
// so the warehouse stays lit, only calmer while the ball is in play
const LIGHT_INTENSITY_FLOOR = 0.6;
const DROP_DURATION = 0.7; // s the lamps flare and the crowd jumps on a victory

interface Person {
  x: number;
  height: number;
  phase: number;
  hasArm: boolean;
  bar: number;
}

interface Layout {
  width: number;
  height: number;
  trussY: number;
  floorY: number;
  scale: number;
}

/** A small seeded PRNG (mulberry32), so the crowd and the crates are the same on every visit. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable pseudo-random value in [0, 1) for a pair of integers. */
function hash(a: number, b: number): number {
  let h = Math.imul(a, 0x27d4eb2d) ^ Math.imul(b + 0x165667b1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const createCrowd = (): Person[] => {
  const random = seededRandom(17);
  return Array.from({ length: PEOPLE }, (_, i) => ({
    x: (i + 0.5 + (random() - 0.5) * 0.6) / PEOPLE,
    height: 0.8 + random() * 0.4,
    phase: random() * Math.PI * 2,
    hasArm: random() < ARM_SHARE,
    bar: Math.floor(random() * SPECTRUM_BARS),
  }));
};

export class WarehouseBackground implements Background {
  public readonly scene = 'warehouse';
  public readonly overlayTint = 0.18;

  private readonly crowd = createCrowd();
  private readonly lampPhases = Array.from({ length: LAMP.COUNT }, (_, i) => i * 2.1);
  private readonly smoke = Array.from({ length: SMOKE.COUNT }, (_, i) => ({
    x: i / SMOKE.COUNT + Math.random() * 0.1,
    y: 0.25 + Math.random() * 0.5,
    size: 0.35 + Math.random() * 0.25,
  }));
  private readonly reducedMotion =
    typeof window === 'undefined' ? null : window.matchMedia('(prefers-reduced-motion: reduce)');
  /** Where the sign's square is on its flight: 0 at the cyan paddle, 1 at the pink. */
  private signBall = 0;
  private signBallTarget = 0;
  private lastPulse = 0;
  private dropAge = Infinity;
  private gradients: {
    key: string;
    cone: CanvasGradient;
    smoke: CanvasGradient;
    pool: CanvasGradient;
    backlight: CanvasGradient;
  } | null = null;

  public triggerDrop(): void {
    this.dropAge = 0;
  }

  private get isStill(): boolean {
    return this.reducedMotion?.matches ?? false;
  }

  /**
   * Swings the lamps, drifts the smoke and sends the sign's square across on every beat, even
   * while another background is shown. With reduced motion everything hangs still.
   */
  public advance(dt: number, pulse: number, heat: number): void {
    this.dropAge += dt;
    const isBeat = pulse > 0.8 && this.lastPulse <= 0.5;
    this.lastPulse = pulse;
    if (this.isStill) return;

    const swing = LAMP_SWING_SPEED * (1 + heat);
    for (let i = 0; i < LAMP.COUNT; i++) this.lampPhases[i] += dt * swing;
    for (const puff of this.smoke) puff.x = (puff.x + dt * SMOKE.SPEED * (1 + heat)) % 1.3;

    if (isBeat) this.signBallTarget = 1 - this.signBallTarget;
    const step = dt * SIGN_BALL_SPEED;
    this.signBall += clamp(this.signBallTarget - this.signBall, -step, step);
  }

  public render(frame: BackgroundFrame): void {
    const { ctx, time, pulse, climax, celebration, laserIntensity, isRotated } = frame;
    const heat = Math.max(climax, celebration);
    const drop = this.dropAge < DROP_DURATION ? 1 - this.dropAge / DROP_DURATION : 0;
    const lights = Math.min(
      1,
      LIGHT_INTENSITY_FLOOR + (1 - LIGHT_INTENSITY_FLOOR) * laserIntensity + drop * 0.5,
    );

    ctx.save();
    const layout = this.applyOrientation(ctx, isRotated);
    this.ensureGradients(ctx, layout);

    this.renderWall(ctx, heat, layout);
    this.renderSign(ctx, time, pulse, heat, lights, drop, layout);
    this.renderTruss(ctx, layout);
    this.renderCrates(ctx, layout);
    this.renderBacklight(ctx, heat, lights, layout);
    this.renderCrowd(ctx, frame, heat, drop, layout);
    this.renderFence(ctx, layout);

    ctx.fillStyle = FLOOR_COLOR;
    ctx.fillRect(0, layout.floorY, layout.width, layout.height - layout.floorY);

    this.renderLamps(ctx, lights, layout);
    this.renderSmoke(ctx, heat, layout);
    ctx.restore();
  }

  /** As the other backgrounds: on a portrait phone the canvas is turned back, sides swapped. */
  private applyOrientation(ctx: CanvasRenderingContext2D, isRotated: boolean): Layout {
    const width = isRotated ? COURT.HEIGHT : COURT.WIDTH;
    const height = isRotated ? COURT.WIDTH : COURT.HEIGHT;
    if (isRotated) {
      ctx.translate(COURT.WIDTH / 2, COURT.HEIGHT / 2);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-width / 2, -height / 2);
    }
    return {
      width,
      height,
      trussY: Math.round(height * LAYOUT.TRUSS),
      floorY: Math.round(height * LAYOUT.FLOOR),
      // Things sized for the landscape court shrink to fit a narrow portrait one
      scale: Math.min(1, width / COURT.WIDTH + 0.25),
    };
  }

  /** The lamps' cone and the smoke's puff: built once per orientation, then only moved about. */
  private ensureGradients(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const key = `${layout.width}|${layout.floorY}`;
    if (this.gradients?.key === key) return;
    const cone = ctx.createLinearGradient(0, layout.trussY, 0, layout.height);
    cone.addColorStop(0, LAMP.COLOR);
    cone.addColorStop(1, 'rgba(255, 179, 71, 0)');
    const smoke = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    smoke.addColorStop(0, 'rgba(183, 155, 255, 0.5)');
    smoke.addColorStop(1, 'rgba(183, 155, 255, 0)');
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    pool.addColorStop(0, 'rgba(255, 179, 71, 0.8)');
    pool.addColorStop(1, 'rgba(255, 179, 71, 0)');
    const backTop = layout.floorY - layout.height * BACKLIGHT.HEIGHT;
    const backlight = ctx.createLinearGradient(0, backTop, 0, layout.floorY);
    backlight.addColorStop(0, 'rgba(255, 43, 214, 0)');
    backlight.addColorStop(1, 'rgba(255, 43, 214, 1)');
    this.gradients = { key, cone, smoke, pool, backlight };
  }

  /** Corrugated steel: alternate ribs, one batched path for the darker ones. */
  private renderWall(ctx: CanvasRenderingContext2D, heat: number, layout: Layout): void {
    ctx.fillStyle = mixHexColors(WALL.COOL[0], WALL.HOT[0], heat);
    ctx.fillRect(0, 0, layout.width, layout.floorY);
    ctx.fillStyle = mixHexColors(WALL.COOL[1], WALL.HOT[1], heat);
    ctx.beginPath();
    for (let x = 0; x < layout.width; x += WALL.RIB * 2) ctx.rect(x, 0, WALL.RIB, layout.floorY);
    ctx.fill();
  }

  /** The truss: a heavy lower chord with its lattice above, one stroke each. */
  private renderTruss(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const { width, trussY } = layout;
    const depth = trussY * 0.7;
    ctx.strokeStyle = TRUSS_COLOR;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, trussY);
    ctx.lineTo(width, trussY);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x < width; x += depth * 2) {
      ctx.moveTo(x, trussY);
      ctx.lineTo(x + depth, trussY - depth);
      ctx.lineTo(x + depth * 2, trussY);
    }
    ctx.moveTo(0, trussY - depth);
    ctx.lineTo(width, trussY - depth);
    ctx.stroke();
  }

  /**
   * The homemade neon pong sign: a frame, two paddle tubes and a hollow square that hops from one
   * to the other on the beat. Tubes are a thin bright stroke over a wide faint one, no shadowBlur.
   */
  private renderSign(
    ctx: CanvasRenderingContext2D,
    time: number,
    pulse: number,
    heat: number,
    lights: number,
    drop: number,
    layout: Layout,
  ): void {
    const s = layout.scale;
    const w = SIGN.WIDTH * s;
    const h = SIGN.HEIGHT * s;
    const cx = layout.width / 2;
    const cy = layout.height * LAYOUT.SIGN_Y;
    // A tube that stutters now and then, as old neon does
    const tick = Math.floor(time * SIGN_FLICKER.RATE);
    const stutter = hash(tick, 7) < SIGN_FLICKER.SHARE ? 0.35 : 1;
    const glow = Math.min(1, (0.55 + 0.25 * pulse + 0.3 * heat) * lights + drop * 0.4);

    const tube = (color: string, alpha: number, path: () => void) => {
      ctx.strokeStyle = color;
      ctx.beginPath();
      path();
      ctx.globalAlpha = alpha * SIGN.HALO_ALPHA;
      ctx.lineWidth = SIGN.TUBE + SIGN.HALO;
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.lineWidth = SIGN.TUBE;
      ctx.stroke();
    };

    ctx.save();
    ctx.lineJoin = 'round';
    // The frame, in the dim yellow of an old tube
    tube(COLORS.YELLOW, glow * 0.45, () => ctx.rect(cx - w / 2, cy - h / 2, w, h));
    const paddleH = h * 0.62;
    const paddleW = 12 * s;
    const left = cx - w / 2 + 22 * s;
    const right = cx + w / 2 - 22 * s - paddleW;
    tube(COLORS.CYAN, glow * stutter, () =>
      ctx.roundRect(left, cy - paddleH / 2, paddleW, paddleH, paddleW / 2),
    );
    tube(COLORS.PINK, glow, () =>
      ctx.roundRect(right, cy - paddleH / 2, paddleW, paddleH, paddleW / 2),
    );
    // The square, flying in a low arc between them
    const t = this.signBall;
    const size = 14 * s;
    const x = left + paddleW + 6 * s + t * (right - left - paddleW - 12 * s - size);
    const y = cy - size / 2 - Math.sin(t * Math.PI) * h * 0.18;
    tube(COLORS.YELLOW, glow, () => ctx.rect(x, y, size, size));
    ctx.restore();
  }

  /** A pink glow from the hall's far end, rising behind the crowd; brighter with the heat. */
  private renderBacklight(
    ctx: CanvasRenderingContext2D,
    heat: number,
    lights: number,
    layout: Layout,
  ): void {
    const top = layout.floorY - layout.height * BACKLIGHT.HEIGHT;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = BACKLIGHT.ALPHA * (0.6 + 0.4 * heat) * lights;
    ctx.fillStyle = this.gradients!.backlight;
    ctx.fillRect(0, top, layout.width, layout.floorY - top);
    ctx.restore();
  }

  /** Crates stacked against the wall at both ends. */
  private renderCrates(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const { width, floorY, scale } = layout;
    const crates: [x: number, size: number, lift: number][] = [
      [0.02, 90, 0],
      [0.12, 70, 0],
      [0.05, 60, 1],
      [0.86, 96, 0],
      [0.94, 64, 0],
    ];
    ctx.fillStyle = CRATE.FILL;
    ctx.strokeStyle = CRATE.EDGE;
    ctx.lineWidth = 3;
    for (const [share, size, lift] of crates) {
      const side = size * scale;
      const x = share * width;
      const y = floorY - side - lift * 90 * scale;
      ctx.fillRect(x, y, side, side);
      ctx.beginPath();
      ctx.rect(x, y, side, side);
      ctx.moveTo(x, y);
      ctx.lineTo(x + side, y + side);
      ctx.stroke();
    }
  }

  /**
   * The crowd behind the fence: heads and shoulders in one dark path, arms going up with the
   * music, higher with the heat; they jump on a victory. Now and then a phone flashes.
   */
  private renderCrowd(
    ctx: CanvasRenderingContext2D,
    { spectrum, time }: BackgroundFrame,
    heat: number,
    drop: number,
    layout: Layout,
  ): void {
    const { width, floorY, scale } = layout;
    const still = this.isStill;
    const unit = 30 * scale;
    ctx.fillStyle = CROWD_COLOR;
    ctx.beginPath();
    for (const person of this.crowd) {
      const level = spectrum.getBarLevel(person.bar, SPECTRUM_BARS, time);
      const bob = still ? 0 : Math.sin(time * 3 + person.phase) * 2 * level;
      const jump = still ? 0 : drop * 10 * scale * (0.5 + 0.5 * Math.sin(person.phase));
      const x = person.x * width;
      const top = floorY - unit * person.height * 1.4 - bob - jump;
      ctx.moveTo(x + unit * 0.3, top);
      ctx.arc(x, top, unit * 0.3, 0, Math.PI * 2);
      ctx.rect(x - unit * 0.38, top + unit * 0.22, unit * 0.76, floorY - top);
      if (person.hasArm) {
        const reach = unit * (0.4 + 0.9 * clamp(level * 0.6 + heat * 0.6 + drop, 0, 1));
        ctx.rect(x + unit * 0.22, top - reach + unit * 0.3, unit * 0.14, reach);
      }
    }
    ctx.fill();

    ctx.fillStyle = COLORS.WHITE;
    const tick = Math.floor(time * PHONE_FLASH.RATE);
    for (let i = 0; i < this.crowd.length; i++) {
      if (hash(tick, i) < PHONE_FLASH.SHARE) {
        const person = this.crowd[i];
        ctx.fillRect(person.x * width + unit * 0.2, floorY - unit * person.height * 2, 3, 3);
      }
    }
  }

  /** The chain-link fence in front of the crowd: diagonal mesh in one stroke, and its posts. */
  private renderFence(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const { width, height, floorY } = layout;
    const top = floorY - height * LAYOUT.FENCE;
    const span = floorY - top;
    ctx.save();
    ctx.globalAlpha = FENCE.ALPHA;
    ctx.strokeStyle = COLORS.PURPLE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -span; x < width; x += FENCE.MESH) {
      ctx.moveTo(x, top);
      ctx.lineTo(x + span, floorY);
      ctx.moveTo(x + span, top);
      ctx.lineTo(x, floorY);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = TRUSS_COLOR;
    for (let x = 20; x < width; x += 190) ctx.fillRect(x, top - 4, 5, span + 4);
    ctx.fillRect(0, top - 4, width, 3);
    ctx.restore();
  }

  /**
   * The lamps on their wires: a warm cone each through the smoke, a pool of light on the floor,
   * the bulb itself. They swing (not with reduced motion), and flare on a victory.
   */
  private renderLamps(ctx: CanvasRenderingContext2D, lights: number, layout: Layout): void {
    const { width, height, trussY, floorY } = layout;
    const wire = height * LAMP.WIRE;
    ctx.save();
    for (let i = 0; i < LAMP.COUNT; i++) {
      const anchor = width * ((i + 0.5) / LAMP.COUNT);
      const angle = Math.sin(this.lampPhases[i]) * LAMP.SWING;
      const x = anchor + Math.sin(angle) * wire;
      const y = trussY + Math.cos(angle) * wire;
      const spread = width * CONE.HALF_FLOOR;
      const lean = Math.tan(angle) * (height - y);

      ctx.strokeStyle = TRUSS_COLOR;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(anchor, trussY);
      ctx.lineTo(x, y);
      ctx.stroke();

      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = CONE.ALPHA * lights;
      ctx.fillStyle = this.gradients!.cone;
      ctx.beginPath();
      ctx.moveTo(x - CONE.HALF_TOP, y);
      ctx.lineTo(x + CONE.HALF_TOP, y);
      ctx.lineTo(x + spread + lean, height);
      ctx.lineTo(x - spread + lean, height);
      ctx.closePath();
      ctx.fill();

      // A soft pool of light where the cone meets the floor
      ctx.globalAlpha = 0.3 * lights;
      ctx.fillStyle = this.gradients!.pool;
      ctx.save();
      ctx.translate(x + lean * 0.7, floorY + (height - floorY) * 0.55);
      ctx.scale(spread, (height - floorY) * 0.3);
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = Math.min(1, 0.6 + 0.4 * lights);
      ctx.fillStyle = LAMP.CORE;
      ctx.beginPath();
      ctx.arc(x, y + 4, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Smoke drifting through the light: a few soft puffs, one cached gradient moved about. */
  private renderSmoke(ctx: CanvasRenderingContext2D, heat: number, layout: Layout): void {
    const { width, height } = layout;
    ctx.save();
    ctx.globalAlpha = 0.16 + heat * 0.1;
    ctx.fillStyle = this.gradients!.smoke;
    for (const puff of this.smoke) {
      const radius = puff.size * width;
      ctx.save();
      ctx.translate((puff.x - 0.15) * width, puff.y * height);
      ctx.scale(radius, radius * 0.45);
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}
