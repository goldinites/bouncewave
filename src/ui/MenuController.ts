import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { I18nManager } from '@/i18n/I18nManager';
import { nextDifficulty } from '@/match/difficulty';
import { nextLanguage } from '@/i18n/translations';
import { UserSettings } from '@/settings/SettingsStorage';
import { SettingsStore } from '@/settings/SettingsStore';
import { UIManager } from '@/ui/UIManager';

export interface GameMenuActions {
  onStartGame: () => void;
  onResumeGame: () => void;
  onReturnToMainMenu: () => void;
  onUnlockAudio: () => void;
}

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
    const currentDiffInfo = this.i18n.getDifficultyInfo(settings.difficulty);

    const difficultyLabel = `${this.i18n.t('diff')}: ${currentDiffInfo[0]}`;
    const musicLabel = `${this.i18n.t('music')}: ${this.i18n.t(settings.musicMuted ? 'off' : 'on')}`;
    const soundLabel = `${this.i18n.t('sound')}: ${this.i18n.t(settings.soundMuted ? 'off' : 'on')}`;
    const languageLabel = `${this.i18n.t('lang')}: ${this.i18n.t('lang_name')}`;

    this.uiManager.showMenu(
      this.i18n.t('settings'),
      currentDiffInfo[1],
      [
        {
          label: difficultyLabel,
          action: () =>
            this.changeSetting({ difficulty: nextDifficulty(settings.difficulty) }, onBack),
        },
        {
          label: musicLabel,
          action: () => this.changeSetting({ musicMuted: !settings.musicMuted }, onBack),
        },
        {
          label: soundLabel,
          action: () => {
            this.changeSetting({ soundMuted: !settings.soundMuted }, onBack);
            // Only audible when sound was just switched on
            this.sfx.playSettingsClick();
          },
        },
        {
          label: languageLabel,
          action: () => this.changeSetting({ language: nextLanguage(settings.language) }, onBack),
        },
        {
          label: this.i18n.t('back'),
          action: onBack,
        },
      ],
      this.actions.onUnlockAudio,
    );
  }

  /** Applies one change and redraws the settings menu to show it. */
  private changeSetting(patch: Partial<UserSettings>, onBack: () => void): void {
    this.settings.update(patch);
    this.showSettingsMenu(onBack);
  }
}
