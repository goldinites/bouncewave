/**
 * Simulation steps per second. Every step is the same length whatever the display's refresh
 * rate, so a match plays out the same at 60, 120 or 144 Hz and can be replayed from its seed and
 * inputs; 240 keeps a step short enough that drawing between two of them is never visibly late.
 */
export const SIMULATION_RATE = 240;

// Frame times add up in floating point, so a whole step's worth may come out a hair short;
// within this many seconds it still counts, or a 60 Hz display would see 3 steps then 5 instead
// of 4 every frame
const STEP_TOLERANCE = 1e-9;

// Most steps a single frame may run. The game loop already caps a frame's time well below this
// (MAX_FRAME_DT), so it is only a guard against a stall turning into a spiral of catch-up steps
const MAX_STEPS_PER_FRAME = 12;

/**
 * Turns frame times of any length into whole simulation steps of one fixed length, carrying
 * the remainder over to the next frame. The share of a step left over (`alpha`) says how far
 * between the last two steps the frame falls, for drawing moving things there.
 */
export class FixedStep {
  public readonly step: number;
  /** Time not yet simulated: always less than a step, after `advance`. */
  private pending = 0;

  constructor(stepsPerSecond: number = SIMULATION_RATE) {
    this.step = 1 / stepsPerSecond;
  }

  /**
   * Adds `dt` seconds and runs `simulate` once for every whole step that is now due.
   * @returns how many steps ran
   */
  public advance(dt: number, simulate: (step: number) => void): number {
    this.pending += dt;

    let steps = 0;
    while (this.pending >= this.step - STEP_TOLERANCE && steps < MAX_STEPS_PER_FRAME) {
      simulate(this.step);
      this.pending -= this.step;
      steps++;
    }

    // Too far behind to catch up: drop the backlog rather than slow every frame after this one
    if (steps === MAX_STEPS_PER_FRAME) this.pending = Math.min(this.pending, this.step);
    return steps;
  }

  /** How far into the next step the frame falls, in [0, 1). */
  public get alpha(): number {
    return Math.min(Math.max(this.pending / this.step, 0), 1);
  }

  /** How far behind the newest step the state drawn between two steps is, in seconds. */
  public get lag(): number {
    return (1 - this.alpha) * this.step;
  }
}
