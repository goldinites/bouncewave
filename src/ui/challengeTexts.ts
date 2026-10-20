import { I18nManager } from '@/i18n/I18nManager';
import { ChallengeVerdict } from '@/match/ChallengeJudge';
import { ChallengeGoal, CHALLENGES } from '@/match/challenges';
import { FinaleReason } from '@/match/MatchFlow';
import { ModifierId } from '@/match/modifiers/Modifier';
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
  /** The rotation's next modifier and the points until it comes (Chaos); null for none. */
  readonly upcomingModifier: { readonly id: ModifierId; readonly inPoints: number } | null;
  /** The modifiers in play right now. */
  readonly activeModifiers: readonly ModifierId[];
}

/**
 * The condition line, whether it is urgent (the clock nearly out, a modifier about to change), and whether it takes the
 * score's place: where the score tells the player nothing the line doesn't (Survival's points and
 * lives, Shutout's) or nothing at all (Long Rally, where points don't count).
 */
export interface Condition {
  readonly text: string;
  /** The player's lives after the text, drawn as hearts: those left, of them all; null for none. */
  readonly lives: { readonly left: number; readonly total: number } | null;
  readonly isUrgent: boolean;
  readonly replacesScore: boolean;
}

/**
 * What the player needs to see of a challenge's condition while playing it, in one line: the
 * rally toward its goal, the points toward an uneven winning score with the lives left (the HUD
 * draws them as hearts), the modifier in play and the next one when they take turns (Chaos), and
 * the clock. Null when there is nothing to show (a standard match, whose score says it all).
 * @param goal the challenge's goal; null in a quick match
 */
export function describeCondition(
  i18n: I18nManager,
  match: ConditionMatch,
  goal: ChallengeGoal | null,
): Condition | null {
  const parts: string[] = [];
  let lives: Condition['lives'] = null;
  let replacesScore = goal?.type === 'rally';
  if (goal?.type === 'rally')
    parts.push(i18n.format('hudRally', { n: match.rally, target: goal.hits }));

  // An uneven match (Survival, Shutout): the player's points toward theirs, the opponent's
  // winning score as the player's lives. A single life (Shutout) says nothing the goal doesn't,
  // so it isn't drawn
  const side = match.playerSide;
  if (side !== null) {
    const opponent = otherSide(side);
    const [mine, theirs] = [match.rules.winningScores[side], match.rules.winningScores[opponent]];
    if (mine !== theirs && Number.isFinite(mine) && Number.isFinite(theirs)) {
      parts.push(i18n.format('hudPoints', { n: match.scores[side], target: mine }));
      if (theirs > 1) lives = { left: Math.max(0, theirs - match.scores[opponent]), total: theirs };
      replacesScore = true;
    }
  }

  // Modifiers taking turns: the one in play, and the next, urgent the point before it comes
  const upcoming = match.upcomingModifier;
  if (upcoming) {
    const now = match.activeModifiers.at(-1);
    if (now) parts.push(i18n.t('modifiers')[now]);
    parts.push(i18n.format('hudNextModifier', { name: i18n.t('modifiers')[upcoming.id] }));
  }

  if (match.timeLeft !== null) parts.push(clockTime(match.timeLeft));
  if (parts.length === 0) return null;
  return {
    text: parts.join(' · '),
    lives,
    isUrgent:
      (match.timeLeft !== null && match.timeLeft < CLOCK_URGENT_BELOW) || upcoming?.inPoints === 1,
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
    case 'shutout':
      return n < target ? i18n.format('shortPoints', { n, target }) : i18n.t('shortConceded');
    case 'win':
      return i18n.format('shortPoints', { n, target });
  }
}

/** The finale's sign over an attempt: what decided it, and the number that tells how it went. */
export interface FinaleSign {
  readonly label: string;
  readonly text: string;
}

/**
 * The finale's sign over an attempt, told by its verdict rather than by who won the match: a lost
 * clock reads TIME UP, not GAME OVER. The sign's number is the score, or the goal's own count
 * where the score says nothing of it (Long Rally's hits).
 */
export function describeFinale(
  i18n: I18nManager,
  verdict: ChallengeVerdict,
  finale: {
    readonly winnerIndex: Side;
    readonly reason: FinaleReason;
    readonly scores: readonly [number, number];
  },
): FinaleSign {
  const { goal, rules } = CHALLENGES[verdict.challenge];
  const count = `${verdict.progress} / ${verdict.target}`;
  const score = `${finale.scores[0]} : ${finale.scores[1]}`;
  const text = goal.type === 'rally' ? count : score;
  if (verdict.isPassed) return { label: i18n.t('win'), text };
  if (finale.reason === 'time') return { label: i18n.t('finaleTimeUp'), text };
  switch (goal.type) {
    case 'shutout':
      return { label: i18n.t('finaleConceded'), text };
    case 'rally':
    case 'win': {
      // The player is the left side: an opponent who needs fewer points took the player's lives
      const [mine, theirs] = rules.winningScores;
      return { label: i18n.t(theirs < mine ? 'finaleNoLives' : 'lose'), text };
    }
  }
}
