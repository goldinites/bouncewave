import { Session, SessionContext } from '@/app/sessions/Session';
import { DifficultyLevel } from '@/match/difficulty';
import { describeCondition } from '@/ui/challengeTexts';

// The level a match of two players is played at: no CPU, so it only sets the ball's pace, the
// default level's (Medium)
const TWO_PLAYER_PACE = DifficultyLevel.NORMAL;

/**
 * Two people at one device, set up as they last chose. Their record isn't the player's: it
 * stays out of the statistics.
 */
export class TwoPlayerSession implements Session {
  public readonly scene = null;
  public readonly place = null;
  public readonly isTwoPlayers = true;
  public readonly challenge = null;
  public readonly isCounted = false;
  public readonly isReplayed = true;
  public readonly perfectZoneMark = null;

  constructor(private readonly context: SessionContext) {}

  public start(): void {
    const { flow, input, quickRules } = this.context;
    flow.startMatch(quickRules(), flow.twoPlayers(input.players), TWO_PLAYER_PACE);
  }

  public condition() {
    return describeCondition(this.context.i18n, this.context.flow, null);
  }

  public update(): void {}

  public onResume(): void {}
}
