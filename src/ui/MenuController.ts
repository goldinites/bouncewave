import { h } from 'preact';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { I18nManager } from '@/i18n/I18nManager';
import { MatchEvent } from '@/match/MatchFlow';
import { DEFAULT_MODE, MODE_IDS, ModeId } from '@/match/modes';
import { SettingsStore } from '@/settings/SettingsStore';
import { UserSettings } from '@/settings/UserSettings';
import { EventBus } from '@/shared/EventBus';
import { ModeSelect } from '@/ui/screens/ModeSelect';
import { ButtonColor, UIManager } from '@/ui/UIManager';

export interface GameMenuActions {
  onStartGame: (mode: ModeId) => void;
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
  /** Changes how a match plays, so it can be set only between matches, never from the pause. */
  isBetweenMatches?: boolean;
  color: ButtonColor;
}

const onOff = (i18n: I18nManager, isMuted: boolean) => i18n.t(isMuted ? 'off' : 'on');

/** The settings menu, top to bottom; picking an entry switches its setting to the next value. */
const SETTINGS_MENU: SettingsMenuEntry[] = [
  {
    key: 'difficulty',
    color: 'yellow',
    isBetweenMatches: true,
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
  /** Where Esc leads from what is on screen (the settings, the mode screen); null for none. */
  private back: (() => void) | null = null;
  /** The mode of the match last started, which PLAY AGAIN starts again. */
  private mode: ModeId = DEFAULT_MODE;
  /** Whether the settings menu on screen was opened from the pause. */
  private isSettingsMidMatch = false;
  private readonly unsubscribe: () => void;

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
    this.unsubscribe = settings.subscribe(() => {
      if (this.settingsBack && this.uiManager.isMenuVisible) {
        this.showSettingsMenu(this.settingsBack, this.isSettingsMidMatch);
      }
    });
  }

  public dispose(): void {
    this.unsubscribe();
  }

  /** Forgets where BACK and Esc led: called by every menu and screen as it opens. */
  private open(back: (() => void) | null = null, settingsBack: (() => void) | null = null): void {
    this.back = back;
    this.settingsBack = settingsBack;
  }

  public showMainMenu(): void {
    this.open();
    this.uiManager.showMenu(
      this.uiManager.gameTitle,
      '',
      [
        {
          label: this.i18n.t('play'),
          action: () => this.showModeSelect(),
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

  /** The mode screen, from PLAY: a card per mode, picking one starts its match. */
  public showModeSelect(): void {
    const back = () => this.showMainMenu();
    this.open(back);
    this.uiManager.showScreen(
      this.i18n.t('mode'),
      '',
      h(ModeSelect, {
        modes: MODE_IDS.map((id) => {
          const [name, description] = this.i18n.getModeInfo(id);
          return { id, name, description };
        }),
        backLabel: this.i18n.t('back'),
        onPick: (mode) => this.startGame(mode),
        onBack: back,
      }),
      this.actions.onUnlockAudio,
    );
  }

  private startGame(mode: ModeId): void {
    this.mode = mode;
    this.actions.onStartGame(mode);
  }

  public showPauseMenu(): void {
    this.open();
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
          action: () => this.showSettingsMenu(() => this.showPauseMenu(), true),
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

  /**
   * Opens the game-over menu (and puts the pause button away) whenever a match ends.
   * @returns a function that stops it
   */
  public listenTo(events: EventBus<MatchEvent>): () => void {
    return events.on('gameOver', ({ winnerIndex, scores }) => {
      this.uiManager.setPauseButtonVisibility(false);
      this.showGameOverMenu(winnerIndex, scores);
    });
  }

  public showGameOverMenu(winnerIndex: number, scores: [number, number]): void {
    this.open();
    const isPlayerWin = winnerIndex === 0;
    const title = this.i18n.t(isPlayerWin ? 'win' : 'lose');
    const subtitle = `${scores[0]} : ${scores[1]}`;

    this.uiManager.showMenu(
      title,
      subtitle,
      [
        {
          label: this.i18n.t('again'),
          action: () => this.startGame(this.mode),
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

  /**
   * Esc in the settings menu or the mode screen: back to where it was opened from, as its BACK
   * button does.
   * @returns whether it went back (false anywhere else)
   */
  public goBack(): boolean {
    if (!this.back || !this.uiManager.isMenuVisible) return false;
    this.back();
    return true;
  }

  /**
   * @param isMidMatch opened from the pause: settings that change how a match plays (the
   * difficulty) are left out, so they can't be switched halfway through one
   */
  public showSettingsMenu(onBack: () => void, isMidMatch = false): void {
    this.open(onBack, onBack);
    this.isSettingsMidMatch = isMidMatch;
    const settings = this.settings.current;
    const entries = SETTINGS_MENU.filter((entry) => !(isMidMatch && entry.isBetweenMatches));

    this.uiManager.showMenu(
      this.i18n.t('settings'),
      isMidMatch ? '' : this.i18n.getDifficultyInfo(settings.difficulty)[1],
      [
        ...entries.map((entry) => ({
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
