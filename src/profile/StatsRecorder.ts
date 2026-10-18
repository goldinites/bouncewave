import { DifficultyLevel } from '@/match/difficulty';
import { MatchEvent } from '@/match/MatchFlow';
import { Side } from '@/match/side';
import { ProfileStore } from '@/profile/ProfileStore';
import { MatchRecord, recordMatch } from '@/profile/Statistics';
import { EventBus } from '@/shared/EventBus';

export interface StatsRecorderDeps {
  profile: ProfileStore;
  /** Who plays what in the match on court: the player's paddles and side. */
  match: {
    isPlayerPaddle(index: number): boolean;
    readonly playerSide: Side | null;
  };
  /** The CPU's difficulty in the match starting. */
  getDifficulty: () => DifficultyLevel;
}

/**
 * Counts the player's matches into the profile's statistics, from the match's events alone. A
 * match is tallied as it goes and saved only once it is over: one left halfway (back to the
 * menu, or restarted) counts for nothing.
 */
export class StatsRecorder {
  private readonly deps: StatsRecorderDeps;
  /** The match being played, as counted so far; null outside one (the demo, the menus). */
  private current: (MatchRecord & { side: Side }) | null = null;

  constructor(deps: StatsRecorderDeps) {
    this.deps = deps;
  }

  /** @returns a function that stops listening */
  public listenTo(events: EventBus<MatchEvent>): () => void {
    return events.subscribe((event) => this.handle(event));
  }

  private handle(event: MatchEvent): void {
    switch (event.type) {
      case 'matchStart': {
        const side = this.deps.match.playerSide;
        this.current =
          side === null
            ? null
            : {
                side,
                difficulty: this.deps.getDifficulty(),
                isWin: false,
                longestRally: 0,
                perfectHits: 0,
                powerShots: 0,
              };
        break;
      }
      case 'paddleHit':
        if (!this.current) return;
        this.current.longestRally = Math.max(this.current.longestRally, event.rally);
        if (this.deps.match.isPlayerPaddle(event.paddleIndex)) {
          if (event.isPerfect) this.current.perfectHits++;
          if (event.isPowerShot) this.current.powerShots++;
        }
        break;
      case 'gameOver': {
        if (!this.current) return;
        const { side, ...match } = this.current;
        this.current = null;
        const { profile } = this.deps;
        profile.update({
          stats: recordMatch(profile.current.stats, {
            ...match,
            isWin: event.winnerIndex === side,
          }),
        });
        break;
      }
      case 'returnToMenu':
        this.current = null;
        break;
    }
  }
}
