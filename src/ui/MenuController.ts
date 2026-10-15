import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { I18nManager } from '@/i18n/I18nManager';
import { SettingsStore } from '@/settings/SettingsStore';
import { UserSettings } from '@/settings/UserSettings';
import { UIManager } from '@/ui/UIManager';

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
}

const onOff = (i18n: I18nManager, isMuted: boolean) => i18n.t(isMuted ? 'off' : 'on');

/** The settings menu, top to bottom; picking an entry switches its setting to the next value. */
const SETTINGS_MENU: SettingsMenuEntry[] = [
  {
    key: 'difficulty',
    label: (s, i18n) => `${i18n.t('diff')}: ${i18n.getDifficultyInfo(s.difficulty)[0]}`,
  },
  {
    key: 'musicMuted',
    label: (s, i18n) => `${i18n.t('music')}: ${onOff(i18n, s.musicMuted)}`,
    isOn: (s) => !s.musicMuted,
  },
  {
    key: 'soundMuted',
    label: (s, i18n) => `${i18n.t('sound')}: ${onOff(i18n, s.soundMuted)}`,
    clicks: true,
    isOn: (s) => !s.soundMuted,
  },
  { key: 'language', label: (_, i18n) => `${i18n.t('lang')}: ${i18n.t('lang_name')}` },
];

export class MenuController {
  private uiManager: UIManager;
  private i18n: I18nManager;
  private sfx: SoundEffects;
  private settings: SettingsStore;
  private actions: GameMenuActions;

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
  }

  public showMainMenu(): void {
    this.uiManager.showMenu(
      'PING PONG',
      '',
      [
        {
          label: this.i18n.t('play'),
          action: () => this.actions.onStartGame(),
        },
        {
          label: this.i18n.t('settings'),
          action: () => this.showSettingsMenu(() => this.showMainMenu()),
        },
      ],
      this.actions.onUnlockAudio,
    );
  }

  public showPauseMenu(): void {
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
          action: () => this.showSettingsMenu(() => this.showPauseMenu()),
        },
        {
          label: this.i18n.t('menu'),
          action: () => this.actions.onReturnToMainMenu(),
        },
      ],
      this.actions.onUnlockAudio,
    );
  }

  public showGameOverMenu(winnerIndex: number, scores: [number, number]): void {
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
          action: () => this.showSettingsMenu(() => this.showGameOverMenu(winnerIndex, scores)),
        },
        {
          label: this.i18n.t('menu'),
          action: () => this.actions.onReturnToMainMenu(),
        },
      ],
      this.actions.onUnlockAudio,
    );
  }

  public showSettingsMenu(onBack: () => void): void {
    const settings = this.settings.current;

    this.uiManager.showMenu(
      this.i18n.t('settings'),
      this.i18n.getDifficultyInfo(settings.difficulty)[1],
      [
        ...SETTINGS_MENU.map((entry) => ({
          label: entry.label(settings, this.i18n),
          action: () => this.changeSetting(entry, onBack),
          isOn: entry.isOn?.(settings),
        })),
        { label: this.i18n.t('back'), action: onBack },
      ],
      this.actions.onUnlockAudio,
    );
  }

  /** Switches one setting and redraws the settings menu to show it. */
  private changeSetting(entry: SettingsMenuEntry, onBack: () => void): void {
    this.settings.cycle(entry.key);
    if (entry.clicks) {
      // Only audible when sound is on
      this.sfx.playSettingsClick();
    }
    this.showSettingsMenu(onBack);
  }
}
