import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { I18nManager } from '@/i18n/I18nManager';
import { SettingsStore } from '@/settings/SettingsStore';
import { UserSettings } from '@/settings/UserSettings';
import { ButtonColor, UIManager } from '@/ui/UIManager';

export interface GameMenuActions {
  onStartGame: () => void;
  onResumeGame: () => void;
  onReturnToMainMenu: () => void;
  onUnlockAudio: () => void;
}

interface SettingsMenuEntry {
  key: keyof UserSettings;
  label: (settings: UserSettings, i18n: I18nManager) => string;
  /** Play the menu click after the change, e.g. to let the player hear sound is back on. */
  clicks?: boolean;
  /** For on/off settings: shows the entry as a toggle, filled while on. */
  isOn?: (settings: UserSettings) => boolean;
  color: ButtonColor;
}

const onOff = (i18n: I18nManager, isMuted: boolean) => i18n.t(isMuted ? 'off' : 'on');

/** The settings menu, top to bottom; picking an entry switches its setting to the next value. */
const SETTINGS_MENU: SettingsMenuEntry[] = [
  {
    key: 'difficulty',
    color: 'yellow',
    label: (s, i18n) => `${i18n.t('diff')}: ${i18n.getDifficultyInfo(s.difficulty)[0]}`,
  },
  {
    key: 'musicMuted',
    color: 'pink',
    label: (s, i18n) => `${i18n.t('music')}: ${onOff(i18n, s.musicMuted)}`,
    isOn: (s) => !s.musicMuted,
  },
  {
    key: 'soundMuted',
    color: 'purple',
    label: (s, i18n) => `${i18n.t('sound')}: ${onOff(i18n, s.soundMuted)}`,
    clicks: true,
    isOn: (s) => !s.soundMuted,
  },
  {
    key: 'language',
    color: 'green',
    label: (_, i18n) => `${i18n.t('lang')}: ${i18n.t('lang_name')}`,
  },
];

export class MenuController {
  private uiManager: UIManager;
  private i18n: I18nManager;
  private sfx: SoundEffects;
  private settings: SettingsStore;
  private actions: GameMenuActions;
  /** Where the settings menu's BACK leads while it is on screen; null when it isn't. */
  private settingsBack: (() => void) | null = null;

  constructor(
    uiManager: UIManager,
    i18n: I18nManager,
    sfx: SoundEffects,
    settings: SettingsStore,
    actions: GameMenuActions,
  ) {
    this.uiManager = uiManager;
    this.i18n = i18n;
    this.sfx = sfx;
    this.settings = settings;
    this.actions = actions;

    // A setting may also change from outside the menu (the music chip, the M key)
    settings.subscribe(() => {
      // Esc resumes play straight from a settings menu opened in pause, which hides it
      if (this.settingsBack && this.uiManager.isMenuVisible) {
        this.showSettingsMenu(this.settingsBack);
      }
    });
  }

  public showMainMenu(): void {
    this.settingsBack = null;
    this.uiManager.showMenu(
      'BOUNCEWAVE',
      '',
      [
        {
          label: this.i18n.t('play'),
          action: () => this.actions.onStartGame(),
        },
        {
          label: this.i18n.t('settings'),
          color: 'pink',
          action: () => this.showSettingsMenu(() => this.showMainMenu()),
        },
      ],
      this.actions.onUnlockAudio,
    );
  }

  public showPauseMenu(): void {
    this.settingsBack = null;
    this.uiManager.showMenu(
      this.i18n.t('pause'),
      '',
      [
        {
          label: this.i18n.t('resume'),
          action: () => this.actions.onResumeGame(),
        },
        {
          label: this.i18n.t('settings'),
          color: 'pink',
          action: () => this.showSettingsMenu(() => this.showPauseMenu()),
        },
        {
          label: this.i18n.t('menu'),
          color: 'purple',
          action: () => this.actions.onReturnToMainMenu(),
        },
      ],
      this.actions.onUnlockAudio,
    );
  }

  public showGameOverMenu(winnerIndex: number, scores: [number, number]): void {
    this.settingsBack = null;
    const isPlayerWin = winnerIndex === 0;
    const title = this.i18n.t(isPlayerWin ? 'win' : 'lose');
    const subtitle = `${scores[0]} : ${scores[1]}`;

    this.uiManager.showMenu(
      title,
      subtitle,
      [
        {
          label: this.i18n.t('again'),
          action: () => this.actions.onStartGame(),
        },
        {
          label: this.i18n.t('settings'),
          color: 'pink',
          action: () => this.showSettingsMenu(() => this.showGameOverMenu(winnerIndex, scores)),
        },
        {
          label: this.i18n.t('menu'),
          color: 'purple',
          action: () => this.actions.onReturnToMainMenu(),
        },
      ],
      this.actions.onUnlockAudio,
    );
  }

  public showSettingsMenu(onBack: () => void): void {
    this.settingsBack = onBack;
    const settings = this.settings.current;

    this.uiManager.showMenu(
      this.i18n.t('settings'),
      this.i18n.getDifficultyInfo(settings.difficulty)[1],
      [
        ...SETTINGS_MENU.map((entry) => ({
          label: entry.label(settings, this.i18n),
          action: () => this.changeSetting(entry),
          isOn: entry.isOn?.(settings),
          color: entry.color,
        })),
        { label: this.i18n.t('back'), action: onBack },
      ],
      this.actions.onUnlockAudio,
    );
  }

  /** Switches one setting; the subscription redraws the settings menu to show it. */
  private changeSetting(entry: SettingsMenuEntry): void {
    this.settings.cycle(entry.key);
    if (entry.clicks) {
      // Only audible when sound is on
      this.sfx.playSettingsClick();
    }
  }
}
