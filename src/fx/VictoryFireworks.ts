import { COURT } from '@/match/config';
import { clamp, lerp } from '@/shared/math';

export const FIREWORK = {
  SHOTS: 6,
  INTERVAL: 0.22, // s between shots
} as const;

export interface FireworkShot {
  x: number;
  y: number;
  color: string;
}

interface ScheduledShot extends FireworkShot {
  time: number;
}

const EDGE_MARGIN = 40;

/**
 * Schedule of victory bursts: the first goes off right where the winning ball entered
 * the goal, the following ones walk toward center court at varying heights.
 */
export class VictoryFireworks {
  private readonly shots: ScheduledShot[];
  private elapsed = 0;
  private nextIndex = 0;

  /**
   * @param goalSide which goal the winning ball went into: -1 = left, 1 = right
   * @param goalY    vertical position where it crossed
   */
  constructor(goalSide: -1 | 1, goalY: number, colors: readonly string[], random = Math.random) {
    const goalX = goalSide === 1 ? COURT.WIDTH - EDGE_MARGIN : EDGE_MARGIN;
    const minY = COURT.TOP_WALL + EDGE_MARGIN;
    const maxY = COURT.HEIGHT - COURT.BOTTOM_WALL - EDGE_MARGIN;

    this.shots = Array.from({ length: FIREWORK.SHOTS }, (_, i) => {
      const progress = FIREWORK.SHOTS > 1 ? i / (FIREWORK.SHOTS - 1) : 0;
      const jitterX = i === 0 ? 0 : (random() - 0.5) * 80;

      return {
        time: i * FIREWORK.INTERVAL,
        x: lerp(goalX, COURT.WIDTH / 2, progress) + jitterX,
        y: i === 0 ? clamp(goalY, minY, maxY) : lerp(minY, maxY, random()),
        color: colors[i % colors.length],
      };
    });
  }

  public get isDone(): boolean {
    return this.nextIndex >= this.shots.length;
  }

  /** Advances the schedule and returns the shots that are due this frame. */
  public update(dt: number): FireworkShot[] {
    this.elapsed += dt;

    const due: FireworkShot[] = [];
    while (this.nextIndex < this.shots.length && this.shots[this.nextIndex].time <= this.elapsed) {
      const { x, y, color } = this.shots[this.nextIndex++];
      due.push({ x, y, color });
    }
    return due;
  }
}
