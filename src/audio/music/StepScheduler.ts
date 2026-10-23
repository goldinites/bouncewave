// Look-ahead scheduling: wake up often, schedule a little ahead on the precise audio clock
const INTERVAL_MS = 25;
const SCHEDULE_AHEAD = 0.15;
// If the clock fell this far behind (a hidden tab, a tape stop, a loop switched off for a
// while), restart it just ahead of now instead of catching up on every step it missed: those
// steps would all be scheduled in the past, and all sound at once
const RESYNC_THRESHOLD = 0.1;
const RESYNC_DELAY = 0.05;

export interface StepSchedulerOptions {
  /** Schedules the step at `time` and returns how long it lasts, in seconds. */
  playStep: (time: number) => number;
  /** Whether to schedule anything on this tick; the clock waits (and later resyncs) if not. */
  canRun?: () => boolean;
  /**
   * False for an offline render (`npm run render`): no timer, the renderer calls `tick` as its
   * own clock advances, faster than real time.
   */
  hasTimer?: boolean;
}

/**
 * The step sequencer's clock, shared by the music engines: a timer that wakes every 25 ms and
 * hands every step due in the next 150 ms to `playStep`, timed on the audio clock.
 */
export class StepScheduler {
  private nextStepTime: number;
  private intervalId: number | null;
  private readonly context: BaseAudioContext;
  private readonly playStep: StepSchedulerOptions['playStep'];
  private readonly canRun: () => boolean;

  /** Starts ticking at once; the first step is due `startDelay` seconds from now. */
  constructor(context: BaseAudioContext, options: StepSchedulerOptions, startDelay = 0) {
    this.context = context;
    this.playStep = options.playStep;
    this.canRun = options.canRun ?? (() => true);
    this.nextStepTime = context.currentTime + startDelay;
    this.intervalId =
      options.hasTimer === false ? null : window.setInterval(() => this.tick(), INTERVAL_MS);
  }

  /** Schedules every step that is due; the timer calls it, tests may call it directly. */
  public tick(): void {
    if (!this.canRun()) return;

    const now = this.context.currentTime;
    if (this.nextStepTime < now - RESYNC_THRESHOLD) {
      this.nextStepTime = now + RESYNC_DELAY;
    }

    while (this.nextStepTime < now + SCHEDULE_AHEAD) {
      this.nextStepTime += this.playStep(this.nextStepTime);
    }
  }

  public dispose(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
