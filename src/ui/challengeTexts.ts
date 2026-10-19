import { I18nManager } from '@/i18n/I18nManager';
import { ChallengeVerdict } from '@/match/ChallengeJudge';
import { ChallengeGoal, CHALLENGES } from '@/match/challenges';
import { MatchRules } from '@/match/rules';
import { otherSide, Scores, Side } from '@/match/side';

// The clock turns urgent for the last seconds of a match on time
const CLOCK_URGENT_BELOW = 10; // s

/** Seconds as a clock shows them, rounded up: 1:24, 0:09 (0:00 only once it has run out). */
export const clockTime = (seconds: number): string => {
  const whole = Math.ceil(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

/** The match as the HUD's condition line reads it. */
export interface ConditionMatch {
  readonly rules: MatchRules;
  readonly scores: Scores;
  readonly playerSide: Side | null;
  readonly timeLeft: number | null;
  /** Hits in the rally being played. */
  readonly rally: number;
}

/**
 * The condition line, whether it is urgent (the clock nearly out), and whether it takes the
 * score's place: where the score tells the player nothing the line doesn't (Survival's points and
 * lives, Shutout's) or nothing at all (Long Rally, where points don't count).
 */
export interface Condition {
  readonly text: string;
  readonly isUrgent: boolean;
  readonly replacesScore: boolean;
}

/**
 * What the player needs to see of a challenge's condition while playing it, in one line: the
 * rally toward its goal, the Overdrive shots, the points toward an uneven winning score with the
 * lives left as hearts, and the clock. Null when there is nothing to show (a standard match,
 * whose score says it all).
 * @param goal the challenge's goal; null in a quick match
 * @param progress the judge's count toward it (the Overdrive shots)
 */
export function describeCondition(
  i18n: I18nManager,
  match: ConditionMatch,
  goal: ChallengeGoal | null,
  progress: number | null,
): Condition | null {
  const parts: string[] = [];
  let replacesScore = goal?.type === 'rally';
  if (goal?.type === 'rally')
    parts.push(i18n.format('hudRally', { n: match.rally, target: goal.hits }));
  if (goal?.type === 'powerShots') {
    parts.push(i18n.format('hudPowerShots', { n: progress ?? 0, target: goal.count }));
  }

  // An uneven match (Survival, Shutout): the player's points toward theirs, the opponent's
  // winning score as the player's lives
  const side = match.playerSide;
  if (side !== null) {
    const opponent = otherSide(side);
    const [mine, theirs] = [match.rules.winningScores[side], match.rules.winningScores[opponent]];
    if (mine !== theirs && Number.isFinite(mine) && Number.isFinite(theirs)) {
      parts.push(i18n.format('hudPoints', { n: match.scores[side], target: mine }));
      const left = Math.max(0, theirs - match.scores[opponent]);
      parts.push('♥'.repeat(left) + '♡'.repeat(theirs - left));
      replacesScore = true;
    }
  }

  if (match.timeLeft !== null) parts.push(clockTime(match.timeLeft));
  if (parts.length === 0) return null;
  return {
    text: parts.join(' · '),
    isUrgent: match.timeLeft !== null && match.timeLeft < CLOCK_URGENT_BELOW,
    replacesScore,
  };
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
