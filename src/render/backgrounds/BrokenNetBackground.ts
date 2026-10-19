import { COURT } from '@/match/config';
import { Background, BackgroundFrame } from '@/render/backgrounds/Background';
import { clamp, mixHexColors } from '@/shared/math';
import { COLORS } from '@/shared/palette';

// The third and last tier of the challenges (docs/CHALLENGES.md): the finale, where the world
// itself loses its connection. The synthwave of the quick match coming apart: the sun crumbles
// into pixels, a wireframe range flies at the viewer with lines missing like lost packets, and
// windows of real network errors pop up along the edges. The range itself breaks as the rally
// heats up: corrupted peaks spike and sink, then pieces of the slopes fall away into the void,
// and at the height of it the picture slides apart in bands. Faults stay at the edges, away from
// the ball; a win brings the signal back for a moment

// Where things stand, as shares of the frame's height (or width), so either orientation fits
const LAYOUT = {
  HORIZON: 0.5,
  SUN_RADIUS: 92, // px at full scale
  SUN_RISE: 0.35, // how far the sun's centre sits above the horizon, in radii
} as const;

// A cold, dead screen: navy to teal at rest. With the climax it overheats as the other
// backgrounds heat up: the horizon burns magenta, the sun's base and the near ridges go pink
const SKY_COOL = ['#01040f', '#06163a', '#0e3a5c'];
const SKY_HOT = ['#0c0322', '#3a0a5c', '#b0206e'];
const HOT = COLORS.PINK;
const FLOOR = '#020814';
const ICE = '#e8fbff';
const DEEP_BLUE = '#3a4cff';
const STARS = 34;

const SUN = {
  CELL: 7, // px a pixel of the sun measures, at full scale
  TOP: ICE,
  BOTTOM: '#2f7bff',
  // The lower part crumbles: below DECAY_FROM (a share of the sun's height) more and more of
  // its pixels are gone, up to DECAY_MAX at the bottom; the edge of the decay drifts with time
  DECAY_FROM: 0.22,
  DECAY_MAX: 1,
  DEAD: 0.03, // share of pixels gone even at the top
  DRIFT: 0.08,
  DRIFT_SPEED: 0.6, // rad/s
  // Pixels coming loose and falling away from it
  FALLING: 60,
  FALL_RATE: 30, // pixels let go a second
  FALL_LIFE: 2.2, // s
  GRAVITY: 30, // px/s²
} as const;

const TERRAIN = {
  ROWS: 14, // ridges between the viewer and the horizon, one world unit apart
  COLUMNS: 16, // columns either side of the middle, one world unit apart
  CAMERA: 1, // world units above the valley floor
  VALLEY: 2.2, // half-width of the flat valley the court lies in, in world units
  RISE: 4, // world units over which the slopes rise to their full height
  PEAK: 2.2, // world units the tallest peaks reach
  SPEED: 1.2, // world units a second the range flies at the viewer
  LOST: 0.09, // share of the wireframe's lines missing, like lost packets
  FADE: 2.5, // world units over which a new ridge fades in at the horizon
  NEAR: COLORS.CYAN,
  FAR: DEEP_BLUE,
} as const;

// The range breaking, more the hotter the rally: corrupted vertices from the start, holes from
// VOID.FROM, bands sliding apart from SLABS.FROM. Never in the valley under the court
const CORRUPT = {
  BASE: 0.15, // how corrupt the range is at rest, of 1
  HEAT: 0.6, // how much more at the height of a rally
  CHANCE: [0.03, 0.15], // share of the slopes' vertices corrupted, at none and at full
  FLICKER: 0.4, // of that share again, flicking on and off rather than staying
  FLICKER_RATE: 10, // times a second the flickering ones change
  SPIKE: [1.8, 4], // times a peak's height a corrupted one shoots to, at none and at full
  SPIKE_LIFT: 0.4, // world units added on top, at full
  MAX_RISE: 3.4, // world units, so a near spike doesn't fill the sky
  PIT_SHARE: 0.35, // share of corrupted vertices that sink into pits instead
  PIT: [0.3, 1], // world units below the valley floor a pit drops
  COLOR: '#ff8ae6', // a corrupted line: pink gone white-hot
} as const;

const VOID = {
  FROM: 0.3, // the climax the slopes start falling apart at
  CHANCE: [0.04, 0.2], // share of the slopes' cells that fall away, from VOID.FROM to full
  OPENS: [3, 10], // world units away a cell may come loose, near to far (hotter: farther)
  FALL: 1.6, // world units the range travels while a piece falls away
  DROP: 140, // px a piece has dropped by the time it is gone
  TURN: 1.6, // radians a piece may turn as it drops
  EDGE: COLORS.PINK, // the hole's rim
  HOLE: '#000000',
} as const;

const SLABS = {
  FROM: 0.7, // the climax the picture starts sliding apart at
  EDGE: 0.22, // share of the width either side the bands keep to, away from the ball
  TOP: 120, // px above the horizon they start, through the peaks
  BAND: [5, 33], // px a band is tall
  CHANCE: [0.25, 0.65], // share of the bands that slide, from SLABS.FROM to full
  RATE: [2, 8], // times a second they change, from SLABS.FROM to full
  SHIFT: [20, 130], // px they slide at most, from SLABS.FROM to full
  SEAM_ALPHA: 0.35, // the coloured seam along a slid band's top
} as const;

const TEAR = {
  DURATION: 0.16, // s a tear lasts
  COOLDOWN: 1.6, // s before the next may come
  CHANCE: 0.3, // chance a strong beat tears the picture, before the climax raises it
  BANDS: 4,
  EDGE: 0.16, // share of the width either side the bands keep to, away from the ball
  SHIFT: 14, // px the colours split apart
} as const;
const STRONG_BEAT = 0.8;

const ERROR_WINDOW = {
  WIDTH: 172, // px at full scale
  HEIGHT: 66,
  MAX_WIDTH: 0.3, // share of the frame's width, on a narrow portrait court
  MARGIN: 0.075, // share of the width in from the edge, clear of the paddle
  SLOTS: [0.36, 0.56, 0.76], // tops of the windows down each edge, below the condition line
  MAX_OPEN: 2,
  MAX_OPEN_HOT: 5, // at the height of a rally
  HOT_SPAWN: 4, // times quicker they come at the height of a rally
  LIFE: [3.5, 5.5], // s
  SPAWN: [3, 6], // s between windows
  // A window comes through broken: torn into slices that slide apart, colours split, blocks of
  // noise round it, settling as it opens; it breaks up the same way as it goes
  POP: 0.35, // s
  CLOSING: 0.45, // s
  SLICES: 5,
  SLIDE: 0.35, // share of the window's width a slice may slide at the worst
  SPLIT: 12, // px the colours split apart at the worst
  NOISE: 7, // blocks of noise round it
  GLITCH_RATE: 24, // times a second the breakage changes
  BODY: '#03101e',
  TITLE: '#0b6f8a',
  BORDER: COLORS.CYAN,
  TEXT: '#bff6ff',
  FONT: "'Consolas', 'Courier New', monospace",
} as const;

// The errors, as real ones read: in English, as the originals are, whatever the game's language
const ERRORS = [
  'NO CARRIER',
  '504 Gateway Timeout',
  'ERR_CONNECTION_RESET',
  'Request timed out',
  'Packet loss: 87%',
  'Connection lost',
  'ERR_NAME_NOT_RESOLVED',
  'Ping: 9999 ms',
] as const;
const ERROR_TITLE = 'Network error';

const DROP_DURATION = 1.4; // s the signal holds whole after a victory

interface Layout {
  width: number;
  height: number;
  horizon: number;
  scale: number;
}

interface ErrorWindow {
  slot: number; // 0..5: left edge top to bottom, then right
  error: number;
  age: number;
  life: number;
}

interface FallingPixel {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  color: string;
}

/** Blends two `#rrggbb` colours into another `#rrggbb`, which can then be blended again. */
function mixToHex(from: string, to: string, t: number): string {
  const channel = (hex: string, offset: number) => parseInt(hex.slice(offset, offset + 2), 16);
  return `#${[1, 3, 5]
    .map((offset) => {
      const value = Math.round(
        channel(from, offset) + (channel(to, offset) - channel(from, offset)) * t,
      );
      return value.toString(16).padStart(2, '0');
    })
    .join('')}`;
}

/** A steady pseudo-random number in [0, 1) for a pair of integers. */
function hash(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

export class BrokenNetBackground implements Background {
  public readonly scene = 'brokenNet';
  public readonly overlayTint = 0.2;

  private readonly reducedMotion =
    typeof window === 'undefined' ? null : window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly stars = Array.from({ length: STARS }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: Math.random() < 0.2 ? 2 : 1,
  }));
  private readonly windows: ErrorWindow[] = [];
  private readonly falling: FallingPixel[] = [];
  private travel = 0;
  private decayTime = 0;
  private fallDue = 0;
  private spawnIn = 0.4;
  private tearAge = Infinity;
  private tearCooldown = 0;
  private tearSeed = 0;
  private wasBeat = false;
  /** The rally's climax as last drawn: more errors come the hotter it is. */
  private climax = 0;
  /** How broken the range is this frame: the climax's effects, none while the signal is back. */
  private breakage = { corrupt: 0, void: 0, slabs: 0 };
  private dropAge = Infinity;
  /** The sun's last layout, where the loose pixels fall from. */
  private sunAt: { x: number; y: number; radius: number; cell: number } | null = null;
  private skyKey = '';
  private sky: CanvasGradient | null = null;

  public triggerDrop(): void {
    // The signal comes back: the errors close and the sun is whole for a moment
    this.dropAge = 0;
    this.windows.length = 0;
    this.tearAge = Infinity;
  }

  private get isStill(): boolean {
    return this.reducedMotion?.matches ?? false;
  }

  /** The ridges fly on, the sun sheds pixels, errors open and close, even while another is shown. */
  public advance(dt: number, pulse: number, heat: number): void {
    this.dropAge += dt;
    const isBeat = pulse > STRONG_BEAT;
    const isNewBeat = isBeat && !this.wasBeat;
    this.wasBeat = isBeat;
    if (this.isStill) {
      // Nothing moves: a couple of errors stay open where they are
      this.tearAge = Infinity;
      while (this.windows.length < 2) this.openWindow(Infinity);
      return;
    }
    const isRepaired = this.dropAge < DROP_DURATION;

    this.travel += dt * TERRAIN.SPEED * (1 + 0.6 * heat);
    this.decayTime += dt;
    this.advanceFalling(dt, isRepaired);

    for (const w of this.windows) w.age += dt;
    for (let i = this.windows.length - 1; i >= 0; i--) {
      if (this.windows[i].age >= this.windows[i].life) this.windows.splice(i, 1);
    }
    if (isRepaired) return;

    this.spawnIn -= dt * (1 + (ERROR_WINDOW.HOT_SPAWN - 1) * this.climax);
    const open = Math.round(
      ERROR_WINDOW.MAX_OPEN + (ERROR_WINDOW.MAX_OPEN_HOT - ERROR_WINDOW.MAX_OPEN) * this.climax,
    );
    if (this.windows.length < open && this.spawnIn <= 0) {
      this.openWindow(this.randomBetween(ERROR_WINDOW.LIFE));
      this.spawnIn = this.randomBetween(ERROR_WINDOW.SPAWN);
    }

    // Tears come only on a strong beat, rarely, and keep to the edges
    this.tearAge += dt;
    this.tearCooldown -= dt;
    if (isNewBeat && this.tearCooldown <= 0 && Math.random() < TEAR.CHANCE * (1 + heat)) {
      this.tearAge = 0;
      this.tearCooldown = TEAR.COOLDOWN;
      this.tearSeed = Math.floor(Math.random() * 1e6);
    }
  }

  public render(frame: BackgroundFrame): void {
    const { ctx, pulse, climax, laserIntensity, isRotated } = frame;
    this.climax = climax;
    const repair = this.dropAge < DROP_DURATION ? 1 - this.dropAge / DROP_DURATION : 0;
    const lights = 0.6 + 0.4 * laserIntensity;
    const whole = 1 - repair;
    this.breakage = {
      corrupt: (CORRUPT.BASE + CORRUPT.HEAT * climax) * whole,
      void: clamp((climax - VOID.FROM) / (1 - VOID.FROM), 0, 1) * whole,
      // The flicker of sliding bands is the one break held back with reduced motion
      slabs: this.isStill ? 0 : clamp((climax - SLABS.FROM) / (1 - SLABS.FROM), 0, 1) * whole,
    };

    ctx.save();
    const layout = this.applyOrientation(ctx, isRotated);
    this.renderSky(ctx, climax, layout);
    this.renderStars(ctx, layout);
    this.renderSun(ctx, pulse, climax, repair, lights, layout);
    this.renderFalling(ctx);
    this.renderTerrain(ctx, climax, lights, layout);
    if (this.breakage.slabs > 0) this.renderSlabs(ctx, layout);
    this.renderWindows(ctx, layout);
    if (this.tearAge < TEAR.DURATION) this.renderTear(ctx, layout);
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
      horizon: Math.round(height * LAYOUT.HORIZON),
      // Things sized for the landscape court shrink to fit a narrow portrait one
      scale: Math.min(1, width / COURT.WIDTH + 0.25),
    };
  }

  private randomBetween([min, max]: readonly number[]): number {
    return min + Math.random() * (max - min);
  }

  /** Opens an error in a free slot down one of the edges, if there is one. */
  private openWindow(life: number): void {
    const slots = ERROR_WINDOW.SLOTS.length * 2;
    const free = Array.from({ length: slots }, (_, i) => i).filter(
      (slot) => !this.windows.some((w) => w.slot === slot),
    );
    if (free.length === 0) return;
    const slot = free[Math.floor(Math.random() * free.length)];
    // Never the same error open twice
    const errors = ERRORS.map((_, i) => i).filter((i) => !this.windows.some((w) => w.error === i));
    const error = errors[Math.floor(Math.random() * errors.length)];
    // Opened while nothing moves, a window is simply there, without its opening
    this.windows.push({ slot, error, age: life === Infinity ? ERROR_WINDOW.POP : 0, life });
  }

  /** Lets loose pixels fall from the sun's crumbling lower half, and drops the faded ones. */
  private advanceFalling(dt: number, isRepaired: boolean): void {
    for (const p of this.falling) {
      p.age += dt;
      p.vy += SUN.GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.falling.length - 1; i >= 0; i--) {
      if (this.falling[i].age >= SUN.FALL_LIFE) this.falling.splice(i, 1);
    }
    const sun = this.sunAt;
    if (!sun || isRepaired) return;
    this.fallDue += dt * SUN.FALL_RATE;
    while (this.fallDue >= 1 && this.falling.length < SUN.FALLING) {
      this.fallDue -= 1;
      const across = (Math.random() * 2 - 1) * sun.radius * 0.8;
      const down = sun.radius * (0.1 + Math.random() * 0.7);
      const t = (down + sun.radius) / (2 * sun.radius);
      this.falling.push({
        x: sun.x + across,
        y: sun.y + down,
        vx: (Math.random() - 0.5) * 16,
        vy: 4 + Math.random() * 10,
        age: 0,
        color: mixHexColors(SUN.TOP, mixToHex(SUN.BOTTOM, HOT, this.climax), t),
      });
    }
    this.fallDue = Math.min(this.fallDue, 1);
  }

  /** The sky down to the horizon: cool at rest, hotter with the climax. */
  private renderSky(ctx: CanvasRenderingContext2D, climax: number, layout: Layout): void {
    const { width, height, horizon } = layout;
    // Rebuilt only when the climax moves by a step, not every frame
    const step = Math.round(climax * 20) / 20;
    const key = `${width}|${horizon}|${step}`;
    if (key !== this.skyKey || !this.sky) {
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      SKY_COOL.forEach((cool, i) => {
        sky.addColorStop(i / (SKY_COOL.length - 1), mixHexColors(cool, SKY_HOT[i], step));
      });
      this.sky = sky;
      this.skyKey = key;
    }
    ctx.fillStyle = this.sky;
    ctx.fillRect(0, 0, width, horizon);
    ctx.fillStyle = FLOOR;
    ctx.fillRect(0, horizon, width, height - horizon);
  }

  private renderStars(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const { width, horizon } = layout;
    ctx.fillStyle = COLORS.WHITE;
    ctx.globalAlpha = 0.5;
    for (const star of this.stars) {
      ctx.fillRect(star.x * width, star.y * horizon * 0.85, star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * The sun as a disc of square pixels, ice white to blue, its lower part crumbling: more pixels
   * missing the lower they are, the edge of the decay drifting, banded gaps as the classic sun
   * has. Whole again for a moment after a victory.
   */
  private renderSun(
    ctx: CanvasRenderingContext2D,
    pulse: number,
    climax: number,
    repair: number,
    lights: number,
    layout: Layout,
  ): void {
    const { width, horizon, scale } = layout;
    const radius = LAYOUT.SUN_RADIUS * scale;
    const cell = Math.max(4, Math.round(SUN.CELL * scale));
    const cx = width / 2;
    const cy = horizon - radius * LAYOUT.SUN_RISE;
    this.sunAt = { x: cx, y: cy, radius, cell };

    const cells = Math.ceil(radius / cell);
    const drift = Math.sin(this.decayTime * SUN.DRIFT_SPEED) * SUN.DRIFT;
    const tick = Math.floor(this.decayTime * 6);
    ctx.globalAlpha = Math.min(1, (0.8 + 0.2 * pulse) * lights + repair * 0.3);
    for (let row = -cells; row < cells; row++) {
      const y = cy + row * cell;
      const t = (row + cells) / (2 * cells);
      // Banded gaps across the lower half, wider toward the bottom
      if (t > 0.55 && (row + cells) % (t > 0.8 ? 3 : 4) === 0) continue;
      const crumbled = clamp((t - SUN.DECAY_FROM - drift) / (1 - SUN.DECAY_FROM), 0, 1) ** 1.1;
      const decay = Math.max(SUN.DEAD, crumbled * SUN.DECAY_MAX) * (1 - repair);
      ctx.fillStyle = mixHexColors(SUN.TOP, mixToHex(SUN.BOTTOM, HOT, climax), t);
      const half = Math.sqrt(Math.max(0, radius * radius - (y + cell / 2 - cy) ** 2));
      for (let col = Math.floor(-half / cell); col * cell < half; col++) {
        // A few pixels flick on and off as the decay eats at them
        const roll = hash(col, row) * 0.85 + hash(col + tick, row) * 0.15;
        if (roll < decay) continue;
        ctx.fillRect(cx + col * cell, y, cell - 1, cell - 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** The pixels that came loose, falling and fading. */
  private renderFalling(ctx: CanvasRenderingContext2D): void {
    const cell = this.sunAt?.cell ?? SUN.CELL;
    for (const p of this.falling) {
      ctx.globalAlpha = 1 - p.age / SUN.FALL_LIFE;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, cell - 1, cell - 1);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * The wireframe range flying at the viewer: ridge after ridge, far to near, each strip between
   * two ridges filled dark so it hides what is behind it, then its lines stroked. The valley in
   * the middle stays flat, under the court; the slopes rise either side of it. Some lines are
   * missing, like lost packets, and they stay missing as the ridge comes on. Corrupted vertices
   * spike or sink, their lines burning white-hot, and cells of the slopes fall away into the
   * void; both stay with their ridge as it comes on.
   */
  private renderTerrain(
    ctx: CanvasRenderingContext2D,
    climax: number,
    lights: number,
    layout: Layout,
  ): void {
    const { width, height, horizon } = layout;
    const focal = (height - horizon) / TERRAIN.CAMERA;
    const cx = width / 2;
    const passed = Math.floor(this.travel);
    const offset = this.travel - passed;
    const columns = TERRAIN.COLUMNS;

    const tick = Math.floor(this.decayTime * CORRUPT.FLICKER_RATE);

    // A ridge's points on screen, at depth z, for the ridge numbered k since the start, and
    // which of them are corrupted
    const ridge = (z: number, k: number): { points: number[]; hot: boolean[] } => {
      const points: number[] = [];
      const hot: boolean[] = [];
      for (let c = -columns; c <= columns; c++) {
        const slope = clamp((Math.abs(c) - TERRAIN.VALLEY) / TERRAIN.RISE, 0, 1) ** 1.3;
        let rise = slope * TERRAIN.PEAK * (0.35 + 0.65 * hash(c, k));
        const corrupted = this.corruptRise(c, k, rise, tick);
        if (corrupted !== null) rise = corrupted;
        hot.push(corrupted !== null);
        points.push(cx + (c * focal) / z, horizon + ((TERRAIN.CAMERA - rise) * focal) / z);
      }
      return { points, hot };
    };

    ctx.lineWidth = 1.5;
    let far: number[] | null = null;
    let farHot: boolean[] = [];
    for (let i = TERRAIN.ROWS; i >= 0; i--) {
      const z = i + 1 - offset;
      const k = passed + i;
      const { points: near, hot } = ridge(z, k);
      if (far) {
        // The strip between the far ridge and this one
        ctx.fillStyle = FLOOR;
        ctx.beginPath();
        ctx.moveTo(far[0], far[1]);
        for (let p = 2; p < far.length; p += 2) ctx.lineTo(far[p], far[p + 1]);
        for (let p = near.length - 2; p >= 0; p -= 2) ctx.lineTo(near[p], near[p + 1]);
        ctx.closePath();
        ctx.fill();

        const depth = (z - 1) / TERRAIN.ROWS;
        ctx.strokeStyle = mixHexColors(mixToHex(TERRAIN.NEAR, HOT, climax), TERRAIN.FAR, depth);
        const alpha =
          clamp((TERRAIN.ROWS + 1 - z) / TERRAIN.FADE, 0, 1) * (0.7 + 0.3 * climax) * lights;
        ctx.globalAlpha = alpha;
        // Lines at a corrupted vertex are stroked apart, after the rest, white-hot
        const hotLines: number[] = [];
        ctx.beginPath();
        for (let p = 0, c = -columns; p < near.length; p += 2, c++) {
          const n = p / 2;
          // The line back to the far ridge, and the ridge's own line to the next point
          if (hash(c * 7 + 3, k) >= TERRAIN.LOST) {
            if (hot[n] || farHot[n]) {
              hotLines.push(near[p], near[p + 1], far[p], far[p + 1]);
            } else {
              ctx.moveTo(near[p], near[p + 1]);
              ctx.lineTo(far[p], far[p + 1]);
            }
          }
          if (p + 2 < near.length && hash(c * 13 + 5, k) >= TERRAIN.LOST) {
            if (hot[n] || hot[n + 1]) {
              hotLines.push(near[p], near[p + 1], near[p + 2], near[p + 3]);
            } else {
              ctx.moveTo(near[p], near[p + 1]);
              ctx.lineTo(near[p + 2], near[p + 3]);
            }
          }
        }
        ctx.stroke();
        if (hotLines.length > 0) {
          const lineColor = ctx.strokeStyle;
          ctx.strokeStyle = CORRUPT.COLOR;
          ctx.beginPath();
          for (let p = 0; p < hotLines.length; p += 4) {
            ctx.moveTo(hotLines[p], hotLines[p + 1]);
            ctx.lineTo(hotLines[p + 2], hotLines[p + 3]);
          }
          ctx.stroke();
          ctx.strokeStyle = lineColor;
        }
        if (this.breakage.void > 0) this.renderVoid(ctx, far, near, z, k, alpha);
        ctx.globalAlpha = 1;
      }
      far = near;
      farHot = hot;
    }
  }

  /**
   * A corrupted vertex's height, or null for a sound one. Off the valley only: a few stay
   * corrupted all the way in, a few more flick on and off; most spike, the rest sink into pits.
   */
  private corruptRise(c: number, k: number, rise: number, tick: number): number | null {
    const amount = this.breakage.corrupt;
    if (amount <= 0 || Math.abs(c) <= TERRAIN.VALLEY + 0.5) return null;
    const [least, most] = CORRUPT.CHANCE;
    const chance = least + (most - least) * amount;
    const isStuck = hash(c * 5 + 1, k) < chance;
    const isFlicking = hash(c + tick * 3, k * 7 + tick) < chance * CORRUPT.FLICKER;
    if (!isStuck && !isFlicking) return null;
    if (hash(c, k + 99) < CORRUPT.PIT_SHARE) {
      const [shallow, deep] = CORRUPT.PIT;
      return -(shallow + (deep - shallow) * hash(k, c));
    }
    const [low, high] = CORRUPT.SPIKE;
    return Math.min(
      CORRUPT.MAX_RISE,
      rise * (low + (high - low) * amount) + CORRUPT.SPIKE_LIFT * amount,
    );
  }

  /**
   * Cells of the strip between two ridges that have come loose: a black hole into the void with
   * a pink rim where each was, and the cell itself dropping and turning away until it is gone.
   * The nearer strips, drawn after, cover it as it falls behind them.
   */
  private renderVoid(
    ctx: CanvasRenderingContext2D,
    far: number[],
    near: number[],
    z: number,
    k: number,
    alpha: number,
  ): void {
    const [least, most] = VOID.CHANCE;
    const chance = least + (most - least) * this.breakage.void;
    const [nearest, farthest] = VOID.OPENS;
    const lineColor = ctx.strokeStyle;
    for (let p = 0, c = -TERRAIN.COLUMNS; p + 2 < near.length; p += 2, c++) {
      if (Math.min(Math.abs(c), Math.abs(c + 1)) < TERRAIN.VALLEY + 1) continue;
      if (hash(c * 31 + 7, k) >= chance) continue;
      const opensAt =
        nearest + (farthest - nearest) * hash(k, c * 3) * (0.6 + 0.4 * this.breakage.void);
      const fall = clamp((opensAt - z) / VOID.FALL, 0, 1);
      if (fall <= 0) continue;

      // The cell, traced afresh for each fill and stroke
      const cell = () => {
        ctx.beginPath();
        ctx.moveTo(far[p], far[p + 1]);
        ctx.lineTo(far[p + 2], far[p + 3]);
        ctx.lineTo(near[p + 2], near[p + 3]);
        ctx.lineTo(near[p], near[p + 1]);
        ctx.closePath();
      };

      ctx.globalAlpha = 1;
      ctx.fillStyle = VOID.HOLE;
      cell();
      ctx.fill();
      ctx.strokeStyle = VOID.EDGE;
      ctx.globalAlpha = alpha * Math.min(1, fall * 3);
      ctx.stroke();

      if (fall < 1) {
        const mx = (far[p] + near[p + 2]) / 2;
        const my = (far[p + 1] + near[p + 3]) / 2;
        ctx.save();
        ctx.translate(mx, my + fall * fall * VOID.DROP);
        ctx.rotate((hash(c, k) - 0.5) * VOID.TURN * fall);
        ctx.translate(-mx, -my);
        ctx.globalAlpha = alpha * (1 - fall);
        ctx.fillStyle = FLOOR;
        cell();
        ctx.fill();
        ctx.strokeStyle = lineColor;
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.strokeStyle = lineColor;
    ctx.globalAlpha = alpha;
  }

  /**
   * At the height of a rally the picture slides apart: bands down the edges, from the peaks to
   * the bottom, show what lies further along, like a picture that lost its packets. Copied from
   * the canvas as drawn so far (only the background), through its transform, so it holds on a
   * turned or zoomed court. Never across the middle, where the ball is.
   */
  private renderSlabs(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const matrix = ctx.getTransform?.();
    if (!matrix) return;
    const { width, height, horizon } = layout;
    const amount = this.breakage.slabs;
    const lerp = ([from, to]: readonly number[]) => from + (to - from) * amount;
    const epoch = Math.floor(this.decayTime * lerp(SLABS.RATE));
    const chance = lerp(SLABS.CHANCE);
    const shift = lerp(SLABS.SHIFT);
    const edge = width * SLABS.EDGE;
    const [shortest, tallest] = SLABS.BAND;

    // A rectangle of the picture in the canvas's own pixels: turns are by quarters, so it stays
    // a rectangle
    const toCanvas = (x: number, y: number, w: number, h: number) => {
      const a = matrix.transformPoint({ x, y });
      const b = matrix.transformPoint({ x: x + w, y: y + h });
      return [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)];
    };

    ctx.save();
    for (let y = horizon - SLABS.TOP, n = 0; y < height; n++) {
      const h = shortest + (tallest - shortest) * hash(n, epoch);
      if (hash(n + 50, epoch) < chance) {
        const slide = hash(epoch, n + 7) * shift;
        // The left band shows what lies to its right, the right one what lies to its left, so
        // the copy never reaches past the picture
        const bands = [
          [0, slide],
          [width - edge, width - edge - slide],
        ];
        for (const [x, from] of bands) {
          const [sx, sy, sw, sh] = toCanvas(from, y, edge, h);
          const [dx, dy, dw, dh] = toCanvas(x, y, edge, h);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(ctx.canvas, sx, sy, sw, sh, dx, dy, dw, dh);
          ctx.setTransform(matrix);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = SLABS.SEAM_ALPHA;
          ctx.fillStyle = hash(n, epoch + 3) < 0.5 ? COLORS.PINK : COLORS.CYAN;
          ctx.fillRect(x, y, edge, 1.5);
        }
      }
      y += h;
    }
    ctx.restore();
  }

  /**
   * The errors open down the edges: a dark window with a title bar, a warning sign, the message
   * and an OK button. They come and go broken, torn into slices (not with reduced motion).
   */
  private renderWindows(ctx: CanvasRenderingContext2D, layout: Layout): void {
    if (this.windows.length === 0) return;
    const { width, height, scale } = layout;
    const w = Math.min(ERROR_WINDOW.WIDTH * scale, width * ERROR_WINDOW.MAX_WIDTH);
    const h = ERROR_WINDOW.HEIGHT * scale;
    const rows = ERROR_WINDOW.SLOTS.length;
    ctx.save();
    ctx.textBaseline = 'middle';
    for (const win of this.windows) {
      const left = win.slot < rows;
      const x = left ? width * ERROR_WINDOW.MARGIN : width * (1 - ERROR_WINDOW.MARGIN) - w;
      const y = height * ERROR_WINDOW.SLOTS[win.slot % rows];
      // How broken it is: most as it appears and as it goes, whole in between
      const opening = 1 - win.age / ERROR_WINDOW.POP;
      const closing = 1 - (win.life - win.age) / ERROR_WINDOW.CLOSING;
      const broken = this.isStill ? 0 : clamp(Math.max(opening, closing), 0, 1);
      ctx.save();
      ctx.translate(x, y);
      if (broken > 0) {
        this.renderBrokenWindow(ctx, win, w, h, broken, scale);
      } else {
        this.renderWindow(ctx, win, w, h, scale);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * A window coming through broken: it blinks out now and then, slices of it slide sideways
   * or are missing, its colours split into blue and cyan, and blocks of noise flick round it.
   */
  private renderBrokenWindow(
    ctx: CanvasRenderingContext2D,
    win: ErrorWindow,
    w: number,
    h: number,
    broken: number,
    scale: number,
  ): void {
    const tick = Math.floor(win.age * ERROR_WINDOW.GLITCH_RATE) + win.slot * 31;
    if (hash(tick, 1) < broken * 0.35) return;

    // The colours split: the window's shape in blue one way and cyan the other
    const split = ERROR_WINDOW.SPLIT * broken * (0.5 + hash(tick, 2));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 * broken;
    ctx.fillStyle = DEEP_BLUE;
    ctx.fillRect(-split, 0, w, h);
    ctx.fillStyle = COLORS.CYAN;
    ctx.fillRect(split, 0, w, h);
    ctx.restore();

    // The window itself, in slices that slide apart or drop out
    const slice = h / ERROR_WINDOW.SLICES;
    for (let k = 0; k < ERROR_WINDOW.SLICES; k++) {
      if (hash(k, tick + 9) < broken * 0.4) continue;
      const slide = (hash(tick, k + 3) - 0.5) * 2 * broken * ERROR_WINDOW.SLIDE * w;
      ctx.save();
      ctx.beginPath();
      ctx.rect(slide, k * slice, w, slice);
      ctx.clip();
      ctx.translate(slide, 0);
      this.renderWindow(ctx, win, w, h, scale);
      ctx.restore();
    }

    // Blocks of noise round it
    const noise = [COLORS.CYAN, ICE, DEEP_BLUE];
    ctx.globalAlpha = broken;
    for (let n = 0; n < ERROR_WINDOW.NOISE; n++) {
      ctx.fillStyle = noise[n % noise.length];
      ctx.fillRect(
        (hash(tick, n + 20) * 1.3 - 0.15) * w,
        (hash(n + 20, tick) * 1.2 - 0.1) * h,
        (4 + 18 * hash(tick + n, 5)) * scale,
        (2 + 4 * hash(n, tick + 5)) * scale,
      );
    }
    ctx.globalAlpha = 1;
  }

  /** One error window, whole, with its top left corner at the origin. */
  private renderWindow(
    ctx: CanvasRenderingContext2D,
    win: ErrorWindow,
    w: number,
    h: number,
    scale: number,
  ): void {
    const bar = 14 * scale;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = ERROR_WINDOW.BODY;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = ERROR_WINDOW.TITLE;
    ctx.fillRect(0, 0, w, bar);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ERROR_WINDOW.BORDER;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, w, h);

    ctx.fillStyle = COLORS.WHITE;
    ctx.textAlign = 'left';
    ctx.font = `700 ${Math.round(9 * scale)}px ${ERROR_WINDOW.FONT}`;
    ctx.fillText(ERROR_TITLE, 5 * scale, bar / 2);
    ctx.textAlign = 'right';
    ctx.fillText('×', w - 5 * scale, bar / 2);

    // The warning sign
    const sign = 14 * scale;
    const sx = 8 * scale;
    const sy = bar + 8 * scale;
    ctx.fillStyle = COLORS.YELLOW;
    ctx.beginPath();
    ctx.moveTo(sx + sign / 2, sy);
    ctx.lineTo(sx + sign, sy + sign);
    ctx.lineTo(sx, sy + sign);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = ERROR_WINDOW.BODY;
    ctx.textAlign = 'center';
    ctx.fillText('!', sx + sign / 2, sy + sign * 0.62);

    ctx.fillStyle = ERROR_WINDOW.TEXT;
    ctx.textAlign = 'left';
    ctx.font = `${Math.round(10 * scale)}px ${ERROR_WINDOW.FONT}`;
    ctx.fillText(ERRORS[win.error], sx + sign + 6 * scale, sy + sign / 2, w - sign - 20 * scale);

    // OK
    const okWidth = 30 * scale;
    const okHeight = 12 * scale;
    ctx.strokeStyle = ERROR_WINDOW.TEXT;
    ctx.lineWidth = 1;
    ctx.strokeRect(w / 2 - okWidth / 2, h - okHeight - 5 * scale, okWidth, okHeight);
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.round(8 * scale)}px ${ERROR_WINDOW.FONT}`;
    ctx.fillText('OK', w / 2, h - okHeight / 2 - 5 * scale);
  }

  /**
   * A tear on a strong beat: bands along the edges split into blue and cyan and slide apart,
   * a dark slice through each. Never in the middle, where the ball is.
   */
  private renderTear(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const { width, height } = layout;
    const fade = 1 - this.tearAge / TEAR.DURATION;
    const edge = width * TEAR.EDGE;
    ctx.save();
    for (let b = 0; b < TEAR.BANDS; b++) {
      const y = height * (0.3 + 0.65 * hash(this.tearSeed, b));
      const h = 4 + 12 * hash(b, this.tearSeed);
      const x = hash(this.tearSeed + b, 7) < 0.5 ? 0 : width - edge;
      const shift = TEAR.SHIFT * (0.5 + hash(b, 3)) * fade;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.7 * fade;
      ctx.fillStyle = FLOOR;
      ctx.fillRect(x, y, edge, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45 * fade;
      ctx.fillStyle = DEEP_BLUE;
      ctx.fillRect(x - shift, y + 1, edge, h * 0.5);
      ctx.fillStyle = COLORS.CYAN;
      ctx.fillRect(x + shift, y + h * 0.5, edge, h * 0.5);
    }
    ctx.restore();
  }
}
