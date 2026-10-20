import { I18nManager } from '@/i18n/I18nManager';
import { TutorialProgress } from '@/match/tutorial';
import { Condition } from '@/ui/challengeTexts';

/** What the tutorial's line needs to know of where the learner is. */
export interface TutorialLine {
  readonly progress: TutorialProgress | null;
  readonly isPraising: boolean;
}

/**
 * The tutorial's line over the court, in the challenges' condition line's place (above the court,
 * or on it on a phone on its side): the praise for a step just done, else what the step asks
 * with how far the learner is ("RETURN THE BALL · 1 / 2"), or its hint once they have tried a few
 * times. Moving is told as the device moves the paddle: with keys, or a finger. It stands in for
 * the score, which counts nothing here.
 * @param isTouch whether the device is played by touch first
 */
export function describeTutorial(
  i18n: I18nManager,
  { progress, isPraising }: TutorialLine,
  isTouch: boolean,
): Condition | null {
  const texts = i18n.t('tutorial');
  const line = (text: string): Condition => ({
    text,
    lives: null,
    isUrgent: false,
    replacesScore: true,
  });
  if (isPraising) return line(texts.praise);
  if (!progress) return null;

  const { step, done, target, isHinted } = progress;
  if (step === 'move') return line(isTouch ? texts.moveByTouch : texts.steps.move);
  if (isHinted) return line(texts.hints[step]);
  return line(target > 1 ? `${texts.steps[step]} · ${done} / ${target}` : texts.steps[step]);
}
