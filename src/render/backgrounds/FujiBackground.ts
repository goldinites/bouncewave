import { COURT } from '@/match/config';
import { Background, BackgroundFrame } from '@/render/backgrounds/Background';
import { clamp, mixHexColors, randomRange, TWO_PI } from '@/shared/math';
import { COLORS } from '@/shared/palette';

// Dusk sky down to the lake, cool at rest and hot at full climax or celebration
const SKY_COOL = ['#07021c', '#2a0f55', '#7a2470', '#e2557a'];
const SKY_HOT = ['#18041f', '#5c0f45', '#b8323c', '#ff7a45'];
// The sky gradient is rebuilt only when the heat moves by a step this size
const HEAT_STEPS = 40;

const HORIZON = 0.66; // share of the frame's height where the lake meets the mountain
const LAKE_COLOR = '#05021a';
const RIPPLE_COUNT = 10;
const REFLECTION = { SQUASH: 0.6, ALPHA: 0.35 } as const;

// The mountain, in units of its half-width at the foot: summit height, the flat top's half-width
const FUJI = { HALF_WIDTH: 0.425, HEIGHT: 0.665, TOP: 0.1 } as const;
const MOUNTAIN_TOP = '#2d1460';
const MOUNTAIN_FOOT = '#120630';
const SNOW = 'rgba(255, 220, 245, 0.85)';
/** The snowline's ragged foot, left to right, as (x, y) in mountain units below the summit. */
const SNOWLINE: readonly [x: number, y: number][] = [
  [0.21, -0.48],
  [0.16, -0.51],
  [0.13, -0.44],
  [0.06, -0.53],
  [0.02, -0.46],
  [-0.03, -0.52],
  [-0.08, -0.45],
  [-0.12, -0.5],
  [-0.15, -0.44],
  [-0.2, -0.47],
];
/** Ridges running down the slopes from under the snow, as (start x, end x) in mountain units. */
const RIDGES: readonly [from: number, to: number][] = [
  [-0.05, -0.25],
  [0.05, 0.25],
];

/** Thin cloud bands drifting across the slopes, heights in mountain units above the lake. */
const CLOUDS = [
  { y: 0.3, length: 0.75, thickness: 10, speed: 8 },
  { y: 0.23, length: 0.9, thickness: 8, speed: 12 },
  { y: 0.17, length: 0.6, thickness: 6, speed: 6 },
] as const;
const CLOUD_COLOR = '#3a1a6e';

// A small moon over the gate's side of the sky; its radius is a share of the frame's shorter side
const MOON = { X: 0.78, Y: 0.17, RADIUS: 0.048 } as const;
const MOON_LIGHT = '#ffe9f8';

// The torii standing in the lake, off to one side so the court's middle stays clear
const GATE = { X: 0.8, DEPTH: 0.47, SIZE: 0.24 } as const;
const GATE_FILL = '#2a0618';
const GATE_NEON_COOL = '#ff3b6b';
const GATE_NEON_HOT = '#ff8a3d';
// Neon without shadowBlur: a wide faint stroke under the line itself
const NEON_HALO = { WIDTH: 7, ALPHA: 0.28 } as const;

// Glints on the lake under the mountain, each one an analyzer bar
const SPECTRUM_BARS = 12;

/** The cherry branch hanging into the top-left corner, in units of the frame's shorter side. */
const BRANCH_SCALE = 1 / 500;
const LIMBS: readonly [
  from: [number, number],
  via: [number, number],
  to: [number, number],
  width: number,
][] = [
  [[-10, 20], [120, 40], [230, 30], 9],
  [[90, 36], [140, 70], [190, 92], 5],
  [[160, 34], [200, 10], [250, 6], 4],
  [[40, 26], [60, 70], [70, 110], 4],
];
const BLOSSOMS: readonly [x: number, y: number][] = [
  [120, 40],
  [180, 30],
  [230, 30],
  [190, 92],
  [150, 72],
  [250, 6],
  [210, 16],
  [70, 110],
  [60, 76],
  [30, 26],
  [100, 34],
  [165, 52],
];
const BLOSSOM_COLORS = ['#ffc2ec', '#ff7ad1'] as const;
const BRANCH_COLOR = '#12051c';

const PETAL = { COUNT: 44, FALL: 0.05, DRIFT: 0.04, SWAY: 0.012, SIZE: [2, 4.2] } as const;
const PETAL_COLOR = '#ffb8e8';
const CLIMAX_SPEEDUP = 2; // petals fall up to (1 + this)× faster
// Victory/climax drop: the gate flares and a gust of petals bursts from the branch
const BURST = { COUNT: 40, SPEED: [0.15, 0.45], LIFE: 2, DRAG: 1.1, GRAVITY: 0.1 } as const;
const DROP_DURATION = 0.8;

const STAR_COUNT = 40;

// How far laserIntensity (full behind the menus, low during play) may dim the lights. A floor,
// not a straight multiply, so the lake never goes dark, just calmer during play
const LIGHT_INTENSITY_FLOOR = 0.6;

/** Where things stand, and how wide/tall the scene is, in whichever space is "up" right now. */
interface Layout {
  width: number;
  height: number;
  horizonY: number;
  /** The mountain's half-width at its foot, the unit its shape is drawn in. */
  mountain: number;
  /** The frame's shorter side, which the gate, moon and branch are sized by. */
  unit: number;
}

/** A petal, its position in shares of the frame so it fits either orientation. */
interface Petal {
  x: number;
  y: number;
  size: number;
  spin: number;
  angle: number;
  phase: number;
}

interface BurstPetal extends Petal {
  vx: number;
  vy: number;
  age: number;
}

const newPetal = (y = Math.random()): Petal => ({
  x: Math.random(),
  y,
  size: randomRange(PETAL.SIZE[0], PETAL.SIZE[1]),
  spin: randomRange(-3, 3),
  angle: Math.random() * TWO_PI,
  phase: Math.random() * TWO_PI,
});

/**
 * Mount Fuji at dusk: a neon-capped cone mirrored in a still lake, a small torii standing in
 * the water off to one side, a cherry branch hanging into the corner and petals on the wind.
 */
export class FujiBackground implements Background {
  public readonly scene = 'fuji';
  public readonly overlayTint = 0.22;

  private readonly petals = Array.from({ length: PETAL.COUNT }, () => newPetal());
  private burst: BurstPetal[] = [];
  private readonly stars = Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random(),
    y: Math.random() ** 1.6,
    phase: Math.random() * 10,
  }));
  private cloudDrift = Math.random() * 100;
  private dropAge = Infinity;
  private sky: { key: string; value: CanvasGradient } | null = null;
  private slope: { key: string; value: CanvasGradient } | null = null;

  public triggerDrop(): void {
    this.dropAge = 0;
    // The gust leaves from the blossoms in the top-left corner
    this.burst = Array.from({ length: BURST.COUNT }, () => {
      const angle = randomRange(-0.6, 1.2);
      const speed = randomRange(BURST.SPEED[0], BURST.SPEED[1]);
      return {
        ...newPetal(0.1),
        x: 0.2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
      };
    });
  }

  /** Keeps the petals falling and the clouds drifting even while another background is shown. */
  public advance(dt: number, _pulse: number, heat: number): void {
    this.dropAge += dt;
    this.cloudDrift += dt;
    const speedup = 1 + heat * CLIMAX_SPEEDUP;

    for (const petal of this.petals) {
      petal.y += dt * PETAL.FALL * speedup * (0.7 + petal.size / 10);
      petal.x -= dt * PETAL.DRIFT * speedup;
      petal.angle += dt * petal.spin;
      if (petal.y > 1.05) Object.assign(petal, newPetal(-0.05));
      if (petal.x < -0.05) petal.x += 1.1;
    }

    const drag = Math.exp(-BURST.DRAG * dt);
    for (const petal of this.burst) {
      petal.age += dt;
      petal.vx *= drag;
      petal.vy = petal.vy * drag + BURST.GRAVITY * dt;
      petal.x += petal.vx * dt;
      petal.y += petal.vy * dt;
      petal.angle += dt * petal.spin * 2;
    }
    this.burst = this.burst.filter((petal) => petal.age < BURST.LIFE);
  }

  public render(frame: BackgroundFrame): void {
    const { ctx, time, pulse, climax, celebration, laserIntensity, isRotated } = frame;
    const heat = Math.max(climax, celebration);
    const lights = LIGHT_INTENSITY_FLOOR + (1 - LIGHT_INTENSITY_FLOOR) * laserIntensity;
    const flash = this.dropAge < DROP_DURATION ? 1 - this.dropAge / DROP_DURATION : 0;

    ctx.save();
    const layout = this.applyOrientation(ctx, isRotated);

    ctx.fillStyle = this.getSky(ctx, heat, layout);
    ctx.fillRect(0, 0, layout.width, layout.horizonY);
    this.renderStars(ctx, time, layout);
    this.renderMoon(ctx, pulse, layout);
    this.renderMountain(ctx, pulse, heat, lights, layout, 1);
    this.renderClouds(ctx, layout);
    this.renderLake(ctx, frame, heat, lights, layout);
    this.renderGate(ctx, pulse, heat, lights, flash, layout);
    this.renderBranch(ctx, layout);
    this.renderPetals(ctx, layout);

    if (flash > 0) {
      ctx.globalAlpha = flash * flash * 0.25;
      ctx.fillStyle = PETAL_COLOR;
      ctx.fillRect(0, 0, layout.width, layout.height);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  /**
   * Same trick as the Outrun sunset: on a portrait phone the stage is swept ‑90° in CSS, so the
   * canvas is pre-rotated the other way and its width and height swapped, keeping the sky up.
   */
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
      horizonY: Math.round(height * HORIZON),
      mountain: width * FUJI.HALF_WIDTH,
      unit: Math.min(width, height),
    };
  }

  /** Sky gradient down to the lake; cached per heat step and orientation. */
  private getSky(ctx: CanvasRenderingContext2D, heat: number, layout: Layout): CanvasGradient {
    const heatStep = Math.round(heat * HEAT_STEPS);
    const key = `${heatStep}|${layout.horizonY}`;
    if (this.sky?.key === key) return this.sky.value;

    const value = ctx.createLinearGradient(0, 0, 0, layout.horizonY);
    SKY_COOL.forEach((cool, i) =>
      value.addColorStop(
        i / (SKY_COOL.length - 1),
        mixHexColors(cool, SKY_HOT[i], heatStep / HEAT_STEPS),
      ),
    );
    this.sky = { key, value };
    return value;
  }

  private renderStars(ctx: CanvasRenderingContext2D, time: number, layout: Layout): void {
    const skyHeight = layout.horizonY - layout.mountain * FUJI.HEIGHT;

    ctx.fillStyle = COLORS.WHITE;
    for (const star of this.stars) {
      ctx.globalAlpha = 0.2 + 0.25 * Math.sin(time * 1.2 + star.phase);
      ctx.fillRect(star.x * layout.width, star.y * skyHeight, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  }

  /** A small moon high over the gate, its halo breathing with the beat. */
  private renderMoon(ctx: CanvasRenderingContext2D, pulse: number, layout: Layout): void {
    const x = layout.width * MOON.X;
    const y = layout.height * MOON.Y;
    const radius = layout.unit * MOON.RADIUS;
    const haloRadius = radius * (2.8 + pulse * 0.4);

    // Halo as a gradient ring rather than shadowBlur, which re-blurs the whole disc
    const halo = ctx.createRadialGradient(x, y, radius * 0.8, x, y, haloRadius);
    halo.addColorStop(0, 'rgba(255, 170, 230, 0.35)');
    halo.addColorStop(1, 'rgba(255, 170, 230, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, haloRadius, 0, TWO_PI);
    ctx.fill();

    ctx.fillStyle = MOON_LIGHT;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TWO_PI);
    ctx.fill();
  }

  /** Adds the mountain's outline to the current path. */
  private traceMountain(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const { width, horizonY, mountain: m } = layout;
    const cx = width / 2;
    const summitY = horizonY - FUJI.HEIGHT * m;

    ctx.moveTo(cx - m, horizonY);
    // Concave slopes, steepening toward the top
    ctx.quadraticCurveTo(cx - 0.29 * m, horizonY - 0.235 * m, cx - FUJI.TOP * m, summitY);
    // A slightly ragged crater rim across the flat top
    ctx.lineTo(cx - 0.05 * m, summitY - 0.025 * m);
    ctx.lineTo(cx - 0.01 * m, summitY - 0.005 * m);
    ctx.lineTo(cx + 0.03 * m, summitY - 0.028 * m);
    ctx.lineTo(cx + FUJI.TOP * m, summitY);
    ctx.quadraticCurveTo(cx + 0.29 * m, horizonY - 0.235 * m, cx + m, horizonY);
    ctx.closePath();
  }

  /** Adds the snowcap to the current path: the summit down to a ragged snowline. */
  private traceSnow(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const { width, horizonY, mountain: m } = layout;
    const cx = width / 2;
    const summitY = horizonY - FUJI.HEIGHT * m;

    ctx.moveTo(cx - FUJI.TOP * m, summitY);
    ctx.lineTo(cx - 0.05 * m, summitY - 0.025 * m);
    ctx.lineTo(cx - 0.01 * m, summitY - 0.005 * m);
    ctx.lineTo(cx + 0.03 * m, summitY - 0.028 * m);
    ctx.lineTo(cx + FUJI.TOP * m, summitY);
    for (const [x, y] of SNOWLINE) {
      ctx.lineTo(cx + x * m, horizonY + y * m);
    }
    ctx.closePath();
  }

  /**
   * The mountain: a dark cone traced in neon, its snowcap catching the beat. `alpha` lets the
   * lake draw it again, faintly, as its reflection.
   */
  private renderMountain(
    ctx: CanvasRenderingContext2D,
    pulse: number,
    heat: number,
    lights: number,
    layout: Layout,
    alpha: number,
  ): void {
    const { width, horizonY, mountain: m } = layout;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    this.traceMountain(ctx, layout);
    ctx.fillStyle = this.getSlope(ctx, layout);
    ctx.fill();
    this.strokeNeon(ctx, mixHexColors(COLORS.PURPLE, COLORS.PINK, heat), 0.55 * alpha, 1.5);

    ctx.beginPath();
    for (const [from, to] of RIDGES) {
      ctx.moveTo(width / 2 + from * m, horizonY - 0.46 * m);
      ctx.quadraticCurveTo(
        width / 2 + ((from + to) / 2) * m,
        horizonY - 0.2 * m,
        width / 2 + to * m,
        horizonY - 0.07 * m,
      );
    }
    this.strokeNeon(ctx, COLORS.PINK, 0.18 * alpha, 1);

    ctx.globalAlpha = alpha;
    ctx.beginPath();
    this.traceSnow(ctx, layout);
    ctx.fillStyle = SNOW;
    ctx.fill();
    const snowGlow = clamp((0.6 + pulse * 0.4) * lights, 0, 1) * alpha;
    this.strokeNeon(ctx, mixHexColors(COLORS.CYAN, COLORS.PINK, heat), snowGlow, 1.5);
    ctx.restore();
  }

  /** The slopes' gradient, dark at the foot; cached per orientation. */
  private getSlope(ctx: CanvasRenderingContext2D, layout: Layout): CanvasGradient {
    const key = `${layout.width}|${layout.horizonY}`;
    if (this.slope?.key === key) return this.slope.value;

    const top = layout.horizonY - FUJI.HEIGHT * layout.mountain;
    const value = ctx.createLinearGradient(0, top, 0, layout.horizonY);
    value.addColorStop(0, MOUNTAIN_TOP);
    value.addColorStop(1, MOUNTAIN_FOOT);
    this.slope = { key, value };
    return value;
  }

  /** Thin cloud bands sliding across the slopes, coming round again from the left. */
  private renderClouds(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const { width, horizonY, mountain: m } = layout;
    const travel = width + m * 2;

    ctx.save();
    ctx.strokeStyle = CLOUD_COLOR;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.5;
    CLOUDS.forEach((cloud, i) => {
      const length = cloud.length * m;
      const x = ((this.cloudDrift * cloud.speed + i * 300) % travel) - length;
      const y = horizonY - cloud.y * m;
      ctx.lineWidth = cloud.thickness;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + length, y);
      ctx.stroke();
    });
    ctx.restore();
  }

  /**
   * The lake: the mountain mirrored and squashed in it, glints under it as an equalizer and
   * dark ripples drifting across, broken by the neon line of the far shore.
   */
  private renderLake(
    ctx: CanvasRenderingContext2D,
    { spectrum, time, pulse }: BackgroundFrame,
    heat: number,
    lights: number,
    layout: Layout,
  ): void {
    const { width, height, horizonY, mountain: m } = layout;

    ctx.fillStyle = LAKE_COLOR;
    ctx.fillRect(0, horizonY, width, height - horizonY);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizonY, width, height - horizonY);
    ctx.clip();
    ctx.translate(0, horizonY);
    ctx.scale(1, -REFLECTION.SQUASH);
    ctx.translate(0, -horizonY);
    this.renderMountain(ctx, pulse, heat, lights, layout, REFLECTION.ALPHA);
    ctx.restore();

    // Glints under the mountain: each one stretches with its analyzer bar
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = mixHexColors(COLORS.CYAN, COLORS.PINK, heat);
    const lakeDepth = height - horizonY;
    for (let k = 0; k < SPECTRUM_BARS; k++) {
      const level = spectrum.getBarLevel(k, SPECTRUM_BARS, time);
      const y = horizonY + lakeDepth * (0.08 + 0.07 * k);
      if (y > height) break;
      const half = m * (0.12 + 0.3 * level) * (1 - k / SPECTRUM_BARS / 2);
      const wobble = Math.sin(time * 1.5 + k) * 4;
      ctx.globalAlpha = (0.15 + 0.35 * level) * lights;
      ctx.fillRect(width / 2 - half + wobble, y, half * 2, 1.5);
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = LAKE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < RIPPLE_COUNT; k++) {
      const y = horizonY + 6 + (k + 0.5 + Math.sin(time + k) * 0.2) * (lakeDepth / RIPPLE_COUNT);
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.6 * lights;
    ctx.fillStyle = mixHexColors(COLORS.PINK, GATE_NEON_HOT, heat);
    ctx.fillRect(0, horizonY - 1, width, 2);
    ctx.restore();
  }

  /** Adds the torii to the current path: its foot centered on (cx, base), `size` tall. */
  private traceGate(ctx: CanvasRenderingContext2D, cx: number, base: number, size: number): void {
    const w = size * 0.42; // half the pillar spacing
    const t = size * 0.075; // lintel thickness
    const top = base - size;

    // Top lintel, its ends sweeping up
    ctx.moveTo(cx - w * 1.4, top - t * 0.9);
    ctx.quadraticCurveTo(cx, top + t * 0.4, cx + w * 1.4, top - t * 0.9);
    ctx.lineTo(cx + w * 1.28, top + t * 0.2);
    ctx.quadraticCurveTo(cx, top + t * 1.2, cx - w * 1.28, top + t * 0.2);
    ctx.closePath();
    // Tie beam and the plaque above it
    ctx.rect(cx - w * 1.18, top + t * 3, w * 2.36, t * 0.8);
    ctx.rect(cx - t * 0.5, top + t * 1.2, t, t * 1.8);
    // Pillars, a touch wider at the foot
    for (const side of [-1, 1]) {
      const x = cx + side * w;
      ctx.moveTo(x - t * 0.4, top + t);
      ctx.lineTo(x + t * 0.4, top + t);
      ctx.lineTo(x + side * size * 0.02 + t * 0.5, base);
      ctx.lineTo(x + side * size * 0.02 - t * 0.5, base);
      ctx.closePath();
    }
  }

  /** The torii in the water and its reflection, flaring with the beat and on a drop. */
  private renderGate(
    ctx: CanvasRenderingContext2D,
    pulse: number,
    heat: number,
    lights: number,
    flash: number,
    layout: Layout,
  ): void {
    const { width, height, horizonY, unit } = layout;
    const cx = width * GATE.X;
    const base = horizonY + (height - horizonY) * GATE.DEPTH;
    const size = unit * GATE.SIZE;
    const neon = mixHexColors(GATE_NEON_COOL, GATE_NEON_HOT, heat);
    const alpha = clamp((0.6 + pulse * 0.3 + heat * 0.2) * lights + flash, 0, 1);

    ctx.save();
    ctx.translate(0, base);
    ctx.scale(1, -REFLECTION.SQUASH);
    ctx.translate(0, -base);
    ctx.beginPath();
    this.traceGate(ctx, cx, base, size);
    this.strokeNeon(ctx, neon, alpha * 0.3, 2);
    ctx.restore();

    ctx.beginPath();
    this.traceGate(ctx, cx, base, size);
    ctx.fillStyle = GATE_FILL;
    ctx.fill();
    this.strokeNeon(ctx, neon, alpha, 2, flash);
  }

  /** The cherry branch hanging into the top-left corner, heavy with blossom. */
  private renderBranch(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const scale = layout.unit * BRANCH_SCALE;

    ctx.save();
    ctx.scale(scale, scale);
    ctx.strokeStyle = BRANCH_COLOR;
    ctx.lineCap = 'round';
    for (const [from, via, to, width] of LIMBS) {
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(...from);
      ctx.quadraticCurveTo(...via, ...to);
      ctx.stroke();
    }

    // Each cluster is a few overlapping blooms, the same on every frame
    ctx.globalAlpha = 0.85;
    BLOSSOM_COLORS.forEach((color, colorIndex) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      BLOSSOMS.forEach(([x, y], i) => {
        for (let k = colorIndex; k < 4; k += 2) {
          const bx = x + Math.sin(i * 7.1 + k * 2.3) * 9;
          const by = y + Math.cos(i * 5.3 + k * 1.7) * 7;
          const radius = 3 + ((i + k) % 3);
          ctx.moveTo(bx + radius, by);
          ctx.arc(bx, by, radius, 0, TWO_PI);
        }
      });
      ctx.fill();
    });
    ctx.restore();
  }

  /** Falling petals and the drop's gust, batched into one path. */
  private renderPetals(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const { width, height } = layout;

    ctx.save();
    ctx.fillStyle = PETAL_COLOR;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    for (const petal of this.petals) {
      const sway = Math.sin(petal.angle + petal.phase) * PETAL.SWAY;
      this.tracePetal(ctx, (petal.x + sway) * width, petal.y * height, petal);
    }
    // The gust's petals shrink away as it dies down
    for (const petal of this.burst) {
      const scale = 1 - petal.age / BURST.LIFE;
      this.tracePetal(ctx, petal.x * width, petal.y * height, petal, scale);
    }
    ctx.fill();
    ctx.restore();
  }

  /** Adds one petal, a small tilted oval, to the current path. */
  private tracePetal(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    petal: Petal,
    scale = 1,
  ): void {
    const size = petal.size * scale;
    const { angle } = petal;
    // Start the subpath on the oval itself, so no stray line joins it to the previous petal
    ctx.moveTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
    ctx.ellipse(x, y, size, size * 0.55, angle, 0, TWO_PI);
  }

  /** Strokes the current path as neon: a wide faint halo, then the line itself. */
  private strokeNeon(
    ctx: CanvasRenderingContext2D,
    color: string,
    alpha: number,
    lineWidth: number,
    flash = 0,
  ): void {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha * NEON_HALO.ALPHA;
    ctx.lineWidth = lineWidth + NEON_HALO.WIDTH + flash * 6;
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.restore();
  }
}
