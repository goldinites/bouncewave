import { I18nManager } from '@/i18n/I18nManager';
import { ChallengeVerdict } from '@/match/ChallengeJudge';
import { ChallengeId, CHALLENGES } from '@/match/challenges';
import { STANDARD_PADDLE } from '@/match/PaddleSpec';

/** Seconds as a clock shows them: 2:00, 0:45. */
export const clockTime = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/**
 * A challenge's match in one line, from its data: "first to 5 · 2:00 on the clock · NORMAL".
 * Only what sets it apart from a standard match is named, its level always.
 */
export function describeMatch(i18n: I18nManager, id: ChallengeId): string {
  const { rules, difficulty, paddles } = CHALLENGES[id];
  const [player, cpu] = rules.winningScores;
  const parts: string[] = [];
  // Equal and finite: a match to that score. Survival's are not: the CPU's are the player's lives,
  // and the goal already says how many points to score
  if (player === cpu && Number.isFinite(player)) {
    parts.push(i18n.format('ruleFirstTo', { n: player }));
  } else if (Number.isFinite(cpu)) {
    parts.push(i18n.format('ruleLives', { n: cpu }));
  }
  if (rules.timeLimit !== null) {
    parts.push(i18n.format('ruleTime', { time: clockTime(rules.timeLimit) }));
  }
  if (rules.balls > 1) parts.push(i18n.format('ruleBalls', { n: rules.balls }));
  if (paddles[1].height !== STANDARD_PADDLE.height) {
    const ratio = Math.round((paddles[1].height / STANDARD_PADDLE.height) * 10) / 10;
    parts.push(i18n.format('ruleCpuPaddle', { n: ratio }));
  }
  if (rules.cpuRamp) parts.push(i18n.t('ruleRamp'));
  parts.push(i18n.getDifficultyInfo(difficulty)[0]);
  return parts.join(' · ');
}

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
