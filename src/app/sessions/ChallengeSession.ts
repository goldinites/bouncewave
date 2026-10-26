import { Session, SessionContext } from '@/app/sessions/Session';
import { ChallengeId, CHALLENGES } from '@/match/challenges';
import { describeCondition } from '@/ui/challengeTexts';

/**
 * Attempts at a challenge, set up in advance: its own rules, paddles, level and backdrop. Its
 * verdict, not the statistics, is what counts.
 */
export class ChallengeSession implements Session {
  public readonly place = null;
  public readonly isTwoPlayers = false;
  public readonly isCounted = false;
  public readonly isReplayed = true;
  public readonly perfectZoneMark = null;

  constructor(
    private readonly context: SessionContext,
    public readonly challenge: ChallengeId,
  ) {}

  public get scene() {
    return CHALLENGES[this.challenge].scene;
  }

  public start(): void {
    const { flow, forLook, skillsOf } = this.context;
    const { rules, paddles, difficulty } = CHALLENGES[this.challenge];
    flow.startMatch(
      forLook(rules),
      flow.playerVsCpu(paddles, skillsOf('player'), skillsOf('cpu')),
      difficulty,
    );
  }

  /** Its goal and how far the attempt has got. */
  public condition() {
    return describeCondition(this.context.i18n, this.context.flow, CHALLENGES[this.challenge].goal);
  }

  public update(): void {}

  public onResume(): void {}
}
