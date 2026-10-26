import { h } from 'preact';
import { MODE_IDS, ModeId, MODES } from '@/match/modes';
import { choiceOf, QUICK_MATCH_SETUP, setupIn, TWO_PLAYER_SETUP } from '@/ui/menus/choices';
import { MenuContext } from '@/ui/menus/MenuContext';
import { ScreenEntry } from '@/ui/ScreenStack';
import { PlayMenu } from '@/ui/screens/PlayMenu';
import { QuickMatchSetup } from '@/ui/screens/QuickMatchSetup';
import { ButtonColor } from '@/ui/UIManager';

/** Each mode's button color in the PLAY menu; a new mode needs one. */
export const MODE_COLORS: Record<ModeId, ButtonColor> = {
  story: 'pink',
  challenges: 'purple',
  quick: 'cyan',
  tutorial: 'yellow',
};

/** The PLAY menu and the setups of the matches it and the main menu start. */
export class ModeMenus {
  constructor(private readonly ctx: MenuContext) {}

  /** The PLAY menu: a button per mode, those not playable yet switched off. */
  public play(): ScreenEntry {
    const { i18n, back } = this.ctx;
    return {
      id: 'play',
      scene: null,
      view: () => ({
        title: i18n.t('mode'),
        subtitle: '',
        body: h(PlayMenu, {
          modes: MODE_IDS.map((id) => ({
            id,
            name: i18n.getModeName(id),
            color: MODE_COLORS[id],
            isPlayable: MODES[id].isPlayable,
          })),
          backLabel: i18n.t('back'),
          onPick: (mode) => this.pick(mode),
          onBack: back,
        }),
      }),
    };
  }

  private pick(mode: ModeId): void {
    const { actions, open, routes } = this.ctx;
    if (mode === 'tutorial') actions.onStartTutorial?.();
    if (mode === 'quick') open(this.quickMatchSetup());
    if (mode === 'challenges') open(routes.challenges());
  }

  /**
   * The quick match's setup: backdrop, difficulty and length, as last chosen; START plays it.
   * The difficulty's description stands under the title, as it did in the settings.
   */
  public quickMatchSetup(): ScreenEntry {
    const { i18n, settings, look, actions, back } = this.ctx;
    return {
      id: 'quickMatch',
      isMatchSetup: true,
      view: () => {
        const current = settings.current;
        return {
          title: i18n.getModeName('quick'),
          subtitle: i18n.getDifficultyInfo(current.difficulty)[1],
          body: h(QuickMatchSetup, {
            options: setupIn(look.value, QUICK_MATCH_SETUP).map((entry) =>
              choiceOf(this.ctx, entry, current),
            ),
            previousLabel: i18n.t('previousChoice'),
            nextLabel: i18n.t('nextChoice'),
            startLabel: i18n.t('start'),
            backLabel: i18n.t('back'),
            onStart: () => actions.onStartQuickMatch(),
            onBack: back,
          }),
        };
      },
    };
  }

  /**
   * The setup of a match of two players on one device: backdrop and length, as last chosen; how
   * each steers stands under the title. START plays it.
   */
  public twoPlayerSetup(): ScreenEntry {
    const { i18n, settings, look, actions, back } = this.ctx;
    return {
      id: 'twoPlayers',
      isMatchSetup: true,
      view: () => {
        const current = settings.current;
        return {
          title: i18n.t('twoPlayers'),
          subtitle: i18n.t('twoPlayersHint'),
          body: h(QuickMatchSetup, {
            options: setupIn(look.value, TWO_PLAYER_SETUP()).map((entry) =>
              choiceOf(this.ctx, entry, current),
            ),
            previousLabel: i18n.t('previousChoice'),
            nextLabel: i18n.t('nextChoice'),
            startLabel: i18n.t('start'),
            backLabel: i18n.t('back'),
            onStart: () => actions.onStartTwoPlayers?.(),
            onBack: back,
          }),
        };
      },
    };
  }
}
