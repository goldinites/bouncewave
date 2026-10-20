import { AiController, ShotThreat } from '@/match/AiController';
import { Ball } from '@/match/Ball';
import { AiSkill } from '@/match/difficulty';
import { MatchEvent } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';
import { PaddleController } from '@/match/PaddleController';
import { firstTo, MatchRules, STANDARD_RULES } from '@/match/rules';
import { Side } from '@/match/side';
import { EventBus } from '@/shared/EventBus';

/**
 * The tutorial's steps (step 4.8), in order: each taught by doing it, never by reading. Moving,
 * returning the ball, a perfect hit off the paddle's center, steering the return by moving the
 * paddle as it strikes, and Overdrive from three perfect hits in a row.
 */
export const TUTORIAL_STEPS = ['move', 'hit', 'perfect', 'steer', 'overdrive'] as const;

export type TutorialStep = (typeof TUTORIAL_STEPS)[number];

export const TUTORIAL = {
  MOVE_DISTANCE: 220, // px the paddle has to travel, either way, to pass the first step
  /** How many of each a step asks for. */
  COUNTS: { hit: 2, perfect: 2, steer: 2, overdrive: 1 },
  // A return counts as steered when the paddle met the ball moving at least this fast: enough
  // to turn it visibly off the line it would take
  STEER_SPEED: 180, // px/s
  // Tries at a step (a return that wasn't it, a ball missed) before its hint shows
  HINT_AFTER: 3,
  PRAISE: 1.2, // s the praise shows between steps
} as const;

/**
 * The tutorial's match: points don't end it, the steps do. A slow ball that barely speeds up, no
 * Overdrive for the trainer, nothing pressing on a long rally: nothing to learn but the controls.
 */
export const TUTORIAL_RULES: MatchRules = {
  ...STANDARD_RULES,
  winningScores: firstTo(Infinity),
  rallyPressure: false,
  pace: { acceleration: 0.02, maxSpeed: 480 },
};

/**
 * The trainer on the other side: it returns everything, flat, from where it meets the ball, so a
 * learner gets the ball back along a line they can read. Just quick enough to reach every ball.
 */
export const TRAINER_SKILL: AiSkill = {
  speed: 700,
  reaction: 0.05,
  error: 0,
  errorPerBounce: 0,
  angleShots: 0,
  nerves: 0,
  perfectAim: 0,
  curveRead: 0,
  overdrive: false,
  fatigue: 0,
};

/** The tutorial's trainer: the AI at TRAINER_SKILL, as steady as a wall. */
export class TrainerController implements PaddleController {
  private readonly ai: AiController;

  constructor(random: () => number) {
    this.ai = new AiController(random);
  }

  public steer(paddle: Paddle, ball: Ball, opponent: Paddle, dt: number): void {
    this.ai.update(paddle, ball, TRAINER_SKILL, dt, opponent);
  }

  public topSpeed(paddle: Paddle): number {
    return TRAINER_SKILL.speed * paddle.spec.speed;
  }

  public onServe(): void {}

  public onIncomingShot(paddle: Paddle, threat: ShotThreat, ball: Ball): void {
    this.ai.readShot(paddle, TRAINER_SKILL, threat, ball);
  }

  public onPoint(): void {}

  public reset(): void {
    this.ai.reset();
  }
}

/** Where the learner is: the step, how far into it, and whether its hint is due. */
export interface TutorialProgress {
  readonly step: TutorialStep;
  /** Done of the step's count; for moving, a share of the distance, in [0, 1]. */
  readonly done: number;
  readonly target: number;
  /** The learner has tried a few times without it: the step's hint is shown. */
  readonly isHinted: boolean;
}

export interface TutorialCoachDeps {
  /** The learner's paddle, the side that plays it, and its index in the match's list. */
  readonly player: () => { readonly paddle: Paddle; readonly index: number; readonly side: Side };
}

/**
 * Follows the learner through the steps, from the match's events and their paddle: it says which
 * step they are at, counts what it asks for, and moves on once it is done, with a moment of praise
 * between steps. It only watches: the tutorial's match plays as any other.
 */
export class TutorialCoach {
  private readonly deps: TutorialCoachDeps;
  private stepIndex = 0;
  private done = 0;
  private tries = 0;
  private travelled = 0;
  private lastY: number | null = null;
  /** Seconds of praise left after a step is done; the next one is told after it. */
  private _praise = 0;

  constructor(deps: TutorialCoachDeps) {
    this.deps = deps;
  }

  /** The step being learnt, or null once every step is done. */
  public get progress(): TutorialProgress | null {
    const step = TUTORIAL_STEPS[this.stepIndex];
    if (!step) return null;
    return step === 'move'
      ? {
          step,
          done: Math.min(1, this.travelled / TUTORIAL.MOVE_DISTANCE),
          target: 1,
          isHinted: false,
        }
      : {
          step,
          done: this.done,
          target: TUTORIAL.COUNTS[step],
          isHinted: this.tries >= TUTORIAL.HINT_AFTER,
        };
  }

  /** Whether a step has just been done and is being praised. */
  public get isPraising(): boolean {
    return this._praise > 0;
  }

  /** Every step is done and the last praise is over: the tutorial is through. */
  public get isFinished(): boolean {
    return this.stepIndex >= TUTORIAL_STEPS.length && this._praise <= 0;
  }

  /**
   * Back to the first step (the tutorial started again), or to `from` (a developer's
   * ?tutorial=perfect).
   */
  public reset(from: TutorialStep = TUTORIAL_STEPS[0]): void {
    this.stepIndex = TUTORIAL_STEPS.indexOf(from);
    this.done = 0;
    this.tries = 0;
    this.travelled = 0;
    this.lastY = null;
    this._praise = 0;
  }

  /** Call every frame of the tutorial: it watches the paddle move and counts the praise down. */
  public update(dt: number): void {
    if (this._praise > 0) this._praise = Math.max(0, this._praise - dt);
    const { y } = this.deps.player().paddle;
    if (this.lastY !== null && this.progress?.step === 'move' && !this.isPraising) {
      this.travelled += Math.abs(y - this.lastY);
      if (this.travelled >= TUTORIAL.MOVE_DISTANCE) this.pass();
    }
    this.lastY = y;
  }

  /** @returns a function that stops listening */
  public listenTo(events: EventBus<MatchEvent>): () => void {
    return events.subscribe((event) => this.handle(event));
  }

  private handle(event: MatchEvent): void {
    const progress = this.progress;
    if (!progress || this.isPraising) return;
    const player = this.deps.player();
    if (event.type === 'score' && !event.isDemo && event.scoringPlayerIndex !== player.side) {
      this.tries++;
      return;
    }
    if (event.type !== 'paddleHit' || event.paddleIndex !== player.index) return;

    const counts = (() => {
      switch (progress.step) {
        case 'move':
          return false;
        case 'hit':
          return true;
        case 'perfect':
          return event.isPerfect;
        case 'steer':
          return Math.abs(player.paddle.velocity) >= TUTORIAL.STEER_SPEED;
        case 'overdrive':
          return event.isPowerShot;
      }
    })();
    // A perfect hit on the way to Overdrive is a step toward it, not a miss
    if (progress.step === 'overdrive' && !counts && event.isPerfect) return;
    if (!counts) {
      if (progress.step !== 'move') this.tries++;
      return;
    }
    this.done++;
    if (this.done >= progress.target) this.pass();
  }

  private pass(): void {
    this.stepIndex++;
    this.done = 0;
    this.tries = 0;
    this._praise = TUTORIAL.PRAISE;
  }
}
