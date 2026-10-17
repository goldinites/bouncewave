import { COURT } from '@/match/config';
import { Background, BackgroundFrame } from '@/render/backgrounds/Background';
import { clamp, mixHexColors, randomRange, TWO_PI } from '@/shared/math';
import { COLORS } from '@/shared/palette';

// Night sky over the mountains, cool at rest and hot at full climax or celebration
const SKY_COOL = ['#06021a', '#22104d', '#5e1c6a'];
const SKY_HOT = ['#170524', '#5a0f45', '#b8323c'];
// The sky gradient is rebuilt only when the heat moves by a step this size
const HEAT_STEPS = 40;

const GROUND_LEVEL = 0.84; // share of the frame's height where the gate stands
const GROUND_COLOR = '#07020f';
const STAIRS_COLOR = '#0e0522';
const STAIR_COUNT = 6;

/** Rolling ridges behind the gate, far to near; heights in shares of the frame. */
const RIDGES = [
  { base: 0.6, amplitude: 0.11, phase: 1.3, cool: '#22104c', hot: '#41123e' },
  { base: 0.72, amplitude: 0.07, phase: 4.1, cool: '#120832', hot: '#240a2b' },
] as const;
const RIDGE_POINTS = 48;
const MIST_ALPHA = 0.25;

// The gate: half its pillar spacing as a share of the frame's width, its lintel's height
const GATE = { HALF_SPAN: 0.27, TOP: 0.15 } as const;
const GATE_FILL_COOL = '#1c0414';
const GATE_FILL_HOT = '#36060f';
const GATE_NEON_HOT = '#ff4a3d';
// Neon on the gate without shadowBlur: a wide faint stroke under the line itself
const NEON_HALO = { WIDTH: 8, ALPHA: 0.3 } as const;

// The moon, framed by the gate; its radius is a share of the frame's shorter side
const MOON = { Y: 0.42, RADIUS: 0.15 } as const;
const MOON_LIGHT = '#fff1fb';
const MOON_EDGE = '#ffb3e6';
/** Thin clouds drifting across the moon, sizes in moon radii, speeds in radii per second. */
const CLOUDS = [
  { y: -0.35, length: 1.7, thickness: 0.1, speed: 0.05 },
  { y: 0.2, length: 2.3, thickness: 0.07, speed: 0.08 },
  { y: 0.55, length: 1.4, thickness: 0.12, speed: 0.035 },
] as const;
const CLOUD_COLOR = '#1a0b3c';
const CLOUD_TRAVEL = 6; // moon radii a cloud crosses before it comes round again

/** Stone lanterns either side of the stairs: where (in gate half-spans) and how big. */
const LANTERNS = [
  { x: 1.3, depth: 0, scale: 0.8 },
  { x: 1.62, depth: 0.55, scale: 1.05 },
] as const;
const SPECTRUM_BARS = 8;
const LANTERN_LIGHT = [COLORS.YELLOW, '#ff9a3d'] as const;

const PETAL = { COUNT: 44, FALL: 0.06, DRIFT: 0.08, SWAY: 0.012, SIZE: [2.2, 4.2] } as const;
const PETAL_COLORS = ['#ffb8e8', '#ff6fcf'] as const;
const CLIMAX_SPEEDUP = 2; // petals fall up to (1 + this)× faster
// Victory/climax drop: the gate flares and a gust of petals bursts out of it
const BURST = { COUNT: 40, SPEED: [0.25, 0.6], LIFE: 1.8, DRAG: 1.2, GRAVITY: 0.12 } as const;
const DROP_DURATION = 0.8;

const STAR_COUNT = 32;

// How far laserIntensity (full behind the menus, low during play) may dim the lights. A floor,
// not a straight multiply, so the shrine never goes dark, just calmer during play
const LIGHT_INTENSITY_FLOOR = 0.6;

/** Where things stand, and how wide/tall the scene is, in whichever space is "up" right now. */
interface Layout {
  width: number;
  height: number;
  groundY: number;
  centerX: number;
  /** Half the gate's pillar spacing. */
  halfSpan: number;
  gateTop: number;
}

/** A petal, its position in shares of the frame so it fits either orientation. */
interface Petal {
  x: number;
  y: number;
  size: number;
  spin: number;
  angle: number;
  phase: number;
  color: number;
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
  color: Math.floor(Math.random() * PETAL_COLORS.length),
});

/** Height of a ridge at `x` in shares of the frame: a few slow sines, so it rolls, not jags. */
function ridgeHeight(x: number, phase: number): number {
  const wave =
    0.55 * Math.sin(x * 7.1 + phase) +
    0.3 * Math.sin(x * 13.7 + phase * 2.3) +
    0.15 * Math.sin(x * 29.3 + phase * 0.7);
  return (wave + 1) / 2;
}

/**
 * A mountain shrine at night: a neon torii at the top of its stairs framing a pale moon, misty
 * ridges behind it, stone lanterns that glow with the music, and cherry petals on the wind.
 */
export class ShrineBackground implements Background {
  public readonly scene = 'shrine';
  public readonly overlayTint = 0.22;

  private readonly petals = Array.from({ length: PETAL.COUNT }, () => newPetal());
  private burst: BurstPetal[] = [];
  private readonly stars = Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random(),
    y: Math.random() ** 1.6,
    phase: Math.random() * 10,
  }));
  private cloudDrift = Math.random() * CLOUD_TRAVEL;
  private dropAge = Infinity;
  private sky: { key: string; value: CanvasGradient } | null = null;
  private mist: { key: string; values: CanvasGradient[] } | null = null;

  public triggerDrop(): void {
    this.dropAge = 0;
    this.burst = Array.from({ length: BURST.COUNT }, () => {
      const angle = Math.random() * TWO_PI;
      const speed = randomRange(BURST.SPEED[0], BURST.SPEED[1]);
      return {
        ...newPetal(MOON.Y),
        x: 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.15,
        age: 0,
      };
    });
  }

  /** Keeps the petals falling and the clouds drifting even while another background is shown. */
  public advance(dt: number, _pulse: number, heat: number): void {
    this.dropAge += dt;
    this.cloudDrift = (this.cloudDrift + dt) % (CLOUD_TRAVEL * 100);
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
    ctx.fillRect(0, 0, layout.width, layout.groundY);
    this.renderStars(ctx, time, layout);
    this.renderMoon(ctx, pulse, flash, layout);
    this.renderRidges(ctx, heat, layout);

    ctx.fillStyle = GROUND_COLOR;
    ctx.fillRect(0, layout.groundY, layout.width, layout.height - layout.groundY);
    this.renderStairs(ctx, pulse, lights, layout);
    this.renderLanterns(ctx, frame, lights, layout);
    this.renderGate(ctx, heat, pulse, lights, flash, layout);
    this.renderPetals(ctx, layout);

    if (flash > 0) {
      ctx.globalAlpha = flash * flash * 0.25;
      ctx.fillStyle = MOON_EDGE;
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
      groundY: Math.round(height * GROUND_LEVEL),
      centerX: width / 2,
      halfSpan: width * GATE.HALF_SPAN,
      gateTop: height * GATE.TOP,
    };
  }

  /** Sky gradient down to the ground; cached per heat step and orientation. */
  private getSky(ctx: CanvasRenderingContext2D, heat: number, layout: Layout): CanvasGradient {
    const heatStep = Math.round(heat * HEAT_STEPS);
    const key = `${heatStep}|${layout.groundY}`;
    if (this.sky?.key === key) return this.sky.value;

    const value = ctx.createLinearGradient(0, 0, 0, layout.groundY);
    [0, 0.55, 1].forEach((stop, i) =>
      value.addColorStop(stop, mixHexColors(SKY_COOL[i], SKY_HOT[i], heatStep / HEAT_STEPS)),
    );
    this.sky = { key, value };
    return value;
  }

  private renderStars(ctx: CanvasRenderingContext2D, time: number, layout: Layout): void {
    const skyHeight = layout.height * (RIDGES[0].base - RIDGES[0].amplitude);

    ctx.fillStyle = COLORS.WHITE;
    for (const star of this.stars) {
      ctx.globalAlpha = 0.2 + 0.25 * Math.sin(time * 1.1 + star.phase);
      ctx.fillRect(star.x * layout.width, star.y * skyHeight, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  }

  /** The moon in the gate, its halo breathing with the beat, thin clouds sliding across it. */
  private renderMoon(
    ctx: CanvasRenderingContext2D,
    pulse: number,
    flash: number,
    layout: Layout,
  ): void {
    const { centerX: x, width, height } = layout;
    const y = height * MOON.Y;
    const radius = Math.min(width, height) * MOON.RADIUS;

    // Halo as a gradient ring rather than shadowBlur, which re-blurs the whole disc
    const haloRadius = radius * (1.7 + pulse * 0.25 + flash * 0.5);
    const halo = ctx.createRadialGradient(x, y, radius * 0.9, x, y, haloRadius);
    halo.addColorStop(0, 'rgba(255, 150, 220, 0.4)');
    halo.addColorStop(1, 'rgba(255, 150, 220, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, haloRadius, 0, TWO_PI);
    ctx.fill();

    const disc = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
    disc.addColorStop(0, MOON_LIGHT);
    disc.addColorStop(1, MOON_EDGE);
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TWO_PI);
    ctx.fill();

    // Each cloud is a thick round-capped line, seen only where it crosses the moon
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = CLOUD_COLOR;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.85;
    for (const cloud of CLOUDS) {
      const travel = (this.cloudDrift * cloud.speed) % CLOUD_TRAVEL;
      const start = x + (CLOUD_TRAVEL / 2 - travel) * radius;
      const cloudY = y + cloud.y * radius;
      ctx.lineWidth = cloud.thickness * radius;
      ctx.beginPath();
      ctx.moveTo(start, cloudY);
      ctx.lineTo(start + cloud.length * radius, cloudY);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Rolling ridges, each with mist pooling at its foot. */
  private renderRidges(ctx: CanvasRenderingContext2D, heat: number, layout: Layout): void {
    const { width, height } = layout;
    const mist = this.getMist(ctx, layout);

    RIDGES.forEach((ridge, i) => {
      const baseY = height * ridge.base;
      ctx.fillStyle = mixHexColors(ridge.cool, ridge.hot, heat);
      ctx.beginPath();
      ctx.moveTo(0, layout.groundY);
      for (let k = 0; k <= RIDGE_POINTS; k++) {
        const x = k / RIDGE_POINTS;
        ctx.lineTo(x * width, baseY - ridgeHeight(x, ridge.phase) * ridge.amplitude * height);
      }
      ctx.lineTo(width, layout.groundY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = mist[i];
      const top = baseY - ridge.amplitude * height * 0.5;
      ctx.fillRect(0, top, width, baseY + ridge.amplitude * height * 0.3 - top);
    });
  }

  /** Mist bands at the ridges' feet; cached per orientation. */
  private getMist(ctx: CanvasRenderingContext2D, layout: Layout): CanvasGradient[] {
    const key = `${layout.width}|${layout.height}`;
    if (this.mist?.key === key) return this.mist.values;

    const values = RIDGES.map((ridge) => {
      const baseY = layout.height * ridge.base;
      const top = baseY - ridge.amplitude * layout.height * 0.5;
      const bottom = baseY + ridge.amplitude * layout.height * 0.3;
      const value = ctx.createLinearGradient(0, top, 0, bottom);
      value.addColorStop(0, 'rgba(183, 155, 255, 0)');
      value.addColorStop(0.7, `rgba(183, 155, 255, ${MIST_ALPHA})`);
      value.addColorStop(1, 'rgba(183, 155, 255, 0)');
      return value;
    });
    this.mist = { key, values };
    return values;
  }

  /** Stone stairs climbing to the gate, their edges catching the beat. */
  private renderStairs(
    ctx: CanvasRenderingContext2D,
    pulse: number,
    lights: number,
    layout: Layout,
  ): void {
    const { centerX, groundY, height, halfSpan } = layout;
    const topHalf = halfSpan * 0.8;
    const bottomHalf = halfSpan * 1.5;
    const halfWidthAt = (t: number) => topHalf + (bottomHalf - topHalf) * t;

    ctx.fillStyle = STAIRS_COLOR;
    ctx.beginPath();
    ctx.moveTo(centerX - topHalf, groundY);
    ctx.lineTo(centerX + topHalf, groundY);
    ctx.lineTo(centerX + bottomHalf, height);
    ctx.lineTo(centerX - bottomHalf, height);
    ctx.closePath();
    ctx.fill();

    // Steps bunch up toward the top, as they climb away from the viewer
    ctx.save();
    ctx.strokeStyle = COLORS.PURPLE;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = (0.25 + pulse * 0.25) * lights;
    ctx.beginPath();
    for (let k = 1; k <= STAIR_COUNT; k++) {
      const t = (k / STAIR_COUNT) ** 1.4;
      const y = groundY + t * (height - groundY);
      const half = halfWidthAt(t);
      ctx.moveTo(centerX - half, y);
      ctx.lineTo(centerX + half, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Stone lanterns either side of the stairs; each one's light is its own analyzer bar. */
  private renderLanterns(
    ctx: CanvasRenderingContext2D,
    { spectrum, time }: BackgroundFrame,
    lights: number,
    layout: Layout,
  ): void {
    const { centerX, groundY, height, halfSpan } = layout;
    const unit = halfSpan / 120;
    const spots = LANTERNS.flatMap((lantern, i) =>
      [-1, 1].map((side) => ({
        x: centerX + side * lantern.x * halfSpan,
        y: groundY + lantern.depth * (height - groundY),
        size: lantern.scale * unit,
        bar: (i * 2 + (side > 0 ? 1 : 0)) % SPECTRUM_BARS,
      })),
    );

    // Every silhouette in one fill: base, post, ledge, firebox, roof and the jewel on top
    ctx.fillStyle = GATE_FILL_COOL;
    ctx.beginPath();
    for (const { x, y, size: s } of spots) {
      ctx.rect(x - 9 * s, y - 6 * s, 18 * s, 6 * s);
      ctx.rect(x - 3.5 * s, y - 22 * s, 7 * s, 16 * s);
      ctx.rect(x - 10 * s, y - 26 * s, 20 * s, 4 * s);
      ctx.rect(x - 7 * s, y - 40 * s, 14 * s, 14 * s);
      ctx.moveTo(x - 14 * s, y - 40 * s);
      ctx.lineTo(x + 14 * s, y - 40 * s);
      ctx.lineTo(x + 5 * s, y - 48 * s);
      ctx.lineTo(x - 5 * s, y - 48 * s);
      ctx.closePath();
      ctx.moveTo(x + 3 * s, y - 51 * s);
      ctx.arc(x, y - 51 * s, 3 * s, 0, TWO_PI);
    }
    ctx.fill();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    spots.forEach(({ x, y, size: s, bar }, i) => {
      const level = spectrum.getBarLevel(bar, SPECTRUM_BARS, time);
      const alpha = (0.35 + 0.65 * level) * lights;
      const light = LANTERN_LIGHT[i % LANTERN_LIGHT.length];
      const lightY = y - 33 * s;

      // A soft pool of light around the firebox, fading out to nothing
      const glow = ctx.createRadialGradient(x, lightY, 0, x, lightY, 18 * s);
      glow.addColorStop(0, light);
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalAlpha = alpha * 0.35;
      ctx.fillStyle = glow;
      ctx.fillRect(x - 18 * s, lightY - 18 * s, 36 * s, 36 * s);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = light;
      ctx.fillRect(x - 4 * s, y - 37 * s, 8 * s, 8 * s);
    });
    ctx.restore();
  }

  /**
   * The torii: an upswept top lintel over a second beam, a tie beam through both pillars and a
   * plaque between them — one dark silhouette traced in neon that flares with the beat.
   */
  private renderGate(
    ctx: CanvasRenderingContext2D,
    heat: number,
    pulse: number,
    lights: number,
    flash: number,
    layout: Layout,
  ): void {
    const { centerX: cx, halfSpan: w, gateTop: top, groundY } = layout;
    const t = Math.max(8, w * 0.11); // lintel thickness, the unit everything else is sized by
    const tieY = top + t * 3.4;
    const pillarTop = top + t * 1.2;

    const fill = mixHexColors(GATE_FILL_COOL, GATE_FILL_HOT, heat);
    const neon = mixHexColors(COLORS.PINK, GATE_NEON_HOT, heat);
    const alpha = clamp((0.55 + pulse * 0.3 + heat * 0.25) * lights + flash, 0, 1);

    // Pillars first, a touch wider at the foot, so the beams cover their tops
    ctx.beginPath();
    for (const side of [-1, 1]) {
      const x = cx + side * w;
      ctx.moveTo(x - t * 0.42, pillarTop);
      ctx.lineTo(x + t * 0.42, pillarTop);
      ctx.lineTo(x + side * w * 0.04 + t * 0.55, groundY);
      ctx.lineTo(x + side * w * 0.04 - t * 0.55, groundY);
      ctx.closePath();
    }
    this.fillNeon(ctx, fill, neon, alpha, flash);

    ctx.beginPath();
    // Top lintel (kasagi), its ends sweeping up
    ctx.moveTo(cx - w * 1.4, top - t * 0.95);
    ctx.quadraticCurveTo(cx, top + t * 0.35, cx + w * 1.4, top - t * 0.95);
    ctx.lineTo(cx + w * 1.28, top + t * 0.15);
    ctx.quadraticCurveTo(cx, top + t * 1.2, cx - w * 1.28, top + t * 0.15);
    ctx.closePath();
    // Second beam (shimaki), tie beam (nuki) and the plaque (gakuzuka) between them
    ctx.rect(cx - w * 1.16, top + t * 0.9, w * 2.32, t * 0.6);
    ctx.rect(cx - w * 1.22, tieY, w * 2.44, t * 0.75);
    ctx.rect(cx - t * 0.55, top + t * 1.5, t * 1.1, tieY - top - t * 1.5);
    this.fillNeon(ctx, fill, neon, alpha, flash);
  }

  /** Fills the current path dark and traces it in neon: a wide faint halo, then the line. */
  private fillNeon(
    ctx: CanvasRenderingContext2D,
    fill: string,
    neon: string,
    alpha: number,
    flash: number,
  ): void {
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = neon;
    ctx.globalAlpha = alpha * NEON_HALO.ALPHA;
    ctx.lineWidth = 2 + NEON_HALO.WIDTH + flash * 6;
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  /** Falling petals and the drop's gust, batched into one path per color. */
  private renderPetals(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const { width, height } = layout;

    ctx.save();
    PETAL_COLORS.forEach((color, colorIndex) => {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      for (const petal of this.petals) {
        if (petal.color !== colorIndex) continue;
        const sway = Math.sin(petal.angle + petal.phase) * PETAL.SWAY;
        this.tracePetal(ctx, (petal.x + sway) * width, petal.y * height, petal);
      }
      // The gust's petals shrink away as it dies down
      for (const petal of this.burst) {
        if (petal.color !== colorIndex) continue;
        const scale = 1 - petal.age / BURST.LIFE;
        this.tracePetal(ctx, petal.x * width, petal.y * height, petal, scale);
      }
      ctx.fill();
    });
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
}
