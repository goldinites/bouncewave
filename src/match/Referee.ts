import { isDecidingPoint, MatchRules, STANDARD_RULES } from '@/match/rules';
import { otherSide, Scores, Side } from '@/match/side';

/** What decided a match: a side's winning score, the clock running out, or the rally goal. */
export type FinaleReason = 'points' | 'time' | 'rally';

/** The match is over: who won it, and why. */
export interface Decision {
  readonly winner: Side;
  readonly reason: FinaleReason;
}

/**
 * Keeps the score of a match and says when it is over, as its rules have it: on points, when the
 * clock runs out, or when a rally reaches its goal. It decides; `MatchFlow` plays the decision
 * out (the finale, the next serve). Whatever changes how a match is won mid-way (a story fight's
 * script, stage 9) changes it here.
 */
export class Referee {
  private _rules: MatchRules = STANDARD_RULES;
  /** Points each side has won in the match being played (or just finished). */
  private readonly _scores: [number, number] = [0, 0];
  /** Seconds left on the match clock; null without one, or in the demo. */
  private _timeLeft: number | null = null;

  /** The rules of the match being played (or last played). */
  public get rules(): MatchRules {
    return this._rules;
  }

  public get scores(): Scores {
    return [this._scores[0], this._scores[1]];
  }

  /** Points played so far, both sides'. */
  public get played(): number {
    return this._scores[0] + this._scores[1];
  }

  /** Seconds left on the match clock; null when the match has none (and in the demo). */
  public get timeLeft(): number | null {
    return this._timeLeft;
  }

  /** Both sides are one point from winning under the match's rules. */
  public get isDecidingPoint(): boolean {
    return isDecidingPoint(this._scores, this._rules);
  }

  /** A match under `rules` starts: its clock set, its score left to `resetScores`. */
  public start(rules: MatchRules): void {
    this._rules = rules;
    this._timeLeft = rules.timeLimit;
  }

  /** No match: the demo has no clock. */
  public stop(): void {
    this._timeLeft = null;
  }

  public resetScores(): void {
    this._scores.fill(0);
  }

  /** `scorer` won a point: the match is theirs if it reached their winning score. */
  public point(scorer: Side): Decision | null {
    this._scores[scorer]++;
    return this._scores[scorer] >= this._rules.winningScores[scorer]
      ? { winner: scorer, reason: 'points' }
      : null;
  }

  /**
   * `dt` seconds of play went by. When the clock runs out the match ends where it stands,
   * mid-rally or not: as the rules say, the side ahead wins (on a level score the player loses),
   * or the player's opponent does whatever the score. With no player, the right side stands for
   * the opponent.
   * @param playerSide the side a person plays; null when no one does
   */
  public tick(dt: number, playerSide: Side | null): Decision | null {
    if (this._timeLeft === null) return null;
    this._timeLeft = Math.max(0, this._timeLeft - dt);
    if (this._timeLeft > 0) return null;
    const [left, right] = this._scores;
    const opponent = otherSide(playerSide ?? 0);
    const winner: Side =
      this._rules.timeUp === 'opponent' || left === right ? opponent : left > right ? 0 : 1;
    return { winner, reason: 'time' };
  }

  /**
   * A hit made the rally `rally` hits long: long enough, it wins the match for the player (the
   * left side when no one plays).
   */
  public hit(rally: number, playerSide: Side | null): Decision | null {
    const { rallyGoal } = this._rules;
    return rallyGoal !== null && rally >= rallyGoal
      ? { winner: playerSide ?? 0, reason: 'rally' }
      : null;
  }
}
