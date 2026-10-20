import { I18nManager } from '@/i18n/I18nManager';
import { TutorialCard, TutorialFeedback, TutorialProgress } from '@/match/tutorial';
import { Condition } from '@/ui/challengeTexts';

/** What the tutorial's line needs to know of where the learner is. */
export interface TutorialLine {
  readonly progress: TutorialProgress | null;
  readonly isPraising: boolean;
  readonly feedback: TutorialFeedback | null;
  /** A step's card is up: the line gives way to it. */
  readonly card: TutorialCard | null;
}

/**
 * The tutorial's line over the court, in the challenges' condition line's place (above the court,
 * or on it on a phone on its side), standing in for the score, which counts nothing here. The
 * praise for a step just done; else what the step asks, or its hint once the learner has tried a
 * few times, and for a moment after each try whether it counted or why not; with how far they are
 * ("RETURN THE BALL · 1 / 2") whatever it says, so the count is never out of sight. Moving is told
 * as the device moves the paddle, with keys and a mouse or a finger; a charged Overdrive says the
 * very next return fires it.
 * @param isTouch whether the device is played by touch first
 */
export function describeTutorial(
  i18n: I18nManager,
  { progress, isPraising, feedback, card }: TutorialLine,
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
  if (isPraising) return line(texts.praise);
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
