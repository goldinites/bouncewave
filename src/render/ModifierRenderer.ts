import { COURT } from '@/match/config';
import { Bumper } from '@/match/court';
import { INVISIBLE_BAND, WIND } from '@/match/modifiers/modifiers';
import { Paddle } from '@/match/Paddle';
import { TWO_PI } from '@/shared/math';

// Wind: streaks drifting across the court the way it blows, and chevrons in the middle that
// point it out. Before it turns, the streaks die down and the chevrons flicker
const WIND_LOOK = {
  STREAKS: 28,
  LENGTH: 22, // px at full strength
  SPEED: 0.35, // court heights a second
  RGB: '170, 235, 255',
  ALPHA: 0.32,
  CHEVRONS: [COURT.HEIGHT * 0.35, COURT.HEIGHT * 0.65], // px, where the chevrons stand
  CHEVRON: 9, // px across
} as const;

// Darkness: the whole court is dark but for a pool of light around each paddle, like a lantern's
// (decided with the user: no lit lanes along the goal lines). A ball can't be seen but in a pool
// or where it strikes a wall or a post, which flashes: the opponent's hit and the bounces are
// there to read its flight by
export const DARKNESS = {
  RGB: '3, 0, 10',
  ALPHA: 0.98, // a ball in the dark is a bare silhouette
  LANTERN: 180, // px around a paddle its pool of light reaches, fading
  FLASH: 55, // px across a bounce's flash...
  FLASH_LIFE: 0.45, // ...and seconds it lasts
  // The dark is worked out at this share of the court's size and drawn stretched: smooth, cheap
  MASK_SCALE: 0.25,
} as const;

/** A bounce's flash in the dark, and seconds since it went off. */
export interface Flash {
  x: number;
  y: number;
  age: number;
}

// The invisible band: its edges marked with dashed lines, its inside faintly hatched
const BAND = { RGB: '200, 140, 255', ALPHA: 0.35, DASH: [8, 8] } as const;

// Bumpers: neon posts, a hot core in a glowing ring
const BUMPER_LOOK = { COLOR: '#ff2bd6', CORE: '#ffd0f4', GLOW: 10 } as const;

// Ice: the court frozen over. A cold cast, frost thick along the walls, cracks in the ice, a
// sheen drifting across it and glints twinkling in it
const ICE_LOOK = {
  TINT: 'rgba(160, 215, 255, 0.1)',
  FROST: 'rgba(225, 245, 255, 0.3)', // along the walls, fading inward
  FROST_DEPTH: 70, // px
  CRACK: 'rgba(230, 248, 255, 0.28)',
  // The cracks, as polylines in shares of the court, so they sit the same at any size
  CRACKS: [
    [0.08, 0.2, 0.16, 0.31, 0.15, 0.42, 0.22, 0.5],
    [0.3, 0.86, 0.36, 0.74, 0.44, 0.71, 0.47, 0.6],
    [0.6, 0.12, 0.57, 0.25, 0.63, 0.33],
    [0.72, 0.62, 0.8, 0.7, 0.83, 0.84, 0.91, 0.9],
    [0.86, 0.22, 0.79, 0.3],
    [0.18, 0.66, 0.24, 0.78],
  ],
  SHEEN: 0.07, // alpha of the sheen's bands
  SHEEN_SPEED: 0.05, // court widths a second
  GLINTS: 14,
  GLINT_SIZE: 4, // px of each arm
} as const;

/**
 * Saves the context and starts it plain: a layer before may leave its own blending set (the
 * particles draw added up, and faded). Restore it when done.
 */
const beginLayer = (ctx: CanvasRenderingContext2D): void => {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};

/** Repeats `value` within [0, 1). */
const wrap = (value: number): number => value - Math.floor(value);

/** How the match's modifiers look on the court (docs/CHALLENGES.md): each shows what it does. */
export class ModifierRenderer {
  /**
   * The wind blowing, `wind` px/s² (positive down), turning in `turnsIn` seconds.
   * @param isMotionReduced the streaks hold still; the chevrons still point the way
   */
  public static renderWind(
    ctx: CanvasRenderingContext2D,
    wind: number,
    turnsIn: number,
    time: number,
    isMotionReduced: boolean,
  ): void {
    const direction = Math.sign(wind);
    // It dies down over the warning before it turns, and blows as hard as its gust
    const gust = Math.min(1, Math.abs(wind) / WIND.MAX);
    const strength = Math.min(1, turnsIn / WIND.WARNING) * (0.3 + 0.7 * gust);
    beginLayer(ctx);
    ctx.strokeStyle = `rgb(${WIND_LOOK.RGB})`;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.globalAlpha = WIND_LOOK.ALPHA * (0.35 + 0.65 * strength);
    ctx.beginPath();
    for (let i = 0; i < WIND_LOOK.STREAKS; i++) {
      const x = wrap(i * 0.6180339) * COURT.WIDTH;
      const drift = isMotionReduced ? 0 : time * WIND_LOOK.SPEED * direction * (0.5 + gust);
      const y = wrap(i * 0.381966 + drift) * COURT.HEIGHT;
      const length = WIND_LOOK.LENGTH * (0.4 + 0.6 * strength);
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + direction * length);
    }
    ctx.stroke();

    // Chevrons in the middle point the way it blows; they flicker while it is about to turn
    const isTurning = turnsIn < WIND.WARNING;
    ctx.globalAlpha = isTurning && Math.floor(time * 8) % 2 === 0 ? 0.25 : 0.7;
    ctx.lineWidth = 2.5;
    const size = WIND_LOOK.CHEVRON;
    ctx.beginPath();
    for (const y of WIND_LOOK.CHEVRONS) {
      for (const dy of [-size, size * 0.2]) {
        const tip = y + dy + direction * size * 0.6;
        ctx.moveTo(COURT.WIDTH / 2 - size, tip - direction * size);
        ctx.lineTo(COURT.WIDTH / 2, tip);
        ctx.lineTo(COURT.WIDTH / 2 + size, tip - direction * size);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  /** The dark, worked out small once a frame and drawn stretched over the court. */
  private static darkMask: HTMLCanvasElement | null = null;

  /**
   * The whole court in the dark but for the paddles' lanterns and the flashes where a ball
   * has just bounced. Drawn over the balls (one in the dark can't be seen); the HUD goes over it.
   */
  public static renderDarkness(
    ctx: CanvasRenderingContext2D,
    paddles: readonly Paddle[],
    flashes: readonly Flash[],
  ): void {
    const mask = ModifierRenderer.darkMask ?? document.createElement('canvas');
    ModifierRenderer.darkMask = mask;
    const scale = DARKNESS.MASK_SCALE;
    // Sized once: setting a canvas's size clears and reallocates it
    const width = Math.ceil(COURT.WIDTH * scale);
    if (mask.width !== width) {
      mask.width = width;
      mask.height = Math.ceil(COURT.HEIGHT * scale);
    }
    const m = mask.getContext('2d');
    if (!m) return;

    m.save();
    m.scale(scale, scale);
    m.globalCompositeOperation = 'copy';
    m.fillStyle = `rgb(${DARKNESS.RGB})`;
    m.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);
    // Light takes the dark away: wherever two lights meet, the brighter wins out
    m.globalCompositeOperation = 'destination-out';
    const unlit = 'rgba(0, 0, 0, 0)';

    // A lantern's pool around each paddle, and a flash wherever a ball bounced
    const pool = (x: number, y: number, radius: number, strength: number) => {
      const glow = m.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
      glow.addColorStop(0.45, `rgba(0, 0, 0, ${strength * 0.75})`);
      glow.addColorStop(1, unlit);
      m.fillStyle = glow;
      m.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    };
    for (const paddle of paddles) {
      pool(paddle.x + paddle.spec.width / 2, paddle.drawY, DARKNESS.LANTERN, 1);
    }
    for (const { x, y, age } of flashes) {
      pool(x, y, DARKNESS.FLASH, Math.max(0, 1 - age / DARKNESS.FLASH_LIFE));
    }
    m.restore();

    beginLayer(ctx);
    ctx.globalAlpha = DARKNESS.ALPHA;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(mask, 0, 0, COURT.WIDTH, COURT.HEIGHT);
    ctx.restore();
  }

  /** The invisible band's edges, so the player knows where the ball will vanish. */
  public static renderBand(ctx: CanvasRenderingContext2D): void {
    const { LEFT, RIGHT } = INVISIBLE_BAND;
    beginLayer(ctx);
    ctx.fillStyle = `rgba(${BAND.RGB}, 0.06)`;
    ctx.fillRect(LEFT, COURT.TOP_WALL, RIGHT - LEFT, COURT.HEIGHT - COURT.TOP_WALL * 2);
    ctx.strokeStyle = `rgba(${BAND.RGB}, ${BAND.ALPHA})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([...BAND.DASH]);
    ctx.beginPath();
    for (const x of [LEFT, RIGHT]) {
      ctx.moveTo(x, COURT.TOP_WALL);
      ctx.lineTo(x, COURT.HEIGHT - COURT.BOTTOM_WALL);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Whether the invisible band hides a ball at `x`. */
  public static isInBand(x: number): boolean {
    return x > INVISIBLE_BAND.LEFT && x < INVISIBLE_BAND.RIGHT;
  }

  /** The court's posts. */
  public static renderBumpers(ctx: CanvasRenderingContext2D, bumpers: readonly Bumper[]): void {
    beginLayer(ctx);
    for (const { x, y, radius, growth = 1 } of bumpers) {
      // A rising or sinking post blinks as it grows or shrinks
      const blink = growth < 1 && Math.floor(growth * 8) % 2 === 0 ? 0.35 : 1;
      // A glow as wider faint rings rather than shadowBlur
      ctx.fillStyle = BUMPER_LOOK.COLOR;
      for (const [grow, alpha] of [
        [BUMPER_LOOK.GLOW, 0.12],
        [BUMPER_LOOK.GLOW / 2, 0.22],
      ] as const) {
        ctx.globalAlpha = alpha * blink;
        ctx.beginPath();
        ctx.arc(x, y, radius + grow, 0, TWO_PI);
        ctx.fill();
      }
      ctx.globalAlpha = blink;
      ctx.lineWidth = 3;
      ctx.strokeStyle = BUMPER_LOOK.COLOR;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0, radius - 1.5), 0, TWO_PI);
      ctx.stroke();
      ctx.fillStyle = BUMPER_LOOK.CORE;
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.4, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * The court frozen over: the paddles slide on it.
   * @param isMotionReduced the sheen holds still and the glints shine steadily
   */
  public static renderIce(
    ctx: CanvasRenderingContext2D,
    time: number,
    isMotionReduced: boolean,
  ): void {
    const { WIDTH, HEIGHT } = COURT;
    beginLayer(ctx);
    ctx.fillStyle = ICE_LOOK.TINT;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Frost thick along the walls
    for (const [from, to] of [
      [COURT.TOP_WALL, COURT.TOP_WALL + ICE_LOOK.FROST_DEPTH],
      [HEIGHT - COURT.BOTTOM_WALL, HEIGHT - COURT.BOTTOM_WALL - ICE_LOOK.FROST_DEPTH],
    ]) {
      const frost = ctx.createLinearGradient(0, from, 0, to);
      frost.addColorStop(0, ICE_LOOK.FROST);
      frost.addColorStop(1, 'rgba(225, 245, 255, 0)');
      ctx.fillStyle = frost;
      ctx.fillRect(0, Math.min(from, to), WIDTH, ICE_LOOK.FROST_DEPTH);
    }

    // Cracks
    ctx.strokeStyle = ICE_LOOK.CRACK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const crack of ICE_LOOK.CRACKS) {
      ctx.moveTo(crack[0] * WIDTH, crack[1] * HEIGHT);
      for (let i = 2; i < crack.length; i += 2) ctx.lineTo(crack[i] * WIDTH, crack[i + 1] * HEIGHT);
    }
    ctx.stroke();

    // A sheen of two slanting bands drifting across
    const drift = isMotionReduced ? 0.3 : wrap(time * ICE_LOOK.SHEEN_SPEED);
    ctx.fillStyle = `rgba(255, 255, 255, ${ICE_LOOK.SHEEN})`;
    for (const [offset, width] of [
      [0, 60],
      [0.12, 24],
    ]) {
      const x = (wrap(drift + offset) * 1.4 - 0.2) * WIDTH;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + width, 0);
      ctx.lineTo(x + width - HEIGHT * 0.5, HEIGHT);
      ctx.lineTo(x - HEIGHT * 0.5, HEIGHT);
      ctx.fill();
    }

    // Glints twinkling in it
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < ICE_LOOK.GLINTS; i++) {
      const x = wrap(i * 0.6180339 + 0.11) * WIDTH;
      const y = wrap(i * 0.381966 + 0.27) * HEIGHT;
      const twinkle = isMotionReduced ? 0.5 : Math.max(0, Math.sin(time * 2.3 + i * 1.7));
      if (twinkle < 0.05) continue;
      const size = ICE_LOOK.GLINT_SIZE * twinkle;
      ctx.globalAlpha = 0.7 * twinkle;
      ctx.beginPath();
      ctx.moveTo(x - size, y);
      ctx.lineTo(x + size, y);
      ctx.moveTo(x, y - size);
      ctx.lineTo(x, y + size);
      ctx.stroke();
    }
    ctx.restore();
  }
}
