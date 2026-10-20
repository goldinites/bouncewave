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

// Darkness: the court is dark but for light cast from the paddles: full along each goal line
// (the player's reaches further), fading smoothly toward the middle, with a warm pool around each
// paddle like a lantern's. A ball crossing the middle can't be seen but where it strikes a wall
// or a post, which flashes: the opponent's hit and the bounces are there to read its flight by
export const DARKNESS = {
  RGB: '3, 0, 10',
  ALPHA: 0.95,
  PLAYER_LIGHT: 170, // px from the left edge lit in full...
  OPPONENT_LIGHT: 140, // ...from the right edge
  FADE: 110, // px the light fades over, into the dark
  LANTERN: 150, // px around a paddle its own pool of light reaches
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

// Slippery rain: thin streaks slanting down the court
const RAIN_LOOK = {
  DROPS: 70,
  LENGTH: 16, // px
  SLANT: 0.25, // px across a px down
  SPEED: 1.6, // court heights a second
  RGB: '150, 190, 255',
  ALPHA: 0.42,
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
   * The court in the dark but for the light cast from the paddles and the flashes where a ball
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
    const lit = 'rgba(0, 0, 0, 1)';
    const unlit = 'rgba(0, 0, 0, 0)';

    // Along each goal line, fading toward the middle
    for (const [edge, reach] of [
      [0, DARKNESS.PLAYER_LIGHT],
      [COURT.WIDTH, -DARKNESS.OPPONENT_LIGHT],
    ]) {
      const end = edge + reach + Math.sign(reach) * DARKNESS.FADE;
      const lane = m.createLinearGradient(edge, 0, end, 0);
      lane.addColorStop(0, lit);
      lane.addColorStop(Math.abs(reach) / Math.abs(end - edge), lit);
      lane.addColorStop(1, unlit);
      m.fillStyle = lane;
      m.fillRect(Math.min(edge, end), 0, Math.abs(end - edge), COURT.HEIGHT);
    }
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
   * Rain slanting down the court: the paddles slide on it.
   * @param isMotionReduced the drops hang still
   */
  public static renderRain(
    ctx: CanvasRenderingContext2D,
    time: number,
    isMotionReduced: boolean,
  ): void {
    beginLayer(ctx);
    ctx.strokeStyle = `rgba(${RAIN_LOOK.RGB}, ${RAIN_LOOK.ALPHA})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const fall = isMotionReduced ? 0 : time * RAIN_LOOK.SPEED;
    for (let i = 0; i < RAIN_LOOK.DROPS; i++) {
      const y = wrap(i * 0.381966 + fall) * COURT.HEIGHT;
      const x = wrap(i * 0.6180339 + (y / COURT.HEIGHT) * 0.05) * COURT.WIDTH;
      ctx.moveTo(x, y);
      ctx.lineTo(x - RAIN_LOOK.LENGTH * RAIN_LOOK.SLANT, y + RAIN_LOOK.LENGTH);
    }
    ctx.stroke();
    ctx.restore();
  }
}
