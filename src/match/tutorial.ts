import { AiController, ShotThreat } from '@/match/AiController';
import { Ball } from '@/match/Ball';
import { AiSkill } from '@/match/difficulty';
import { MatchEvent } from '@/match/MatchFlow';
import { OVERDRIVE } from '@/match/Overdrive';
import { Paddle } from '@/match/Paddle';
import { PaddleController } from '@/match/PaddleController';
import { firstTo, MatchRules, STANDARD_RULES } from '@/match/rules';
import { Side } from '@/match/side';
import { EventBus } from '@/shared/EventBus';

/**
 * The tutorial's steps (step 4.8), in order, each passed by doing it: moving, returning the ball,
 * a steep return off the paddle's edge, a perfect hit off its center, and Overdrive from three
 * perfect hits in a row. Aiming a perfect hit on the move is left out: an advanced move, for
 * players to find for themselves (the controls screen names it).
 */
export const TUTORIAL_STEPS = ['move', 'hit', 'angle', 'perfect', 'overdrive'] as const;

export type TutorialStep = (typeof TUTORIAL_STEPS)[number];

/**
 * The steps that open on a card (the match paused): what the move gives and an example of it.
 * Moving and returning the ball need none: their line says the controls, and the rest is Pong.
 */
export const TUTORIAL_CARDS = ['angle', 'perfect', 'overdrive'] as const;

export type TutorialCard = (typeof TUTORIAL_CARDS)[number];

const hasCard = (step: TutorialStep): step is TutorialCard =>
  (TUTORIAL_CARDS as readonly TutorialStep[]).includes(step);

export const TUTORIAL = {
  MOVE_DISTANCE: 220, // px the paddle has to travel, either way, to pass the first step
  /** How many of each a step asks for. */
  COUNTS: { hit: 2, angle: 2, perfect: 2 },
  // A return counts as steep (the edge's step) from this angle off the flat one: an edge hit's,
  // which a flat hit nudged by the paddle's motion never reaches
  STEEP_ANGLE: 0.45, // rad, ~26°
  // Tries at a step (a return that wasn't it, a ball missed) before its hint shows
  HINT_AFTER: 3,
  // A pause between steps, nothing said: the hit that passed one doesn't count for the next,
  // and the next card comes once the ball is on its way. A step done is seen, not praised
  BETWEEN: 0.8, // s
  // Why a try didn't count stays up this long, long enough to read
  FEEDBACK: 2.5, // s
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

/**
 * Why a learner's last try didn't count, told at once so they learn what does: a flat return where
 * a steep one was asked, off the center, a charge lost to a plain hit, a ball missed. A try that
 * counted needs no word: the count goes up.
 */
export type TutorialFeedback = 'flat' | 'offCenter' | 'chargeLost' | 'missed';

/** Where the learner is: the step, how far into it, and whether its hint is due. */
export interface TutorialProgress {
  readonly step: TutorialStep;
  /**
   * Done of the step's count; for moving, a share of the distance, in [0, 1]; for Overdrive, the
   * perfect hits in a row on the meter.
   */
  readonly done: number;
  readonly target: number;
  /** The learner has tried a few times without it: the step's hint is shown. */
  readonly isHinted: boolean;
  /** Overdrive is charged: the very next return is the power shot the step asks for. */
  readonly isCharged: boolean;
}

export interface TutorialCoachDeps {
  /** The learner's paddle, the side that plays it, and its index in the match's list. */
  readonly player: () => { readonly paddle: Paddle; readonly index: number; readonly side: Side };
  /** The learner's Overdrive meter: the perfect hits in a row on it. */
  readonly overdriveStreak: () => number;
}

/**
 * Follows the learner through the steps, from the match's events and their paddle. A step with a
 * card waits for it to be read (`card`, then `acknowledge`); then the coach counts what the step
 * asks for, tells after a try that didn't count why not, and moves on once it is done,
 * with a moment between steps. It only watches: the tutorial's match plays as any other.
 */
export class TutorialCoach {
  private readonly deps: TutorialCoachDeps;
  private stepIndex = 0;
  private done = 0;
  private tries = 0;
  private travelled = 0;
  private lastY: number | null = null;
  /** Seconds left of the pause after a step is done; the next one begins after it. */
  private between = 0;
  private _feedback: TutorialFeedback | null = null;
  private feedbackFor = 0;
  /** The meter's streak as last seen: a hit empties it before its event comes, so look back. */
  private seenStreak = 0;
  /** Whether the step's card has been read (or it has none). */
  private isIntroduced = false;

  constructor(deps: TutorialCoachDeps) {
    this.deps = deps;
    this.begin(0);
  }

  /** The step being learnt, or null once every step is done. */
  public get progress(): TutorialProgress | null {
    const step = TUTORIAL_STEPS[this.stepIndex];
    if (!step) return null;
    const isHinted = this.tries >= TUTORIAL.HINT_AFTER;
    switch (step) {
      case 'move':
        return {
          step,
          done: Math.min(1, this.travelled / TUTORIAL.MOVE_DISTANCE),
          target: 1,
          isHinted: false,
          isCharged: false,
        };
      case 'overdrive': {
        const streak = Math.min(OVERDRIVE.CHARGE, this.deps.overdriveStreak());
        return {
          step,
          done: streak,
          target: OVERDRIVE.CHARGE,
          isHinted,
          isCharged: streak >= OVERDRIVE.CHARGE,
        };
      }
      default:
        return { step, done: this.done, target: TUTORIAL.COUNTS[step], isHinted, isCharged: false };
    }
  }

  /**
   * The card due now, to be shown with the match paused: the step's, once the pause after the last
   * one is over and until it is acknowledged; null otherwise.
   */
  public get card(): TutorialCard | null {
    const step = TUTORIAL_STEPS[this.stepIndex];
    return step && hasCard(step) && !this.isIntroduced && !this.isBetweenSteps ? step : null;
  }

  /** The card due has been read: the step begins. Nothing, when no card is due. */
  public acknowledge(): void {
    if (this.card) this.isIntroduced = true;
  }

  /** Whether a step has just been done, and the next not yet begun. */
  public get isBetweenSteps(): boolean {
    return this.between > 0;
  }

  /** Why the learner's last try didn't count, for a moment after it; null otherwise. */
  public get feedback(): TutorialFeedback | null {
    return this.feedbackFor > 0 ? this._feedback : null;
  }

  /** Every step is done and the pause after the last is over: the tutorial is through. */
  public get isFinished(): boolean {
    return this.stepIndex >= TUTORIAL_STEPS.length && this.between <= 0;
  }

  /**
   * Back to the first step (the tutorial started again), or to `from` (a developer's
   * ?tutorial=perfect).
   */
  public reset(from: TutorialStep = TUTORIAL_STEPS[0]): void {
    this.begin(TUTORIAL_STEPS.indexOf(from));
    this.travelled = 0;
    this.lastY = null;
    this.between = 0;
  }

  /** Call every frame of the tutorial: it watches the paddle move and counts the moments down. */
  public update(dt: number): void {
    if (this.between > 0) this.between = Math.max(0, this.between - dt);
    if (this.feedbackFor > 0) this.feedbackFor = Math.max(0, this.feedbackFor - dt);
    const { y } = this.deps.player().paddle;
    if (this.lastY !== null && this.progress?.step === 'move' && this.isPlaying) {
      this.travelled += Math.abs(y - this.lastY);
      if (this.travelled >= TUTORIAL.MOVE_DISTANCE) this.pass();
    }
    this.lastY = y;
    this.seenStreak = this.deps.overdriveStreak();
  }

  /** @returns a function that stops listening */
  public listenTo(events: EventBus<MatchEvent>): () => void {
    return events.subscribe((event) => this.handle(event));
  }

  /** Whether the step is being played: its card read, the pause before it over. */
  private get isPlaying(): boolean {
    return this.isIntroduced && !this.isBetweenSteps;
  }

  private handle(event: MatchEvent): void {
    const streakBefore = this.seenStreak;
    this.seenStreak = this.deps.overdriveStreak();
    const progress = this.progress;
    if (!progress || progress.step === 'move' || !this.isPlaying) return;
    const player = this.deps.player();
    if (event.type === 'score' && !event.isDemo && event.scoringPlayerIndex !== player.side) {
      this.fail('missed');
      return;
    }
    if (event.type !== 'paddleHit' || event.paddleIndex !== player.index) return;

    switch (progress.step) {
      case 'hit':
        return this.count();
      case 'angle':
        return event.angle >= TUTORIAL.STEEP_ANGLE ? this.count() : this.fail('flat');
      case 'perfect':
        return event.isPerfect ? this.count() : this.fail('offCenter');
      case 'overdrive':
        // The meter counts the perfect hits in a row; the hit after it is full fires it
        if (event.isPowerShot) return this.pass();
        // A perfect hit charges the meter, which the line counts: no word needed
        if (event.isPerfect) return this.quiet();
        return this.fail(streakBefore > 0 ? 'chargeLost' : 'offCenter');
    }
  }

  private count(): void {
    this.done++;
    const progress = this.progress;
    if (progress && this.done >= progress.target) this.pass();
    else this.quiet();
  }

  private fail(feedback: TutorialFeedback): void {
    this.tries++;
    this.tell(feedback);
  }

  /** A try that counted: the count says so; a verdict still up from a miss before it goes. */
  private quiet(): void {
    this.feedbackFor = 0;
  }

  private tell(feedback: TutorialFeedback): void {
    this._feedback = feedback;
    this.feedbackFor = TUTORIAL.FEEDBACK;
  }

  private pass(): void {
    this.begin(this.stepIndex + 1);
    this.between = TUTORIAL.BETWEEN;
  }

  /** Starts the step at `index`: nothing done or tried yet, its card (if any) still to read. */
  private begin(index: number): void {
    this.stepIndex = index;
    this.done = 0;
    this.tries = 0;
    this.feedbackFor = 0;
    this.seenStreak = 0;
    const step = TUTORIAL_STEPS[index];
    this.isIntroduced = !step || !hasCard(step);
  }
}
