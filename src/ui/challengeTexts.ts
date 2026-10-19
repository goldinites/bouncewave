import { I18nManager } from '@/i18n/I18nManager';
import { ChallengeVerdict } from '@/match/ChallengeJudge';
import { CHALLENGES } from '@/match/challenges';

/**
 * What a failed attempt fell short by: how far it got toward the goal ("RALLY: 18 OF 20"), or,
 * when it got there, what spoilt it (a point lost in a shutout, a lost match with every shot).
 */
export function describeShortfall(i18n: I18nManager, verdict: ChallengeVerdict): string {
  const { progress: n, target } = verdict;
  switch (CHALLENGES[verdict.challenge].goal.type) {
    case 'rally':
      return i18n.format('shortRally', { n, target });
    case 'powerShots':
      return n < target ? i18n.format('shortPowerShots', { n, target }) : i18n.t('shortLost');
    case 'shutout':
      return n < target ? i18n.format('shortPoints', { n, target }) : i18n.t('shortConceded');
    case 'win':
      return i18n.format('shortPoints', { n, target });
  }
}
