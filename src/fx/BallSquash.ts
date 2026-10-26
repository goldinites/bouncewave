import { Squash } from '@/render/scene';

// A struck ball flattens against what struck it and springs back, overshooting into a stretch
// once: held flat through the hit-stop, then e^(−t/DECAY) · cos(2πt/PERIOD) of the squash
const SQUASH = {
  DECAY: 0.035, // s
  PERIOD: 0.13, // s
  OVER: 4, // × DECAY, after which it is round again
} as const;

/**
 * Each ball's squash off its last hit or bounce, by its place in the match's list of balls.
 * Presentation only: the ball itself stays round to the simulation.
 */
export class BallSquash {
  private readonly hits: ({
    axis: 'x' | 'y';
    strength: number;
    age: number;
  } | null)[] = [];
  private readonly _squash: (Squash | null)[] = [];

  /** Each ball's squash, by its place in the list of balls; null for a round one. */
  public get squash(): readonly (Squash | null)[] {
    return this._squash;
  }

  /**
   * Ball `index` was struck along `axis` ('x' off a paddle, 'y' off a wall).
   * @param strength how flat it goes, in [0, 1]
   * @param hold s it stays flat first (the hit-stop)
   */
  public onHit(index: number, axis: 'x' | 'y', strength: number, hold = 0): void {
    this.hits[index] = { axis, strength, age: -hold };
  }

  public update(dt: number): void {
    this.hits.forEach((hit, i) => {
      if (!hit) return;
      hit.age += dt;
      if (hit.age > SQUASH.DECAY * SQUASH.OVER) {
        this.hits[i] = null;
        this._squash[i] = null;
        return;
      }
      const t = Math.max(0, hit.age);
      const amount =
        hit.strength * Math.exp(-t / SQUASH.DECAY) * Math.cos((2 * Math.PI * t) / SQUASH.PERIOD);
      this._squash[i] = { axis: hit.axis, amount };
    });
  }

  public reset(): void {
    this.hits.length = 0;
    this._squash.length = 0;
  }
}
