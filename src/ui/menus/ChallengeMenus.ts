import { signal } from '@preact/signals-core';
import { h } from 'preact';
import {
  CHALLENGE_IDS,
  CHALLENGE_TIERS,
  ChallengeId,
  CHALLENGES,
  ChallengeTier,
} from '@/match/challenges';
import { ChallengeProgress, challengeState, nextChallenge } from '@/profile/ChallengeProgress';
import { describeShortfall } from '@/ui/challengeTexts';
import { ChallengeOutcome, MenuContext } from '@/ui/menus/MenuContext';
import { ScreenEntry } from '@/ui/ScreenStack';
import { ChallengeCard } from '@/ui/screens/ChallengeCard';
import { ChallengeList } from '@/ui/screens/ChallengeList';
import { ChallengeResult, ChallengeResultAction } from '@/ui/screens/ChallengeResult';

/** "4 / 18": the challenges passed, of them all. */
export const passedCount = (progress: ChallengeProgress): string =>
  `${progress.passed.length} / ${CHALLENGE_IDS.length}`;

/** The challenges' screens: their list by tier, a challenge's card, an attempt's result. */
export class ChallengeMenus {
  /** The tier the list shows: the last challenge opened keeps it on its own. */
  private readonly tier = signal<ChallengeTier>(CHALLENGE_TIERS[0]);

  constructor(private readonly ctx: MenuContext) {}

  /** The list from PLAY: on the tier of the first challenge still to pass. */
  public fromPlay(): ScreenEntry {
    this.tier.value = this.firstOpenTier();
    return this.list();
  }

  /** Every challenge in the order they open, the count of those passed under the title. */
  public showList(): void {
    const { reset, routes } = this.ctx;
    reset(routes.main(), routes.play(), this.list());
  }

  /** A challenge's card, the way back to it through the PLAY menu and the list. */
  public showCard(challenge: ChallengeId): void {
    const { reset, routes } = this.ctx;
    this.tier.value = CHALLENGES[challenge].scene;
    reset(routes.main(), routes.play(), this.list(), this.card(challenge));
  }

  /**
   * The tier the list opens on from PLAY: that of the first challenge still to pass (the first
   * tier once all are).
   */
  private firstOpenTier(): ChallengeTier {
    const progress = this.ctx.challenges.get();
    const next = CHALLENGE_IDS.find((id) => challengeState(progress, id) === 'open');
    return CHALLENGES[next ?? CHALLENGE_IDS[0]].scene;
  }

  private list(): ScreenEntry {
    const { i18n, challenges, open, back } = this.ctx;
    return {
      id: 'challenges',
      scene: null,
      view: () => {
        const progress = challenges.get();
        const tier = this.tier.value;
        const tierNames = i18n.t('challengeTiers');
        return {
          title: i18n.getModeName('challenges'),
          subtitle: `${i18n.t('challengesPassed')}: ${passedCount(progress)}`,
          body: h(ChallengeList, {
            tiers: CHALLENGE_TIERS.map((id) => {
              const ids = CHALLENGE_IDS.filter((challenge) => CHALLENGES[challenge].scene === id);
              return {
                id,
                name: tierNames[id],
                passed: ids.filter((challenge) => challengeState(progress, challenge) === 'passed')
                  .length,
                total: ids.length,
              };
            }),
            tier,
            onTier: (id) => (this.tier.value = id),
            challenges: CHALLENGE_IDS.filter((id) => CHALLENGES[id].scene === tier).map((id) => ({
              id,
              name: i18n.getChallengeInfo(id)[0],
              state: challengeState(progress, id),
            })),
            backLabel: i18n.t('back'),
            onPick: (id) => {
              this.tier.value = CHALLENGES[id].scene;
              open(this.card(id));
            },
            onBack: back,
          }),
        };
      },
    };
  }

  /**
   * A challenge's card: its name and its description (which says what sets its match apart), START
   * and BACK. A passed one is marked so, and can be played again. Its reward (money) joins it with
   * the economy (stage 10).
   */
  private card(challenge: ChallengeId): ScreenEntry {
    const { i18n, challenges, actions, back } = this.ctx;
    return {
      id: `challenge:${challenge}`,
      // The card shows the challenge on its own backdrop, its song with it
      scene: CHALLENGES[challenge].scene,
      view: () => {
        const [name, description] = i18n.getChallengeInfo(challenge);
        const isPassed = challengeState(challenges.get(), challenge) === 'passed';
        return {
          title: name,
          subtitle: description,
          body: h(ChallengeCard, {
            passedLabel: isPassed ? i18n.t('attemptPassed') : null,
            startLabel: i18n.t('start'),
            backLabel: i18n.t('back'),
            onStart: () => actions.onStartChallenge(challenge),
            onBack: back,
          }),
        };
      },
    };
  }

  /**
   * How an attempt went, in place of the game-over menu. Passed: NEXT (on to the next one's card)
   * and the list, with a flourish once every challenge is passed. Not passed: what it fell short
   * by, TRY AGAIN and the list.
   */
  public result({ verdict, isAllPassed }: ChallengeOutcome): ScreenEntry {
    const { i18n, actions } = this.ctx;
    const { challenge, isPassed } = verdict;
    const next = nextChallenge(challenge);
    // Out of the finished match, back to the menus, and on to a challenge's screen
    const leave = (show: () => void) => () => {
      actions.onReturnToMainMenu();
      show();
    };
    const toList: ChallengeResultAction = {
      id: 'list',
      label: i18n.t('toChallenges'),
      color: 'purple',
      onClick: leave(() => this.showList()),
    };
    const results: ChallengeResultAction[] = [];
    if (!isPassed) {
      results.push({
        id: 'again',
        label: i18n.t('tryAgain'),
        color: 'cyan',
        onClick: () => actions.onStartGame(),
      });
    } else if (next) {
      results.push({
        id: 'next',
        label: i18n.t('nextChallenge'),
        color: 'cyan',
        onClick: leave(() => this.showCard(next)),
      });
    }
    results.push(toList);

    let message = '';
    if (!isPassed) message = describeShortfall(i18n, verdict);
    else if (isAllPassed) message = i18n.t('attemptAllPassed');

    return {
      id: 'challengeResult',
      view: () => ({
        title: i18n.t(isPassed ? 'attemptPassed' : 'attemptFailed'),
        subtitle: i18n.getChallengeInfo(challenge)[0],
        body: h(ChallengeResult, {
          message,
          isCelebration: isPassed && isAllPassed,
          actions: results,
        }),
      }),
    };
  }
}
