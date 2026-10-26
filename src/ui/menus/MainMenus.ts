import { h } from 'preact';
import { I18nManager } from '@/i18n/I18nManager';
import { DIFFICULTY_LEVELS } from '@/match/difficulty';
import { passedCount } from '@/ui/menus/ChallengeMenus';
import { MenuContext } from '@/ui/menus/MenuContext';
import { ScreenEntry } from '@/ui/ScreenStack';
import { ButtonMenu } from '@/ui/screens/ButtonMenu';
import { StatsScreen } from '@/ui/screens/StatsScreen';

/** The main menu and what it opens of its own: the statistics. */
export class MainMenus {
  constructor(private readonly ctx: MenuContext) {}

  /** Whether the classic look is on: it has no PLAY menu, only a quick match and two players'. */
  public get isClassic(): boolean {
    return this.ctx.look.value === 'classic';
  }

  public main(): ScreenEntry {
    const { ui, i18n, look, open, routes } = this.ctx;
    return {
      id: 'main',
      scene: null,
      view: () => ({
        title: ui.gameTitle,
        subtitle: '',
        body: h(ButtonMenu, {
          items: [
            look.value === 'classic'
              ? {
                  id: 'quick',
                  label: i18n.getModeName('quick'),
                  onClick: () => open(routes.quickMatchSetup()),
                }
              : {
                  id: 'play',
                  label: i18n.t('play'),
                  // Someone new is offered the tutorial first, the once
                  onClick: () => open(routes.playOrTutorialOffer()),
                },
            {
              id: 'multiplayer',
              label: i18n.t('multiplayer'),
              color: 'green',
              onClick: () => open(routes.twoPlayerSetup()),
            },
            {
              id: 'stats',
              label: i18n.t('stats'),
              color: 'yellow',
              onClick: () => open(routes.statistics()),
            },
            {
              id: 'settings',
              label: i18n.t('settings'),
              color: 'pink',
              onClick: () => routes.openSettings(),
            },
          ],
        }),
      }),
    };
  }

  /**
   * The player's record: the overall one, then wins at each difficulty, then the challenges
   * passed (they don't count toward the rest).
   */
  public statistics(): ScreenEntry {
    const { i18n, statistics, challenges, back } = this.ctx;
    return {
      id: 'stats',
      view: () => {
        const stats = statistics.get();
        const t = (key: Parameters<I18nManager['t']>[0]) => i18n.t(key) as string;
        const percent = stats.played > 0 ? Math.round((100 * stats.won) / stats.played) : 0;
        return {
          title: t('stats'),
          subtitle: '',
          body: h(StatsScreen, {
            sections: [
              {
                rows: [
                  { label: t('statPlayed'), value: String(stats.played) },
                  { label: t('statWon'), value: `${stats.won} (${percent}%)` },
                  { label: t('statStreak'), value: String(stats.streak) },
                  { label: t('statBestStreak'), value: String(stats.bestStreak) },
                  { label: t('statRally'), value: String(stats.longestRally) },
                  { label: t('statPerfect'), value: String(stats.perfectHits) },
                  { label: t('statPower'), value: String(stats.powerShots) },
                ],
              },
              {
                heading: t('statByDifficulty'),
                rows: DIFFICULTY_LEVELS.map((level) => {
                  const { played, won } = stats.byDifficulty[level];
                  return {
                    label: i18n.getDifficultyInfo(level)[0],
                    value: `${won} / ${played}`,
                  };
                }),
              },
              {
                heading: t('challengesHeading'),
                rows: [{ label: t('challengesPassed'), value: passedCount(challenges.get()) }],
              },
            ],
            reset: {
              label: t('resetStats'),
              confirmLabel: t('resetStatsConfirm'),
              // The profile is a signal: wiped, the screen shows it by itself
              onReset: () => statistics.reset(),
            },
            backLabel: t('back'),
            onBack: back,
          }),
        };
      },
    };
  }
}
