import { Ball } from '@/match/Ball';
import { Paddle } from '@/match/Paddle';
import { ShotRead } from '@/match/skills/Skill';
import { COURT } from '@/match/config';
import { Arc } from '@/match/skills/Arc';
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

// Analyzer: a scan line sweeps the court from its owner, the read flight shows as a dashed
// wireframe, then a sight stays on where the ball arrives. Machine green, unlike any other sign
const SHOT_READ = {
  COLOR: '#5dff9a',
  SCAN_TIME: 0.25, // s the scan line takes across the court
  SCAN_WIDTH: 3, // px
  FRAME_TIME: 0.35, // s the wireframe shows for, fading out over its last third
  FRAME_DASH: [6, 6],
  FRAME_ALPHA: 0.8,
  SIGHT_RADIUS: 13, // px
  SIGHT_TICK: 6, // px of each tick outside the ring
  SIGHT_PULSE: 9, // rad/s
} as const;

// Reflex: the slowed world turns blue and its balls split into red and cyan ghosts
const TIME_WARP = {
  TINT: '40, 110, 255',
  TINT_ALPHA: 0.2, // at full strength
  GHOST_OFFSET: 4, // px either side of the ball
  GHOST_ALPHA: 0.45,
} as const;

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
   * A shot read ahead for `paddle`: the scan line sweeping away from it, the wireframe of the
   * flight, and the sight on the arrival.
   * @param isMotionReduced no sweeping line for a player who asked for less motion
   */
  public static renderShotRead(
    ctx: CanvasRenderingContext2D,
    read: ShotRead,
    paddle: Paddle,
    time: number,
    isMotionReduced: boolean,
  ): void {
    const { path, age } = read;
    const arrival = path.at(-1);
    if (!arrival) return;
    ctx.save();
    ctx.strokeStyle = SHOT_READ.COLOR;
    ctx.lineCap = 'round';

    if (age < SHOT_READ.SCAN_TIME && !isMotionReduced) {
      const share = age / SHOT_READ.SCAN_TIME;
      const fromX = paddle.x + paddle.spec.width / 2;
      const toX = paddle.side === 0 ? COURT.WIDTH : 0;
      const x = fromX + (toX - fromX) * share;
      ctx.globalAlpha = 0.9 * (1 - share);
      ctx.lineWidth = SHOT_READ.SCAN_WIDTH;
      ctx.beginPath();
      ctx.moveTo(x, COURT.TOP_WALL);
      ctx.lineTo(x, COURT.HEIGHT - COURT.BOTTOM_WALL);
      ctx.stroke();
    }

    if (age < SHOT_READ.FRAME_TIME) {
      const fadeFrom = (SHOT_READ.FRAME_TIME * 2) / 3;
      const fade = age < fadeFrom ? 1 : 1 - (age - fadeFrom) / (SHOT_READ.FRAME_TIME - fadeFrom);
      ctx.globalAlpha = SHOT_READ.FRAME_ALPHA * fade;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(SHOT_READ.FRAME_DASH);
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // The sight: a ring with four ticks, breathing a little
    const radius = SHOT_READ.SIGHT_RADIUS * (1 + 0.08 * Math.sin(time * SHOT_READ.SIGHT_PULSE));
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(arrival.x, arrival.y, radius, 0, TWO_PI);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      ctx.moveTo(arrival.x + dx * (radius - 3), arrival.y + dy * (radius - 3));
      ctx.lineTo(
        arrival.x + dx * (radius + SHOT_READ.SIGHT_TICK),
        arrival.y + dy * (radius + SHOT_READ.SIGHT_TICK),
      );
    }
    ctx.stroke();
    ctx.restore();
  }

  /** A blue cast over everything while the world is slowed, `level` in [0, 1]. */
  public static renderTint(ctx: CanvasRenderingContext2D, level: number): void {
    ctx.fillStyle = `rgba(${TIME_WARP.TINT}, ${TIME_WARP.TINT_ALPHA * level})`;
    ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);
  }

  /** A slowed ball's chromatic ghosts, drawn under it. */
  public static renderGhosts(ctx: CanvasRenderingContext2D, ball: Ball, level: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = TIME_WARP.GHOST_ALPHA * level;
    for (const [dx, color] of [
      [-TIME_WARP.GHOST_OFFSET, '#ff3355'],
      [TIME_WARP.GHOST_OFFSET, '#33e0ff'],
    ] as const) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ball.drawX + dx, ball.drawY, ball.radius, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();
  }
}
