import { Session, SessionContext } from '@/app/sessions/Session';
import { DifficultyLevel } from '@/match/difficulty';
import { HumanController } from '@/match/PaddleController';
import {
  TrainerController,
  TUTORIAL_RULES,
  TutorialCoach,
  TutorialStep,
  tutorialMechanics,
} from '@/match/tutorial';
import { isTouchFirst } from '@/ui/device';
import { describeTutorial } from '@/ui/tutorialTexts';

/** What the tutorial needs beyond the match: its coach, and the screens it opens. */
export interface TutorialDeps {
  /** Follows the learner through the steps; it lives as long as the game, listening to its match. */
  readonly coach: TutorialCoach;
  /** The step it starts at: the first, or a developer's (?tutorial=). */
  readonly firstStep: TutorialStep;
  /** A step that opens on a card: shows it over the match, paused behind it. */
  showCard(): void;
  /** Every step done: the tutorial is through for good, and its end screen comes up. */
  finish(): void;
}

/**
 * The tutorial (4.8): the learner, on the left as the player always is, against the trainer on
 * the Range, step by step. It counts for nothing in the record and has music of its own.
 */
export class TutorialSession implements Session {
  public readonly scene = 'range';
  public readonly place = 'tutorial';
  public readonly isTwoPlayers = false;
  public readonly challenge = null;
  public readonly isCounted = false;
  public readonly isReplayed = false;
  /** The step whose moves the learner's paddle has (tutorialMechanics), to give the next ones. */
  private mechanicsStep: TutorialStep;

  constructor(
    private readonly context: SessionContext,
    private readonly deps: TutorialDeps,
  ) {
    this.mechanicsStep = deps.firstStep;
  }

  /** The learner's paddle, while a step is about perfect hits. */
  public get perfectZoneMark(): number | null {
    const { coach } = this.deps;
    if (coach.isBetweenSteps) return null;
    const step = coach.progress?.step;
    return step === 'perfect' || step === 'overdrive' ? 0 : null;
  }

  public start(): void {
    const { coach, firstStep } = this.deps;
    coach.reset(firstStep);
    // Perfect hits and Overdrive come in with the steps that teach them
    this.mechanicsStep = firstStep;
    this.context.flow.startMatch(
      TUTORIAL_RULES,
      [
        {
          controller: new HumanController(this.context.input),
          ...tutorialMechanics(firstStep),
        },
        { controller: new TrainerController(Math.random), overdrive: false },
      ],
      DifficultyLevel.EASY,
    );
  }

  /** The step being played, in the strip above the court (or on it). */
  public condition() {
    return describeTutorial(this.context.i18n, this.deps.coach, isTouchFirst());
  }

  public update(dt: number): void {
    const { coach } = this.deps;
    coach.update(dt);
    // A new step: the learner's paddle gets the moves it teaches
    const step = coach.progress?.step;
    if (step && step !== this.mechanicsStep) {
      this.mechanicsStep = step;
      this.context.flow.setMechanics(0, tutorialMechanics(step));
    }
    if (coach.isFinished) this.deps.finish();
    else this.deps.showCard();
  }

  /** A step's card is read once the match resumes from it. */
  public onResume(): void {
    this.deps.coach.acknowledge();
  }
}
