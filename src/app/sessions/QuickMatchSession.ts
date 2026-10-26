import { Session, SessionContext } from '@/app/sessions/Session';
import { describeCondition } from '@/ui/challengeTexts';

/** A quick match against the CPU, set up as the player last chose (the settings keep it). */
export class QuickMatchSession implements Session {
  public readonly scene = null;
  public readonly place = null;
  public readonly isTwoPlayers = false;
  public readonly challenge = null;
  public readonly isCounted = true;
  public readonly isReplayed = true;
  public readonly perfectZoneMark = null;

  constructor(private readonly context: SessionContext) {}

  public start(): void {
    const { flow, quickRules, skillsOf } = this.context;
    flow.startMatch(quickRules(), flow.playerVsCpu(undefined, skillsOf('player'), skillsOf('cpu')));
  }

  /** Only what its rules bring: a modifier a developer pinned. */
  public condition() {
    return describeCondition(this.context.i18n, this.context.flow, null);
  }

  public update(): void {}

  public onResume(): void {}
}
