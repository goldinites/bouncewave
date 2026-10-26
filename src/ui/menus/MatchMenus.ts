import { h } from 'preact';
import { DIFFICULTY_LEVELS } from '@/match/difficulty';
import { MenuContext } from '@/ui/menus/MenuContext';
import { ScreenEntry } from '@/ui/ScreenStack';
import { ButtonMenu } from '@/ui/screens/ButtonMenu';

/** The menus that belong to a match: its pause and its end. */
export class MatchMenus {
  constructor(private readonly ctx: MenuContext) {}

  public pause(): ScreenEntry {
    const { i18n, actions, routes } = this.ctx;
    return {
      id: 'pause',
      view: () => ({
        title: i18n.t('pause'),
        subtitle: '',
        body: h(ButtonMenu, {
          items: [
            {
              id: 'resume',
              label: i18n.t('resume'),
              onClick: () => actions.onResumeGame(),
            },
            {
              // The same match again from 0:0, set up as it was
              id: 'restart',
              label: i18n.t('restart'),
              color: 'yellow',
              onClick: () => (actions.onRestartGame ?? actions.onStartGame)(),
            },
            {
              id: 'settings',
              label: i18n.t('settings'),
              color: 'pink',
              onClick: () => routes.openSettings(),
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

  public gameOver(winnerIndex: number, scores: [number, number]): ScreenEntry {
    const { i18n, settings, actions, routes } = this.ctx;
    // Asked now: whether two played is the match's that has just ended
    const isTwoPlayers = actions.isTwoPlayerMatch?.() ?? false;
    // A quick match won: the next level up is a tap away, so a newcomer, who starts at the easiest
    // (step 4.7), sees where to go from there
    const level = settings.current.difficulty;
    const harder = DIFFICULTY_LEVELS[DIFFICULTY_LEVELS.indexOf(level) + 1];
    const offersHarder = !isTwoPlayers && winnerIndex === 0 && harder !== undefined;
    return {
      id: 'gameOver',
      view: () => ({
        // With two players the winner is named; otherwise the left side is the player
        title: isTwoPlayers
          ? i18n.t(winnerIndex === 0 ? 'player1Wins' : 'player2Wins')
          : i18n.t(winnerIndex === 0 ? 'win' : 'lose'),
        subtitle: `${scores[0]} : ${scores[1]}`,
        body: h(ButtonMenu, {
          items: [
            { id: 'again', label: i18n.t('again'), onClick: () => actions.onStartGame() },
            ...(offersHarder
              ? [
                  {
                    id: 'harder',
                    label: i18n.format('harder', {
                      level: i18n.getDifficultyInfo(harder)[0],
                    }),
                    color: 'yellow' as const,
                    onClick: () => {
                      settings.update({ difficulty: harder });
                      actions.onStartGame();
                    },
                  },
                ]
              : []),
            {
              id: 'settings',
              label: i18n.t('settings'),
              color: 'pink',
              onClick: () => routes.openSettings(),
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
