import { h } from 'preact';
import { TutorialCard } from '@/match/tutorial';
import { isCourtTurned, isMotionReduced } from '@/ui/device';
import { MenuContext } from '@/ui/menus/MenuContext';
import { MODE_COLORS } from '@/ui/menus/ModeMenus';
import { ScreenEntry } from '@/ui/ScreenStack';
import { ButtonMenu } from '@/ui/screens/ButtonMenu';
import { TutorialCardScreen } from '@/ui/screens/TutorialCardScreen';

/** The tutorial's screens: its offer, a step's card, its end. */
export class TutorialMenus {
  constructor(private readonly ctx: MenuContext) {}

  /**
   * The tutorial offered on PLAY to someone who hasn't gone through it: YES plays it; NO turns it
   * down for good (it stays on the PLAY menu) and goes on to the modes. Esc steps back, deciding
   * nothing.
   */
  public offer(): ScreenEntry {
    const { i18n, actions, reset, routes } = this.ctx;
    return {
      id: 'tutorialOffer',
      scene: null,
      view: () => ({
        title: i18n.t('tutorial').offerTitle,
        subtitle: i18n.t('tutorial').offerText,
        body: h(ButtonMenu, {
          items: [
            {
              id: 'yes',
              label: i18n.t('tutorial').yes,
              color: MODE_COLORS.tutorial,
              onClick: () => actions.onStartTutorial?.(),
            },
            {
              id: 'no',
              label: i18n.t('tutorial').no,
              onClick: () => {
                actions.onDeclineTutorial?.();
                reset(routes.main(), routes.play());
              },
            },
          ],
        }),
      }),
    };
  }

  /**
   * The card that opens a tutorial step, over the paused match: an example of the move, why it is
   * worth making and how; GOT IT (or Esc, as from the pause) plays it.
   */
  public card(card: TutorialCard, onOk: () => void): ScreenEntry {
    const { i18n } = this.ctx;
    return {
      id: 'tutorialCard',
      view: () => {
        const texts = i18n.t('tutorial');
        const { title, why, how } = texts.cards[card];
        return {
          title,
          subtitle: '',
          body: h(TutorialCardScreen, {
            card,
            why,
            how,
            okLabel: texts.ok,
            onOk,
            isMotionReduced: isMotionReduced(),
            isRotated: isCourtTurned(),
          }),
        };
      },
    };
  }

  /** The tutorial's end: on to a quick match, or back to the menu. */
  public done(): ScreenEntry {
    const { i18n, actions, open, routes } = this.ctx;
    return {
      id: 'tutorialDone',
      view: () => ({
        title: i18n.t('tutorial').doneTitle,
        subtitle: i18n.t('tutorial').doneText,
        body: h(ButtonMenu, {
          items: [
            {
              id: 'quick',
              label: i18n.getModeName('quick'),
              onClick: () => open(routes.quickMatchSetup()),
            },
            {
              id: 'menu',
              label: i18n.t('menu'),
              color: 'purple',
              onClick: () => actions.onReturnToMainMenu(),
            },
          ],
        }),
      }),
    };
  }
}
