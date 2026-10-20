import { COURT } from '@/match/config';
import { Bumper } from '@/match/court';
import { INVISIBLE_BAND, WIND } from '@/match/modifiers/modifiers';
import { HUD_LAYOUT } from '@/render/HudRenderer';
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

// Darkness: the middle of the court is dark; only the paddles' lanes are lit, the player's wider.
// A ball crossing the middle can't be seen but where it strikes a wall or a post, which flashes:
// the opponent's hit and the bounces are there to read its flight by
export const DARKNESS = {
  RGB: '3, 0, 10',
  ALPHA: 0.95,
  PLAYER_LANE: 190, // px from the left edge, lit
  OPPONENT_LANE: 160, // px from the right edge, lit
  EDGE: 50, // px the lanes' light fades over
  FLASH: 55, // px across a bounce's flash...
  FLASH_LIFE: 0.45, // ...and seconds it lasts
  SCORE_LIGHT: 50, // px around each score, which stays readable
  CONDITION_LIGHT: { WIDTH: 420, HEIGHT: 44, Y: 142 }, // px, around the condition line on court
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

  /**
   * The middle of the court in the dark: the paddles' lanes lit, and wherever a ball has just
   * bounced, a flash. The scores (and the condition line, when drawn on court) stay readable.
   */
  public static renderDarkness(
    ctx: CanvasRenderingContext2D,
    flashes: readonly Flash[],
    isConditionShown: boolean,
  ): void {
    const { EDGE } = DARKNESS;
    const left = DARKNESS.PLAYER_LANE;
    const right = COURT.WIDTH - DARKNESS.OPPONENT_LANE;
    const dark = `rgba(${DARKNESS.RGB}, ${DARKNESS.ALPHA})`;
    const clear = `rgba(${DARKNESS.RGB}, 0)`;
    beginLayer(ctx);

    // The dark core, with holes: the flashes, the scores, the condition line
    ctx.beginPath();
    ctx.rect(left + EDGE, 0, right - left - EDGE * 2, COURT.HEIGHT);
    const hole = (x: number, y: number, radius: number) => {
      ctx.moveTo(x + radius, y);
      ctx.arc(x, y, radius, 0, TWO_PI);
    };
    for (const { x, y } of flashes) hole(x, y, DARKNESS.FLASH);
    for (const x of [COURT.WIDTH / 2 - HUD_LAYOUT.SCORE_X, COURT.WIDTH / 2 + HUD_LAYOUT.SCORE_X]) {
      hole(x, HUD_LAYOUT.SCORE_Y, DARKNESS.SCORE_LIGHT);
    }
    if (isConditionShown) {
      const { WIDTH, HEIGHT, Y } = DARKNESS.CONDITION_LIGHT;
      ctx.rect(COURT.WIDTH / 2 - WIDTH / 2, Y - HEIGHT / 2, WIDTH, HEIGHT);
    }
    ctx.fillStyle = dark;
    ctx.fill('evenodd');

    // The lanes' light fades into it
    for (const [from, to] of [
      [left, left + EDGE],
      [right, right - EDGE],
    ]) {
      const fade = ctx.createLinearGradient(from, 0, to, 0);
      fade.addColorStop(0, clear);
      fade.addColorStop(1, dark);
      ctx.fillStyle = fade;
      ctx.fillRect(Math.min(from, to), 0, EDGE, COURT.HEIGHT);
    }

    // A flash dims back into the dark as it ages, from its rim inward
    for (const { x, y, age } of flashes) {
      const life = Math.max(0, 1 - age / DARKNESS.FLASH_LIFE);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, DARKNESS.FLASH);
      glow.addColorStop(0, `rgba(${DARKNESS.RGB}, ${DARKNESS.ALPHA * (1 - life)})`);
      glow.addColorStop(life, `rgba(${DARKNESS.RGB}, ${DARKNESS.ALPHA * (1 - life)})`);
      glow.addColorStop(1, dark);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, DARKNESS.FLASH, 0, TWO_PI);
      ctx.fill();
    }
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
