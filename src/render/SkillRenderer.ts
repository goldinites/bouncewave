import { Ball } from '@/match/Ball';
import { COURT } from '@/match/config';
import { Paddle } from '@/match/Paddle';
import { Arc } from '@/match/skills/Arc';
import { ShotRead } from '@/match/skills/Skill';
import { TWO_PI } from '@/shared/math';

// Arc: two streaks circling a spinning ball, the way it spins; brighter the harder it does
const SPIN_STREAKS = {
  RADIUS: 1.75, // times the ball's
  LENGTH: 1.1, // rad of each streak
  TURN: 16, // rad/s they circle at, at full spin
  ALPHA: 0.85,
} as const;

// Arc's trail: the path a spinning ball has flown, held long enough to show its curve (the
// ball's own trail is a short streak)
export const ARC_TRAIL = {
  LIFE: 0.7, // s a point of it lasts
  WIDTH: 3, // px
  ALPHA: 0.75, // where it is newest
  COLOR: '#bff4ff',
} as const;

/** A point of Arc's trail, and seconds since the ball was there. */
export interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

// Analyzer, a sonar: a ping rings out from its owner's paddle, a green grid shows wherever it
// has passed, the read flight lights up as echoes when the ping reaches them, and a contact
// stays on where the ball arrives, pinging, until it does. Machine green, unlike any other sign
const SONAR = {
  RGB: '93, 255, 154',
  PING_TIME: 0.5, // s the ping takes to cross the whole court
  REACH: Math.hypot(COURT.WIDTH, COURT.HEIGHT), // px the ping travels in that time
  GRID: 40, // px between grid lines
  GRID_ALPHA: 0.22,
  GRID_TIME: 0.8, // s the grid shows for, fading
  ECHO_GAP: 22, // px along the flight between two echoes
  ECHO_RADIUS: 2.5, // px
  ECHO_LIFE: 0.7, // s an echo glows for once the ping has found it
  CONTACT_RADIUS: 4, // px of the contact's dot
  CONTACT_RING: 22, // px a contact's ring grows to
  CONTACT_PERIOD: 0.6, // s between its pings
} as const;

// Reflex, after Cyberpunk 2077's Sandevistan: the world slows and its owner's paddle, moving at
// full speed through it, leaves a trail of afterimages in shifting colors; the screen's edges
// glow teal
export const AFTERIMAGES = {
  INTERVAL: 0.045, // s between two afterimages
  LIFE: 0.4, // s one lasts, fading
  // Outlines with a faint fill, laid over each other plainly: added up, the overlapping ones
  // would melt into white
  ALPHA: 0.9,
  FILL_ALPHA: 0.18,
  // px each drifts back toward its goal line over its life, so a paddle moving along its line
  // fans its afterimages out rather than stacking them
  DRIFT: 18,
  COLORS: ['#ff2bd6', '#19f0ff', '#d4ff3b', '#8a5cff'],
} as const;
const TIME_WARP = {
  EDGE_RGB: '0, 255, 196',
  EDGE_ALPHA: 0.22, // at the screen's corners, at full strength
  DIM_ALPHA: 0.1, // over the whole screen: the slowed world a shade darker
} as const;

/** An afterimage of a paddle (Reflex), and seconds since it was left. */
export interface Afterimage {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  age: number;
  /** Which way is back toward its goal line: -1 left, 1 right. */
  back: number;
}

/** How skills look on the court (docs/PROGRESSION.md): each has a sign the player can read. */
export class SkillRenderer {
  /** Streaks circling a spinning ball, so a curve can be told from its first frames. */
  public static renderSpin(ctx: CanvasRenderingContext2D, ball: Ball, time: number): void {
    const strength = Math.min(
      1,
      Math.abs(ball.spin) / Arc.fullSpin(ball.speed * ball.speedMultiplier),
    );
    if (strength < 0.05) return;

    const turn = time * SPIN_STREAKS.TURN * Math.sign(ball.spin);
    const radius = ball.radius * SPIN_STREAKS.RADIUS;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = SPIN_STREAKS.ALPHA * strength;
    ctx.strokeStyle = '#bff4ff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const start of [turn, turn + Math.PI]) {
      ctx.beginPath();
      ctx.arc(ball.drawX, ball.drawY, radius, start, start + SPIN_STREAKS.LENGTH);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The curve a spinning ball has flown, fading toward its oldest end. */
  public static renderArcTrail(ctx: CanvasRenderingContext2D, points: readonly TrailPoint[]): void {
    if (points.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = ARC_TRAIL.COLOR;
    ctx.lineWidth = ARC_TRAIL.WIDTH;
    ctx.lineCap = 'round';
    for (let i = 1; i < points.length; i++) {
      const life = 1 - points[i].age / ARC_TRAIL.LIFE;
      if (life <= 0) continue;
      ctx.globalAlpha = ARC_TRAIL.ALPHA * life * life;
      ctx.beginPath();
      ctx.moveTo(points[i - 1].x, points[i - 1].y);
      ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * A shot read ahead for `paddle`, as a sonar sees it: the ping ringing out, the grid it reveals,
   * the flight's echoes and the contact where the ball arrives.
   * @param isMotionReduced for a player who asked for less motion: nothing sweeps or pings, the
   *   grid and the echoes simply show and fade
   */
  public static renderShotRead(
    ctx: CanvasRenderingContext2D,
    read: ShotRead,
    paddle: Paddle,
    isMotionReduced: boolean,
  ): void {
    const { path, age } = read;
    const arrival = path.at(-1);
    if (!arrival) return;
    const originX = paddle.x + paddle.spec.width / 2;
    const originY = paddle.drawY;
    // How far the ping has got, and when it reaches a point
    const reach = isMotionReduced ? SONAR.REACH : (age / SONAR.PING_TIME) * SONAR.REACH;
    const reachedAt = (x: number, y: number) =>
      isMotionReduced ? 0 : (Math.hypot(x - originX, y - originY) / SONAR.REACH) * SONAR.PING_TIME;
    const green = (alpha: number) => `rgba(${SONAR.RGB}, ${Math.max(0, alpha)})`;

    ctx.save();
    ctx.lineWidth = 1;

    // The grid, wherever the ping has passed
    if (age < SONAR.GRID_TIME) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(originX, originY, reach, 0, TWO_PI);
      ctx.clip();
      ctx.strokeStyle = green(SONAR.GRID_ALPHA * (1 - age / SONAR.GRID_TIME));
      ctx.beginPath();
      for (let x = SONAR.GRID / 2; x < COURT.WIDTH; x += SONAR.GRID) {
        ctx.moveTo(x, COURT.TOP_WALL);
        ctx.lineTo(x, COURT.HEIGHT - COURT.BOTTOM_WALL);
      }
      for (
        let y = COURT.TOP_WALL + SONAR.GRID / 2;
        y < COURT.HEIGHT - COURT.BOTTOM_WALL;
        y += SONAR.GRID
      ) {
        ctx.moveTo(0, y);
        ctx.lineTo(COURT.WIDTH, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // The ping itself, a bright ring with a faint one behind it
    if (!isMotionReduced && age < SONAR.PING_TIME) {
      const share = age / SONAR.PING_TIME;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = green(0.9 * (1 - share));
      ctx.beginPath();
      ctx.arc(originX, originY, reach, 0, TWO_PI);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = green(0.4 * (1 - share));
      ctx.beginPath();
      ctx.arc(originX, originY, Math.max(0, reach - 30), 0, TWO_PI);
      ctx.stroke();
    }

    // The flight's echoes, each lit as the ping finds it
    let along = 0;
    for (let i = 1; i < path.length; i++) {
      along += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
      if (along < SONAR.ECHO_GAP) continue;
      along = 0;
      const since = age - reachedAt(path[i].x, path[i].y);
      if (since < 0 || since > SONAR.ECHO_LIFE) continue;
      ctx.fillStyle = green(1 - since / SONAR.ECHO_LIFE);
      ctx.beginPath();
      ctx.arc(path[i].x, path[i].y, SONAR.ECHO_RADIUS, 0, TWO_PI);
      ctx.fill();
    }

    // The contact where it arrives, once the ping has found it, pinging back until it gets there
    const found = age - reachedAt(arrival.x, arrival.y);
    if (found >= 0) {
      ctx.fillStyle = green(1);
      ctx.beginPath();
      ctx.arc(arrival.x, arrival.y, SONAR.CONTACT_RADIUS, 0, TWO_PI);
      ctx.fill();
      ctx.lineWidth = 1.5;
      const rings = isMotionReduced ? [0.5] : [(found / SONAR.CONTACT_PERIOD) % 1];
      for (const share of rings) {
        ctx.strokeStyle = green(isMotionReduced ? 0.6 : 1 - share);
        ctx.beginPath();
        const radius = SONAR.CONTACT_RADIUS + (SONAR.CONTACT_RING - SONAR.CONTACT_RADIUS) * share;
        ctx.arc(arrival.x, arrival.y, radius, 0, TWO_PI);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /**
   * The slowed world's screen, `level` in [0, 1]: a shade darker, its edges glowing teal.
   * @param edges a radial gradient from clear in the middle to EDGE_RGB at the corners
   */
  public static renderTint(
    ctx: CanvasRenderingContext2D,
    level: number,
    edges: CanvasGradient,
  ): void {
    ctx.fillStyle = `rgba(0, 12, 14, ${TIME_WARP.DIM_ALPHA * level})`;
    ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);
    ctx.globalAlpha = TIME_WARP.EDGE_ALPHA * level;
    ctx.fillStyle = edges;
    ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);
    ctx.globalAlpha = 1;
  }

  /** A gradient for `renderTint`'s glowing edges, built once per canvas. */
  public static warpEdges(ctx: CanvasRenderingContext2D): CanvasGradient {
    const edges = ctx.createRadialGradient(
      COURT.WIDTH / 2,
      COURT.HEIGHT / 2,
      COURT.HEIGHT * 0.55,
      COURT.WIDTH / 2,
      COURT.HEIGHT / 2,
      COURT.WIDTH * 0.62,
    );
    edges.addColorStop(0, `rgba(${TIME_WARP.EDGE_RGB}, 0)`);
    edges.addColorStop(1, `rgba(${TIME_WARP.EDGE_RGB}, 1)`);
    return edges;
  }

  /** A paddle's afterimages, oldest first, each fading as it ages. */
  public static renderAfterimages(
    ctx: CanvasRenderingContext2D,
    afterimages: readonly Afterimage[],
  ): void {
    ctx.save();
    ctx.lineWidth = 2;
    for (const { x, y, width, height, color, age, back } of afterimages) {
      const life = 1 - age / AFTERIMAGES.LIFE;
      if (life <= 0) continue;
      const drift = back * AFTERIMAGES.DRIFT * (1 - life);
      ctx.fillStyle = ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.roundRect(x + drift, y - height / 2, width, height, 5);
      ctx.globalAlpha = AFTERIMAGES.FILL_ALPHA * life;
      ctx.fill();
      ctx.globalAlpha = AFTERIMAGES.ALPHA * life;
      ctx.stroke();
    }
    ctx.restore();
  }
}
