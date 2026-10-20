import { ChallengeGoal, ChallengeId, CHALLENGES } from '@/match/challenges';
import { MatchEvent } from '@/match/MatchFlow';
import { Side } from '@/match/side';
import { EventBus } from '@/shared/EventBus';

/** How an attempt at a challenge went: whether it passed, and how far the player got. */
export interface ChallengeVerdict {
  readonly challenge: ChallengeId;
  readonly isPassed: boolean;
  /**
   * The goal's own measure, for "18 of 20": the longest rally, the Overdrive shots, or the
   * player's points (for a goal of winning).
   */
  readonly progress: number;
  /** What `progress` had to reach: the hits, the shots, or the player's winning score. */
  readonly target: number;
}

export interface ChallengeJudgeDeps {
  /** Who plays what in the match on court: the player's paddles and side. */
  match: {
    isPlayerPaddle(index: number): boolean;
    readonly playerSide: Side | null;
    readonly rules: { readonly winningScores: readonly [number, number] };
  };
  /** Told how every finished attempt went. */
  onVerdict: (verdict: ChallengeVerdict) => void;
}

/** An attempt being played, as counted so far. */
interface Attempt {
  readonly challenge: ChallengeId;
  readonly side: Side;
  longestRally: number;
  powerShots: number;
  pointsWon: number;
  pointsLost: number;
}

/**
 * Judges challenges from the match's events alone, as `StatsRecorder` counts statistics: it
 * counts what the challenge's goal needs and, once the match is over, says whether it passed. It
 * never changes how the match goes. Like the statistics, only a finished match is an attempt:
 * one left halfway (back to the menu, or restarted) counts for nothing.
 */
export class ChallengeJudge {
  private readonly deps: ChallengeJudgeDeps;
  /** The challenge the matches started from now on are attempts at; null for none. */
  private challenge: ChallengeId | null = null;
  private attempt: Attempt | null = null;

  constructor(deps: ChallengeJudgeDeps) {
    this.deps = deps;
  }

  /** Makes the matches started from now on attempts at `challenge`; null for other matches. */
  public judge(challenge: ChallengeId | null): void {
    this.challenge = challenge;
  }

  /** How far the attempt being played has got toward its goal; null outside one. */
  public get progress(): number | null {
    return this.attempt ? this.measure(this.attempt) : null;
  }

  /**
   * How the attempt being played goes if `winner` wins its match: asked at the finale's start, it
   * is already the verdict told at its end, since nothing is counted in between. Null outside one.
   */
  public verdictFor(winner: Side): ChallengeVerdict | null {
    const attempt = this.attempt;
    if (!attempt) return null;
    return {
      challenge: attempt.challenge,
      isPassed: this.isPassed(CHALLENGES[attempt.challenge].goal, attempt, winner === attempt.side),
      progress: this.measure(attempt),
      target: this.target(attempt),
    };
  }

  /** @returns a function that stops listening */
  public listenTo(events: EventBus<MatchEvent>): () => void {
    return events.subscribe((event) => this.handle(event));
  }

  private handle(event: MatchEvent): void {
    switch (event.type) {
      case 'matchStart': {
        const side = this.deps.match.playerSide;
        this.attempt =
          this.challenge === null || side === null
            ? null
            : {
                challenge: this.challenge,
                side,
                longestRally: 0,
                powerShots: 0,
                pointsWon: 0,
                pointsLost: 0,
              };
        break;
      }
      case 'paddleHit':
        if (!this.attempt) return;
        this.attempt.longestRally = Math.max(this.attempt.longestRally, event.rally);
        if (event.isPowerShot && this.deps.match.isPlayerPaddle(event.paddleIndex)) {
          this.attempt.powerShots++;
        }
        break;
      case 'score':
        if (!this.attempt || event.isDemo) return;
        if (event.scoringPlayerIndex === this.attempt.side) this.attempt.pointsWon++;
        else this.attempt.pointsLost++;
        break;
      case 'gameOver': {
        const verdict = this.verdictFor(event.winnerIndex);
        this.attempt = null;
        if (verdict) this.deps.onVerdict(verdict);
        break;
      }
      case 'returnToMenu':
        this.attempt = null;
        break;
    }
  }

  private isPassed(goal: ChallengeGoal, attempt: Attempt, isWin: boolean): boolean {
    switch (goal.type) {
      case 'win':
        return isWin;
      case 'shutout':
        return isWin && attempt.pointsLost === 0;
      case 'rally':
        return attempt.longestRally >= goal.hits;
      case 'powerShots':
        return isWin && attempt.powerShots >= goal.count;
    }
  }

  private measure(attempt: Attempt): number {
    switch (CHALLENGES[attempt.challenge].goal.type) {
      case 'rally':
        return attempt.longestRally;
      case 'powerShots':
        return attempt.powerShots;
      case 'win':
      case 'shutout':
        return attempt.pointsWon;
    }
  }

  private target(attempt: Attempt): number {
    const goal = CHALLENGES[attempt.challenge].goal;
    switch (goal.type) {
      case 'rally':
        return goal.hits;
      case 'powerShots':
        return goal.count;
      case 'win':
      case 'shutout':
        return this.deps.match.rules.winningScores[attempt.side];
    }
  }
}
