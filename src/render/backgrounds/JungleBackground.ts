import { COURT } from '@/match/config';
import { Background, BackgroundFrame } from '@/render/backgrounds/Background';
import { clamp, mixHexColors, randomRange, TWO_PI } from '@/shared/math';
import { COLORS } from '@/shared/palette';

// Humid night sky, teal at rest and hot at full climax or celebration
const SKY_COOL = ['#02060f', '#08243a', '#14505a'];
const SKY_HOT = ['#14051f', '#4a0f40', '#b8324a'];
// The sky gradient is rebuilt only when the heat moves by a step this size
const HEAT_STEPS = 40;

const WATER_LEVEL = 0.744; // share of the frame's height where the water's surface lies
const WATER_COLOR = '#01060c';
const RIPPLE_COUNT = 8; // dark lines breaking up the reflection
const REFLECTION = { SQUASH: 0.55, ALPHA: 0.3 } as const;

const JADE = '#2dffb3';
const JADE_DIM = '#0f6b55';
const STONE_TOP = '#0c2a2a';
const STONE_FOOT = '#041312';
const STONE_DARK = '#061615';
const MIST_RGB = '183, 155, 255';

/*
 * The ruins are drawn in their own units around the middle of the waterline: x across, y up
 * from the water (negative), sized for a 500-unit frame and scaled to the shorter side.
 */
const SCENE_UNITS = 500;
// The scene's reach across: wide frames spread the side towers and columns out, narrow ones
// draw them in
const SCENE_HALF_WIDTH = 400;

/** The guardian's face: where its crown's tip sits, and its size. */
const FACE = { TOP: -288, SCALE: 0.85 } as const;
/** The platform under the face and its steps going down into the water. */
const PLATFORM = { HALF_WIDTH: 100, TOP_HALF_WIDTH: 86, HEIGHT: 32, STEPS: 2 } as const;
/** Smaller guardians on towers in the mist behind: x, how far behind the waterline, size. */
const TOWERS = [
  { x: -270, y: 0, scale: 0.55, dim: 0.6 },
  { x: 270, y: -4, scale: 0.6, dim: 0.6 },
  { x: -155, y: -20, scale: 0.36, dim: 0.4 },
  { x: 160, y: -24, scale: 0.38, dim: 0.4 },
] as const;
/** Broken columns standing in the water: x, the height of their broken top, width. */
const COLUMNS = [
  { x: -186, top: -72, width: 20 },
  { x: -156, top: -46, width: 16 },
  { x: 160, top: -58, width: 18 },
  { x: 188, top: -84, width: 22 },
] as const;
/**
 * The halo turning slowly behind the face: two rings, a ring of ticks and arc segments that
 * light up with the music.
 */
const HALO = {
  Y: -152,
  OUTER: 180,
  INNER: 150,
  TICKS: 72,
  TICK: [158, 170] as const,
  ARCS: 8,
  ARC_RADIUS: 195,
  ARC_LENGTH: 0.45,
  SPIN: 0.08, // turns of the ticks per second, in radians
  COUNTER_SPIN: -0.12,
} as const;
const SPECTRUM_BARS = 16;
// A light running round the halo while a rally heats up
const RUNNING_LIGHT = { DASH: 30, GAP: 260, SPEED: 140 } as const;
// Neon without shadowBlur: a wide faint stroke under the line itself
const NEON_HALO = { WIDTH: 7, ALPHA: 0.28 } as const;

/** Lotuses floating on the water: shares of the width and of the water's depth, and size. */
const LOTUSES = [
  { x: 0.225, y: 0.3, scale: 0.9 },
  { x: 0.375, y: 0.62, scale: 1.3 },
  { x: 0.65, y: 0.53, scale: 1.1 },
  { x: 0.8, y: 0.77, scale: 1 },
] as const;
const LOTUS_PINK = '#3a0a34';
const LOTUS_PAD = '#062a22';

/**
 * A leaf in the foreground: where its stem starts (shares of the frame), which way it points
 * (radians, 0 = right, -π/2 = up), its length (a share of the frame's shorter side), width (a
 * share of its length) and how far its tip droops.
 */
interface Leaf {
  x: number;
  y: number;
  angle: number;
  length: number;
  width: number;
  droop: number;
  /** Rim color: 0 jade, 1 pink. */
  rim: number;
  phase: number;
}

const LEAF_FILL_COOL = '#020f0c';
const LEAF_FILL_HOT = '#12030f';
const SWAY = { RATE: 0.9, ANGLE: 0.05, PULSE: 0.05, CLIMAX: 2 } as const;

/** A palm: trunk from its foot (shares of the frame) up to its crown, fronds fanning out. */
interface Palm {
  foot: [x: number, y: number];
  bend: [x: number, y: number];
  crown: [x: number, y: number];
  fronds: number;
  frondLength: number;
}

const PALMS: readonly Palm[] = [
  { foot: [0.03, 1], bend: [0.03, 0.55], crown: [0.13, 0.28], fronds: 9, frondLength: 0.26 },
  { foot: [0.98, 1], bend: [0.99, 0.6], crown: [0.87, 0.36], fronds: 8, frondLength: 0.22 },
];
const TRUNK_WIDTH = 9;

/** Broad leaves fanning up from the bottom corners. */
const BUSHES = [
  { x: 0.0, y: 1.02, from: -1.25, to: -0.25, count: 6, length: 0.24 },
  { x: 1.0, y: 1.02, from: -2.9, to: -1.9, count: 6, length: 0.22 },
] as const;

/** Vines hanging from the canopy above: where (shares of the width) and how far down. */
const VINES = [
  { x: 0.05, length: 0.32 },
  { x: 0.2, length: 0.18 },
  { x: 0.79, length: 0.22 },
  { x: 0.93, length: 0.38 },
] as const;
const VINE_LEAF_SPACING = 0.035; // shares of the frame's height

const FIREFLY = { COUNT: 38, WANDER: 0.03, BLINK: 1.4, RADIUS: 1.6 } as const;
const FIREFLY_COLORS = ['#d8ff6a', JADE] as const;
const CLIMAX_SPEEDUP = 2; // fireflies wander up to (1 + this)× faster
// Victory/climax drop: the guardian's eyes and the halo flare, every leaf's rim lights up
const DROP_DURATION = 1.2;

const STAR_COUNT = 30;

// How far laserIntensity (full behind the menus, low during play) may dim the lights. A floor,
// not a straight multiply, so the jungle never goes dark, just calmer during play
const LIGHT_INTENSITY_FLOOR = 0.6;

/** Where things stand, and how wide/tall the scene is, in whichever space is "up" right now. */
interface Layout {
  width: number;
  height: number;
  waterY: number;
  /** The frame's shorter side, which the ruins and leaves are sized by. */
  unit: number;
  /** How far the ruins spread across, in scene units scaled to the frame. */
  spread: number;
}

/** How the music and the match light the ruins on one frame. */
interface Glow {
  pulse: number;
  heat: number;
  lights: number;
  flash: number;
}

/** Leaves laid out once; only their sway changes from frame to frame. */
function buildLeaves(): Leaf[] {
  const leaves: Leaf[] = [];
  let rim = 0;
  const nextRim = () => (rim++ % 4 === 3 ? 1 : 0);

  for (const palm of PALMS) {
    const facing = palm.crown[0] < 0.5 ? 1 : -1;
    for (let i = 0; i < palm.fronds; i++) {
      // Fronds fan over the top half of a circle, a few hanging down on either side
      const spread = -Math.PI - 0.5 + (i / (palm.fronds - 1)) * (Math.PI + 1);
      leaves.push({
        x: palm.crown[0],
        y: palm.crown[1],
        angle: spread + facing * 0.15,
        length: palm.frondLength * randomRange(0.8, 1.1),
        width: 0.13,
        droop: 0.35,
        rim: nextRim(),
        phase: Math.random() * TWO_PI,
      });
    }
  }

  for (const bush of BUSHES) {
    for (let i = 0; i < bush.count; i++) {
      leaves.push({
        x: bush.x,
        y: bush.y,
        angle: bush.from + (i / (bush.count - 1)) * (bush.to - bush.from),
        length: bush.length * randomRange(0.75, 1.1),
        width: 0.3,
        droop: 0.12,
        rim: nextRim(),
        phase: Math.random() * TWO_PI,
      });
    }
  }
  return leaves;
}

/**
 * A drowned city of stone guardians at night: a great face with deep, watching eyes rises from
 * dark water, a neon halo turning behind it, smaller guardians on towers in the mist, broken
 * columns and lotuses all mirrored below — framed by palms, hanging vines and fireflies.
 */
export class JungleBackground implements Background {
  public readonly scene = 'jungle';
  public readonly overlayTint = 0.22;

  private readonly leaves = buildLeaves();
  private readonly fireflies = Array.from({ length: FIREFLY.COUNT }, () => ({
    x: Math.random(),
    y: randomRange(0.15, 0.95),
    phase: Math.random() * TWO_PI,
    speed: randomRange(0.6, 1.4),
    color: Math.floor(Math.random() * FIREFLY_COLORS.length),
  }));
  private readonly stars = Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random(),
    y: Math.random() ** 1.5 * 0.45,
    phase: Math.random() * 10,
  }));
  /** Seconds of wandering so far; runs faster while the rally is hot. */
  private wander = 0;
  private dropAge = Infinity;
  private sky: { key: string; value: CanvasGradient } | null = null;
  /** A one-unit mist gradient, stretched over every band. */
  private mist: CanvasGradient | null = null;
  /** Gradients drawn in the face's own units, so one of each serves every face on screen. */
  private faceGradients: { stone: CanvasGradient; eyes: CanvasGradient } | null = null;

  public triggerDrop(): void {
    this.dropAge = 0;
  }

  /** Keeps the fireflies wandering even while another background is shown. */
  public advance(dt: number, _pulse: number, heat: number): void {
    this.dropAge += dt;
    this.wander += dt * (1 + heat * CLIMAX_SPEEDUP);
  }

  public render(frame: BackgroundFrame): void {
    const { ctx, time, pulse, climax, celebration, laserIntensity, isRotated } = frame;
    const heat = Math.max(climax, celebration);
    const lights = LIGHT_INTENSITY_FLOOR + (1 - LIGHT_INTENSITY_FLOOR) * laserIntensity;
    const flash = this.dropAge < DROP_DURATION ? 1 - this.dropAge / DROP_DURATION : 0;
    const glow: Glow = { pulse, heat, lights, flash };

    ctx.save();
    const layout = this.applyOrientation(ctx, isRotated);

    ctx.fillStyle = this.getSky(ctx, heat, layout);
    ctx.fillRect(0, 0, layout.width, layout.waterY);
    this.renderStars(ctx, time, layout);
    this.renderRuins(ctx, frame, glow, layout);
    this.renderWater(ctx, frame, glow, layout);
    this.renderFireflies(ctx, pulse, lights, flash, layout);
    this.renderJungle(ctx, time, glow, layout);

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

    const unit = Math.min(width, height);
    return {
      width,
      height,
      waterY: Math.round(height * WATER_LEVEL),
      unit,
      spread: width / 2 / SCENE_HALF_WIDTH / (unit / SCENE_UNITS),
    };
  }

  /** Sky gradient down to the water; cached per heat step and orientation. */
  private getSky(ctx: CanvasRenderingContext2D, heat: number, layout: Layout): CanvasGradient {
    const heatStep = Math.round(heat * HEAT_STEPS);
    const key = `${heatStep}|${layout.waterY}`;
    if (this.sky?.key === key) return this.sky.value;

    const value = ctx.createLinearGradient(0, 0, 0, layout.waterY);
    [0, 0.6, 1].forEach((stop, i) =>
      value.addColorStop(stop, mixHexColors(SKY_COOL[i], SKY_HOT[i], heatStep / HEAT_STEPS)),
    );
    this.sky = { key, value };
    return value;
  }

  private renderStars(ctx: CanvasRenderingContext2D, time: number, layout: Layout): void {
    ctx.fillStyle = COLORS.WHITE;
    for (const star of this.stars) {
      ctx.globalAlpha = 0.2 + 0.2 * Math.sin(time * 1.2 + star.phase);
      ctx.fillRect(star.x * layout.width, star.y * layout.height, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  }

  /** Moves the drawing into scene units: the origin on the waterline's middle, scaled to fit. */
  private enterScene(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const scale = layout.unit / SCENE_UNITS;
    ctx.translate(layout.width / 2, layout.waterY);
    ctx.scale(scale, scale);
  }

  /** The ruins above the water: towers in the mist, the halo, the platform and the face. */
  private renderRuins(
    ctx: CanvasRenderingContext2D,
    frame: BackgroundFrame,
    glow: Glow,
    layout: Layout,
  ): void {
    ctx.save();
    this.enterScene(ctx, layout);

    for (const tower of TOWERS) {
      this.renderTower(ctx, tower.x * layout.spread, tower.y, tower.scale, frame.time, tower.dim);
    }
    this.renderMist(ctx, -132, 120, 0.35);
    this.renderHalo(ctx, frame, glow, 1);
    this.renderPlatform(ctx, glow);
    this.renderFace(ctx, FACE.TOP, FACE.SCALE, glow, 1);
    this.renderColumns(ctx, layout, 1);

    ctx.restore();
  }

  /** A band of mist, `top` and `height` in scene units; the one gradient is cached. */
  private renderMist(
    ctx: CanvasRenderingContext2D,
    top: number,
    height: number,
    alpha: number,
  ): void {
    if (!this.mist) {
      this.mist = ctx.createLinearGradient(0, 0, 0, 1);
      this.mist.addColorStop(0, `rgba(${MIST_RGB}, 0)`);
      this.mist.addColorStop(0.6, `rgba(${MIST_RGB}, 1)`);
      this.mist.addColorStop(1, `rgba(${MIST_RGB}, 0)`);
    }

    // The gradient runs over one unit; scaling it out to the band keeps a single cached copy
    ctx.save();
    ctx.translate(0, top);
    ctx.scale(1, height);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.mist;
    ctx.fillRect(-SCENE_HALF_WIDTH * 2, 0, SCENE_HALF_WIDTH * 4, 1);
    ctx.restore();
  }

  /** A guardian on a tower in the mist: a budded spire, a face on its front. */
  private renderTower(
    ctx: CanvasRenderingContext2D,
    x: number,
    base: number,
    scale: number,
    time: number,
    dim: number,
  ): void {
    ctx.save();
    ctx.translate(x, base);
    ctx.scale(scale, scale);

    ctx.beginPath();
    ctx.moveTo(-70, 0);
    ctx.lineTo(-70, -120);
    ctx.lineTo(-60, -120);
    ctx.lineTo(-60, -170);
    ctx.lineTo(-45, -170);
    ctx.quadraticCurveTo(-50, -260, 0, -300);
    ctx.quadraticCurveTo(50, -260, 45, -170);
    ctx.lineTo(60, -170);
    ctx.lineTo(60, -120);
    ctx.lineTo(70, -120);
    ctx.lineTo(70, 0);
    ctx.closePath();
    ctx.fillStyle = '#082022';
    ctx.fill();
    this.strokeNeon(ctx, JADE, 0.3 * dim, 2);

    // Its face: a brow, the lit slits beneath it and a level mouth
    ctx.beginPath();
    ctx.moveTo(-38, -122);
    ctx.lineTo(38, -122);
    ctx.moveTo(-14, -70);
    ctx.lineTo(14, -70);
    this.strokeNeon(ctx, JADE, 0.35 * dim, 2.5);
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(side * 30, -108);
      ctx.lineTo(side * 10, -108);
    }
    this.strokeNeon(ctx, COLORS.CYAN, (0.3 + 0.2 * Math.sin(time + x)) * dim, 2.5);
    ctx.restore();
  }

  /**
   * The halo behind the face: two rings, a ring of ticks turning one way and arc segments the
   * other, each arc lit by its own analyzer bar. While a rally heats up a light runs round it.
   */
  private renderHalo(
    ctx: CanvasRenderingContext2D,
    { spectrum, time }: BackgroundFrame,
    { pulse, heat, lights, flash }: Glow,
    alpha: number,
  ): void {
    const pink = mixHexColors(COLORS.PINK, '#ff4a3d', heat);
    const cyan = mixHexColors(COLORS.CYAN, COLORS.PINK, heat);

    ctx.save();
    ctx.translate(0, HALO.Y);

    ctx.beginPath();
    ctx.arc(0, 0, HALO.OUTER, 0, TWO_PI);
    this.strokeNeon(ctx, pink, clamp((0.35 + pulse * 0.3) * lights + flash, 0, 1) * alpha, 1.5);
    if (heat > 0.05) {
      ctx.save();
      ctx.setLineDash([RUNNING_LIGHT.DASH, RUNNING_LIGHT.GAP]);
      ctx.lineDashOffset = -time * RUNNING_LIGHT.SPEED;
      ctx.strokeStyle = COLORS.WHITE;
      ctx.globalAlpha = heat * lights * alpha;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, HALO.INNER, 0, TWO_PI);
    this.strokeNeon(ctx, cyan, 0.3 * lights * alpha, 1);

    ctx.rotate(time * HALO.SPIN);
    ctx.beginPath();
    for (let k = 0; k < HALO.TICKS; k++) {
      const angle = (k / HALO.TICKS) * TWO_PI;
      // Every sixth tick reaches further in
      const inner = k % 6 ? HALO.TICK[0] : HALO.TICK[0] - 6;
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * HALO.TICK[1], Math.sin(angle) * HALO.TICK[1]);
    }
    this.strokeNeon(ctx, cyan, 0.35 * lights * alpha, 1);

    ctx.rotate(time * (HALO.COUNTER_SPIN - HALO.SPIN));
    for (let k = 0; k < HALO.ARCS; k++) {
      const level = spectrum.getBarLevel(k * 2, SPECTRUM_BARS, time);
      const start = (k / HALO.ARCS) * TWO_PI;
      ctx.beginPath();
      ctx.arc(0, 0, HALO.ARC_RADIUS, start, start + HALO.ARC_LENGTH);
      this.strokeNeon(ctx, pink, clamp((0.3 + 0.7 * level) * lights + flash, 0, 1) * alpha, 2.5);
    }
    ctx.restore();
  }

  /** The platform the face stands on, its steps going down into the water. */
  private renderPlatform(ctx: CanvasRenderingContext2D, { pulse, lights }: Glow): void {
    const { HALF_WIDTH: bottom, TOP_HALF_WIDTH: top, HEIGHT: h, STEPS } = PLATFORM;

    ctx.beginPath();
    ctx.moveTo(-bottom, 0);
    ctx.lineTo(bottom, 0);
    ctx.lineTo(top, -h);
    ctx.lineTo(-top, -h);
    ctx.closePath();
    ctx.fillStyle = STONE_DARK;
    ctx.fill();
    this.strokeNeon(ctx, JADE_DIM, 0.8 * lights, 1);

    ctx.beginPath();
    for (let k = 1; k <= STEPS; k++) {
      const y = -h + (k * h) / (STEPS + 1);
      const half = top + ((bottom - top) * k) / (STEPS + 1);
      ctx.moveTo(-half, y);
      ctx.lineTo(half, y);
    }
    this.strokeNeon(ctx, JADE, (0.25 + pulse * 0.4) * lights, 1.2);
  }

  /** Gradients in the face's own units: stone darkening toward the jaw, the glow of its eyes. */
  private getFaceGradients(ctx: CanvasRenderingContext2D) {
    if (this.faceGradients) return this.faceGradients;

    const stone = ctx.createLinearGradient(0, 0, 0, 300);
    stone.addColorStop(0, STONE_TOP);
    stone.addColorStop(1, STONE_FOOT);
    const eyes = ctx.createRadialGradient(0, 150, 0, 0, 150, 90);
    eyes.addColorStop(0, 'rgba(25, 240, 255, 0.25)');
    eyes.addColorStop(1, 'rgba(25, 240, 255, 0)');
    this.faceGradients = { stone, eyes };
    return this.faceGradients;
  }

  /**
   * The guardian: a tiered crown over a long block of a head, a brow jutting out over deep
   * sockets, lit slits watching from inside them, a long straight nose and hard, pressed lips.
   * Drawn in its own units (200 wide, 300 tall from the crown's tip), `top` and `scale` place it.
   */
  private renderFace(
    ctx: CanvasRenderingContext2D,
    top: number,
    scale: number,
    { pulse, heat, lights, flash }: Glow,
    alpha: number,
  ): void {
    const { stone, eyes } = this.getFaceGradients(ctx);
    const edge = 0.5 * lights * alpha;

    ctx.save();
    ctx.translate(0, top);
    ctx.scale(scale, scale);

    ctx.beginPath();
    ctx.moveTo(-100, 88);
    ctx.lineTo(-90, 58);
    ctx.lineTo(-70, 58);
    ctx.lineTo(-60, 28);
    ctx.lineTo(-40, 28);
    ctx.lineTo(-26, 0);
    ctx.lineTo(26, 0);
    ctx.lineTo(40, 28);
    ctx.lineTo(60, 28);
    ctx.lineTo(70, 58);
    ctx.lineTo(90, 58);
    ctx.lineTo(100, 88);
    ctx.lineTo(96, 262);
    ctx.lineTo(74, 300);
    ctx.lineTo(-74, 300);
    ctx.lineTo(-96, 262);
    ctx.closePath();
    // Long earlobes
    for (const side of [-1, 1]) {
      ctx.moveTo(side * 99, 126);
      ctx.lineTo(side * 116, 136);
      ctx.lineTo(side * 114, 236);
      ctx.lineTo(side * 104, 248);
      ctx.lineTo(side * 98, 236);
      ctx.closePath();
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = stone;
    ctx.fill();
    this.strokeNeon(ctx, JADE, edge, 1.5);

    // The courses of stone it is built from
    ctx.beginPath();
    for (const [y, half] of [
      [88, 98],
      [176, 98],
      [226, 97],
      [266, 92],
    ]) {
      ctx.moveTo(-half, y);
      ctx.lineTo(half, y);
    }
    for (const [x, from, to] of [
      [-58, 88, 118],
      [62, 88, 118],
      [-80, 176, 226],
      [72, 226, 266],
      [-44, 266, 300],
      [36, 266, 300],
    ]) {
      ctx.moveTo(x, from);
      ctx.lineTo(x, to);
    }
    ctx.strokeStyle = WATER_COLOR;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8 * alpha;
    ctx.stroke();

    // Deep sockets in the shadow of a brow that juts out like a ledge
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(side * 72, 132);
      ctx.lineTo(side * 14, 132);
      ctx.lineTo(side * 18, 166);
      ctx.lineTo(side * 66, 166);
      ctx.closePath();
    }
    ctx.fillStyle = '#010706';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-86, 116);
    ctx.lineTo(86, 116);
    ctx.lineTo(80, 134);
    ctx.lineTo(-80, 134);
    ctx.closePath();
    ctx.fillStyle = '#0f3331';
    ctx.fill();
    this.strokeNeon(ctx, JADE, edge * 1.1, 1.5);

    // Lit slits deep in the sockets, widening a little on the beat and flaring on a drop
    const eyeColor = mixHexColors(COLORS.CYAN, COLORS.PINK, heat);
    const eyeGlow = clamp((0.55 + 0.45 * pulse) * lights + flash, 0, 1) * alpha;
    const open = 2 + pulse * 3 + flash * 4;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = eyeGlow;
    ctx.fillStyle = eyes;
    ctx.fillRect(-90, 110, 180, 80);
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(side * 60, 150);
      ctx.lineTo(side * 24, 150 - open / 2);
      ctx.lineTo(side * 24, 150 + open / 2);
      ctx.closePath();
    }
    ctx.fillStyle = eyeColor;
    ctx.fill();
    ctx.restore();
    this.strokeNeon(ctx, eyeColor, eyeGlow, 1);

    // A long, straight nose widening to a flat base
    ctx.beginPath();
    ctx.moveTo(-7, 134);
    ctx.lineTo(7, 134);
    ctx.lineTo(17, 206);
    ctx.lineTo(10, 214);
    ctx.lineTo(-10, 214);
    ctx.lineTo(-17, 206);
    ctx.closePath();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#0d2e2c';
    ctx.fill();
    this.strokeNeon(ctx, JADE, edge * 0.8, 1.2);

    // Pressed lips: a hard level line, the corners pulled down, a short jutting lower lip
    ctx.beginPath();
    ctx.moveTo(-38, 247);
    ctx.lineTo(-32, 240);
    ctx.lineTo(32, 240);
    ctx.lineTo(38, 247);
    ctx.moveTo(-18, 252);
    ctx.lineTo(18, 252);
    ctx.moveTo(-46, 284);
    ctx.lineTo(46, 284);
    this.strokeNeon(ctx, JADE, edge * 0.9, 1.8);

    ctx.restore();
  }

  /** Broken columns standing in the water, their tops snapped off. */
  private renderColumns(ctx: CanvasRenderingContext2D, layout: Layout, alpha: number): void {
    ctx.beginPath();
    for (const { x: center, top, width } of COLUMNS) {
      const x = center * layout.spread;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, top + 8);
      ctx.lineTo(x + width * 0.3, top);
      ctx.lineTo(x + width * 0.6, top + 10);
      ctx.lineTo(x + width, top + 3);
      ctx.lineTo(x + width, 0);
      ctx.closePath();
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = STONE_FOOT;
    ctx.fill();
    ctx.globalAlpha = 1;
    this.strokeNeon(ctx, JADE, 0.35 * alpha, 1.2);
  }

  /**
   * The water: the halo, the face and the columns mirrored and squashed in it, broken up by
   * drifting ripples, lotuses floating on top.
   */
  private renderWater(
    ctx: CanvasRenderingContext2D,
    frame: BackgroundFrame,
    glow: Glow,
    layout: Layout,
  ): void {
    const { width, height, waterY } = layout;
    const { time } = frame;
    const depth = height - waterY;

    ctx.fillStyle = WATER_COLOR;
    ctx.fillRect(0, waterY, width, depth);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, waterY, width, depth);
    ctx.clip();
    this.enterScene(ctx, layout);
    ctx.scale(1, -REFLECTION.SQUASH);
    this.renderHalo(ctx, frame, glow, REFLECTION.ALPHA);
    this.renderFace(ctx, FACE.TOP, FACE.SCALE, glow, REFLECTION.ALPHA * 0.6);
    this.renderColumns(ctx, layout, REFLECTION.ALPHA);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = WATER_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < RIPPLE_COUNT; k++) {
      const y = waterY + 6 + (k + 0.5 + Math.sin(time + k) * 0.2) * (depth / RIPPLE_COUNT);
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Where the water meets the stone
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.6 * glow.lights;
    ctx.fillStyle = JADE_DIM;
    ctx.fillRect(0, waterY - 1, width, 2);
    ctx.restore();

    ctx.save();
    const scale = layout.unit / SCENE_UNITS;
    for (const lotus of LOTUSES) {
      const bob = Math.sin(time + lotus.x * 10) * 2;
      this.renderLotus(
        ctx,
        lotus.x * width,
        waterY + lotus.y * depth + bob,
        lotus.scale * scale,
        glow,
      );
    }
    ctx.restore();
  }

  /** A lotus on its pad, its petals glowing with the beat. */
  private renderLotus(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    { pulse, lights, flash }: Glow,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.beginPath();
    ctx.ellipse(0, 4, 26, 6, 0, 0, TWO_PI);
    ctx.fillStyle = LOTUS_PAD;
    ctx.fill();
    this.strokeNeon(ctx, JADE, 0.4 * lights, 1);

    ctx.beginPath();
    for (const [angle, length] of [
      [-Math.PI / 2, 22],
      [-2.2, 18],
      [-0.94, 18],
      [-2.7, 13],
      [-0.44, 13],
    ]) {
      this.traceLeaf(ctx, 0, 2, angle, length, 0.35, 0);
    }
    ctx.fillStyle = LOTUS_PINK;
    ctx.fill();
    this.strokeNeon(ctx, COLORS.PINK, clamp((0.5 + 0.4 * pulse) * lights + flash, 0, 1), 1.2);
    ctx.restore();
  }

  /** Fireflies wandering on slow loops, blinking on and off; a drop lights them all at once. */
  private renderFireflies(
    ctx: CanvasRenderingContext2D,
    pulse: number,
    lights: number,
    flash: number,
    layout: Layout,
  ): void {
    const { width, height } = layout;
    const t = this.wander;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const fly of this.fireflies) {
      const x = (fly.x + Math.sin(t * 0.4 * fly.speed + fly.phase) * FIREFLY.WANDER) * width;
      const y =
        (fly.y + Math.sin(t * 0.55 * fly.speed + fly.phase * 1.7) * FIREFLY.WANDER) * height;
      const blink = Math.max(0, Math.sin(t * FIREFLY.BLINK * fly.speed + fly.phase)) ** 3;
      const glow = clamp((blink + pulse * 0.3) * lights + flash, 0, 1);
      if (glow < 0.03) continue;

      ctx.fillStyle = FIREFLY_COLORS[fly.color];
      ctx.globalAlpha = glow * 0.25;
      ctx.beginPath();
      ctx.arc(x, y, FIREFLY.RADIUS * 3.5, 0, TWO_PI);
      ctx.fill();
      ctx.globalAlpha = glow;
      ctx.fillRect(x - FIREFLY.RADIUS / 2, y - FIREFLY.RADIUS / 2, FIREFLY.RADIUS, FIREFLY.RADIUS);
    }
    ctx.restore();
  }

  /** The jungle framing the scene: vines, palm trunks, and every leaf, rims lit in neon. */
  private renderJungle(
    ctx: CanvasRenderingContext2D,
    time: number,
    { pulse, heat, lights, flash }: Glow,
    layout: Layout,
  ): void {
    const { width, height, unit } = layout;
    const fill = mixHexColors(LEAF_FILL_COOL, LEAF_FILL_HOT, heat);
    const sway = (phase: number) =>
      Math.sin(time * SWAY.RATE + phase) * SWAY.ANGLE * (1 + heat * SWAY.CLIMAX) +
      pulse * SWAY.PULSE;

    // Vines: one stroke for the lot, their little leaves join the leaf paths below
    const vineLeaves: [x: number, y: number, angle: number][] = [];
    ctx.save();
    ctx.strokeStyle = fill;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    VINES.forEach((vine, i) => {
      const x = vine.x * width;
      const bottom = vine.length * height;
      const swing = sway(i * 1.9) * bottom * 0.6;
      ctx.moveTo(x, 0);
      ctx.quadraticCurveTo(x + swing * 0.5, bottom * 0.5, x + swing, bottom);
      for (let y = VINE_LEAF_SPACING; y < vine.length; y += VINE_LEAF_SPACING) {
        const t = y / vine.length;
        const side = Math.round(y / VINE_LEAF_SPACING) % 2 ? 1 : -1;
        vineLeaves.push([x + swing * t * t, y * height, Math.PI / 2 + side * 0.9]);
      }
    });
    ctx.stroke();

    // Palm trunks: thick curved strokes over a faint jade edge
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const palm of PALMS) {
      ctx.moveTo(palm.foot[0] * width, palm.foot[1] * height);
      ctx.quadraticCurveTo(
        palm.bend[0] * width,
        palm.bend[1] * height,
        palm.crown[0] * width,
        palm.crown[1] * height,
      );
    }
    ctx.strokeStyle = JADE_DIM;
    ctx.globalAlpha = 0.6 * lights;
    ctx.lineWidth = TRUNK_WIDTH + 3;
    ctx.stroke();
    ctx.strokeStyle = fill;
    ctx.globalAlpha = 1;
    ctx.lineWidth = TRUNK_WIDTH;
    ctx.stroke();
    ctx.restore();

    [JADE, COLORS.PINK].forEach((rim, rimIndex) => {
      ctx.beginPath();
      for (const leaf of this.leaves) {
        if (leaf.rim !== rimIndex) continue;
        this.traceLeaf(
          ctx,
          leaf.x * width,
          leaf.y * height,
          leaf.angle + sway(leaf.phase),
          leaf.length * unit,
          leaf.width,
          leaf.droop,
        );
      }
      if (rimIndex === 0) {
        for (const [x, y, angle] of vineLeaves) {
          this.traceLeaf(ctx, x, y, angle, unit * 0.025, 0.4, 0);
        }
      }
      ctx.fillStyle = fill;
      ctx.fill();
      const alpha = clamp((0.35 + pulse * 0.2) * lights + flash, 0, 1);
      this.strokeNeon(ctx, heat > 0.5 ? COLORS.PINK : rim, alpha, 1.2, flash);
    });
  }

  /**
   * Adds a leaf to the current path: two curves from the stem to the tip, the tip pulled down
   * by `droop` (a share of the length) so long fronds arch over.
   */
  private traceLeaf(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    length: number,
    widthShare: number,
    droop: number,
  ): void {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const tipX = x + dx * length;
    const tipY = y + dy * length + droop * length;
    const midX = x + dx * length * 0.5;
    const midY = y + dy * length * 0.5 + droop * length * 0.15;
    const half = length * widthShare;

    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(midX - dy * half, midY + dx * half, tipX, tipY);
    ctx.quadraticCurveTo(midX + dy * half, midY - dx * half, x, y);
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
