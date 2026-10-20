import { I18nManager } from '@/i18n/I18nManager';
import { TutorialCard, TutorialFeedback, TutorialProgress } from '@/match/tutorial';
import { Condition } from '@/ui/challengeTexts';

/** What the tutorial's line needs to know of where the learner is. */
export interface TutorialLine {
  readonly progress: TutorialProgress | null;
  readonly feedback: TutorialFeedback | null;
  /** A step's card is up: the line gives way to it. */
  readonly card: TutorialCard | null;
}

/**
 * The tutorial's line over the court, in the challenges' condition line's place (above the court,
 * or on it on a phone on its side), standing in for the score, which counts nothing here: the move
 * the step asks for with how far the learner is ("PERFECT HIT · 1 / 2"), its hint once they have
 * tried a few times, and for a moment after a try that didn't count, why not; the count is never
 * out of sight. Moving is told as the device moves the paddle, with keys and a mouse or a finger;
 * a charged Overdrive says the very next hit fires it. Nothing while a step's card is up.
 * @param isTouch whether the device is played by touch first
 */
export function describeTutorial(
  i18n: I18nManager,
  { progress, feedback, card }: TutorialLine,
  isTouch: boolean,
): Condition | null {
  const texts = i18n.t('tutorial');
  const line = (text: string): Condition => ({
    text,
    lives: null,
    isUrgent: false,
    replacesScore: true,
  });
  if (card) return null;
  if (!progress) return null;

  const { step, done, target, isHinted, isCharged } = progress;
  if (step === 'move') return line(isTouch ? texts.moveByTouch : texts.steps.move);
  if (isCharged) return line(texts.charged);
  const said = feedback
    ? texts.feedback[feedback]
    : isHinted
      ? texts.hints[step]
      : texts.steps[step];
  return line(`${said} · ${done} / ${target}`);
}
