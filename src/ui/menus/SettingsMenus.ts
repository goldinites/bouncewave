import { h } from 'preact';
import { CONTROL_ROWS } from '@/i18n/translations';
import { isInstalled, isTouchFirst } from '@/ui/device';
import { choiceOf, SETTINGS_MENU } from '@/ui/menus/choices';
import { MenuContext } from '@/ui/menus/MenuContext';
import { ScreenEntry } from '@/ui/ScreenStack';
import { SettingsScreen } from '@/ui/screens/SettingsScreen';
import { StatsScreen } from '@/ui/screens/StatsScreen';

/** The settings and, on a computer, the controls they lead to. */
export class SettingsMenus {
  constructor(private readonly ctx: MenuContext) {}

  /**
   * The settings: music, sound and language, over the screen on show (the main menu, the pause,
   * a match's end), which BACK returns to. Nothing in them changes how a match plays (that is
   * the quick match's setup), so they open from the pause too.
   */
  public settings(): ScreenEntry {
    const { i18n, settings, open, back } = this.ctx;
    return {
      id: 'settings',
      view: () => {
        const current = settings.current;
        const isTouch = isTouchFirst();
        return {
          title: i18n.t('settings'),
          // A phone plays full screen once the game is installed: the one thing worth telling
          // there that the game doesn't show by itself
          subtitle: isTouch && !isInstalled() ? i18n.t('installHint') : '',
          body: h(SettingsScreen, {
            items: [
              ...SETTINGS_MENU.map((entry) => ({
                kind: 'choice' as const,
                ...choiceOf(this.ctx, entry, current),
              })),
              // The keys, on a computer: a finger's controls are plain to see, and the tutorial
              // and the two players' setup tell what isn't
              ...(isTouch
                ? []
                : [
                    {
                      kind: 'link' as const,
                      id: 'controls',
                      label: i18n.t('controls').title,
                      color: 'yellow' as const,
                      onClick: () => open(this.controls()),
                    },
                  ]),
            ],
            previousLabel: i18n.t('previousChoice'),
            nextLabel: i18n.t('nextChoice'),
            backLabel: i18n.t('back'),
            onBack: back,
          }),
        };
      },
    };
  }

  /** The keys and the mouse, on a computer. Opened from the settings, so from the pause too. */
  private controls(): ScreenEntry {
    const { i18n, back } = this.ctx;
    return {
      id: 'controls',
      view: () => {
        const texts = i18n.t('controls');
        const rows = CONTROL_ROWS.map((id) => ({
          label: texts.rows[id].name,
          value: texts.rows[id].keys,
        }));
        return {
          title: texts.title,
          subtitle: '',
          body: h(StatsScreen, {
            sections: [{ rows }],
            backLabel: i18n.t('back'),
            onBack: back,
            variant: 'controls',
          }),
        };
      },
    };
  }
}
