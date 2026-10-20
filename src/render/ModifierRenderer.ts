import { Ball } from '@/match/Ball';
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

// Darkness: the court is dark but for pools of light around the balls and the paddles
const DARKNESS = {
  RGB: '3, 0, 10',
  ALPHA: 0.93,
  BALL_LIGHT: 70, // px
  PADDLE_LIGHT: 85, // px
  SOFT: 0.4, // share of a pool's radius its edge fades over
} as const;

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

/** A pool of light in the dark. */
interface Light {
  x: number;
  y: number;
  radius: number;
}

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
    // It dies down over the warning before it turns
    const strength = Math.min(1, turnsIn / WIND.WARNING);
    ctx.save();
    ctx.strokeStyle = `rgb(${WIND_LOOK.RGB})`;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.globalAlpha = WIND_LOOK.ALPHA * (0.35 + 0.65 * strength);
    ctx.beginPath();
    for (let i = 0; i < WIND_LOOK.STREAKS; i++) {
      const x = wrap(i * 0.6180339) * COURT.WIDTH;
      const drift = isMotionReduced ? 0 : time * WIND_LOOK.SPEED * direction;
      const y = wrap(i * 0.381966 + drift) * COURT.HEIGHT;
      const length = WIND_LOOK.LENGTH * (0.4 + 0.6 * strength);
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + direction * length);
    }
    ctx.stroke();

    // Chevrons in the middle point the way it blows; they flicker while it is about to turn
    const isTurning = strength < 1;
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

  /** The court in the dark, but for pools of light around the balls and the paddles. */
  public static renderDarkness(
    ctx: CanvasRenderingContext2D,
    balls: readonly Ball[],
    paddles: readonly Paddle[],
  ): void {
    const lights: Light[] = [
      ...balls.map((ball) => ({ x: ball.drawX, y: ball.drawY, radius: DARKNESS.BALL_LIGHT })),
      ...paddles.map((paddle) => ({
        x: paddle.x + paddle.spec.width / 2,
        y: paddle.drawY,
        radius: DARKNESS.PADDLE_LIGHT,
      })),
    ];
    const dark = `rgba(${DARKNESS.RGB}, ${DARKNESS.ALPHA})`;
    ctx.save();
    // Everything but the pools, their soft edges included, in one fill with holes in it
    ctx.beginPath();
    ctx.rect(0, 0, COURT.WIDTH, COURT.HEIGHT);
    for (const { x, y, radius } of lights) {
      ctx.moveTo(x + radius, y);
      ctx.arc(x, y, radius, 0, TWO_PI);
    }
    ctx.fillStyle = dark;
    ctx.fill('evenodd');
    // Each pool's edge fades into the dark
    for (const { x, y, radius } of lights) {
      const inner = radius * (1 - DARKNESS.SOFT);
      const edge = ctx.createRadialGradient(x, y, inner, x, y, radius);
      edge.addColorStop(0, `rgba(${DARKNESS.RGB}, 0)`);
      edge.addColorStop(1, dark);
      ctx.fillStyle = edge;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The invisible band's edges, so the player knows where the ball will vanish. */
  public static renderBand(ctx: CanvasRenderingContext2D): void {
    const { LEFT, RIGHT } = INVISIBLE_BAND;
    ctx.save();
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
    ctx.save();
    for (const { x, y, radius } of bumpers) {
      // A glow as wider faint rings rather than shadowBlur
      ctx.fillStyle = BUMPER_LOOK.COLOR;
      for (const [grow, alpha] of [
        [BUMPER_LOOK.GLOW, 0.12],
        [BUMPER_LOOK.GLOW / 2, 0.22],
      ] as const) {
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, radius + grow, 0, TWO_PI);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3;
      ctx.strokeStyle = BUMPER_LOOK.COLOR;
      ctx.beginPath();
      ctx.arc(x, y, radius - 1.5, 0, TWO_PI);
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
    ctx.save();
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
