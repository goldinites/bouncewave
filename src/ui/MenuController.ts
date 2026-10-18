import { h } from 'preact';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { I18nManager } from '@/i18n/I18nManager';
import { MatchEvent } from '@/match/MatchFlow';
import { MODE_IDS, ModeId, MODES } from '@/match/modes';
import { SettingsStore } from '@/settings/SettingsStore';
import { UserSettings } from '@/settings/UserSettings';
import { EventBus } from '@/shared/EventBus';
import { PlayMenu } from '@/ui/screens/PlayMenu';
import { QuickMatchSetup } from '@/ui/screens/QuickMatchSetup';
import { ButtonColor, UIManager } from '@/ui/UIManager';

export interface GameMenuActions {
  /** Starts a quick match, as the player last set it up (the settings keep the setup). */
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

/** Each mode's button color in the PLAY menu; a new mode needs one. */
const MODE_COLORS: Record<ModeId, ButtonColor> = {
  story: 'pink',
  challenges: 'purple',
  quick: 'cyan',
};

const onOff = (i18n: I18nManager, isMuted: boolean) => i18n.t(isMuted ? 'off' : 'on');

/** The settings menu, top to bottom; picking an entry switches its setting to the next value. */
const SETTINGS_MENU: SettingsMenuEntry[] = [
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

/** A choice of the quick match's setup: a setting, shown as its name over its value. */
interface SetupEntry {
  key: keyof UserSettings;
  name: (i18n: I18nManager) => string;
  value: (settings: UserSettings, i18n: I18nManager) => string;
  color: ButtonColor;
}

/**
 * The quick match's choices, top to bottom; picking one steps it to its next value. They are
 * kept with the settings, so the next quick match is set up as the last one was.
 */
const QUICK_MATCH_SETUP: SetupEntry[] = [
  {
    key: 'matchBackground',
    color: 'green',
    name: (i18n) => i18n.t('background'),
    value: (s, i18n) => i18n.getBackgroundName(s.matchBackground),
  },
  {
    key: 'difficulty',
    color: 'yellow',
    name: (i18n) => i18n.t('diff'),
    value: (s, i18n) => i18n.getDifficultyInfo(s.difficulty)[0],
  },
  {
    key: 'matchPoints',
    color: 'pink',
    name: (i18n) => i18n.t('points'),
    value: (s) => String(s.matchPoints),
  },
];

export class MenuController {
  private uiManager: UIManager;
  private i18n: I18nManager;
  private sfx: SoundEffects;
  private settings: SettingsStore;
  private actions: GameMenuActions;
  /** Where Esc leads from what is on screen (the settings, the PLAY menu, the setup). */
  private back: (() => void) | null = null;
  /** Shows what is on screen again, when it shows settings that may change; null otherwise. */
  private redraw: (() => void) | null = null;
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
      if (this.redraw && this.uiManager.isMenuVisible) this.redraw();
    });
  }

  public dispose(): void {
    this.unsubscribe();
  }

  /** Forgets where BACK and Esc led: called by every menu and screen as it opens. */
  private open(back: (() => void) | null = null, redraw: (() => void) | null = null): void {
    this.back = back;
    this.redraw = redraw;
  }

  public showMainMenu(): void {
    this.open();
    this.uiManager.showMenu(
      this.uiManager.gameTitle,
      '',
      [
        {
          label: this.i18n.t('play'),
          action: () => this.showPlayMenu(),
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

  /** The PLAY menu: a button per mode, those not playable yet switched off. */
  public showPlayMenu(): void {
    const back = () => this.showMainMenu();
    this.open(back);
    this.uiManager.showScreen(
      this.i18n.t('mode'),
      '',
      h(PlayMenu, {
        modes: MODE_IDS.map((id) => ({
          id,
          name: this.i18n.getModeName(id),
          color: MODE_COLORS[id],
          isPlayable: MODES[id].isPlayable,
        })),
        backLabel: this.i18n.t('back'),
        onPick: (mode) => this.pickMode(mode),
        onBack: back,
      }),
      this.actions.onUnlockAudio,
    );
  }

  private pickMode(mode: ModeId): void {
    if (mode === 'quick') this.showQuickMatchSetup();
  }

  /**
   * The quick match's setup: backdrop, difficulty and length, as last chosen; START plays it.
   * The difficulty's description stands under the title, as it did in the settings.
   */
  public showQuickMatchSetup(): void {
    const back = () => this.showPlayMenu();
    this.open(back, () => this.showQuickMatchSetup());
    const settings = this.settings.current;
    this.uiManager.showScreen(
      this.i18n.getModeName('quick'),
      this.i18n.getDifficultyInfo(settings.difficulty)[1],
      h(QuickMatchSetup, {
        options: QUICK_MATCH_SETUP.map((entry) => ({
          id: entry.key,
          name: entry.name(this.i18n),
          value: entry.value(settings, this.i18n),
          color: entry.color,
          onNext: () => this.changeSetting(entry, 1),
          onPrevious: () => this.changeSetting(entry, -1),
        })),
        previousLabel: this.i18n.t('previousChoice'),
        nextLabel: this.i18n.t('nextChoice'),
        startLabel: this.i18n.t('start'),
        backLabel: this.i18n.t('back'),
        onStart: () => this.actions.onStartGame(),
        onBack: back,
      }),
      this.actions.onUnlockAudio,
    );
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
          // The same match again from 0:0, set up as it was
          label: this.i18n.t('restart'),
          color: 'yellow',
          action: () => this.actions.onStartGame(),
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

  /**
   * Esc in the settings, the PLAY menu or the quick match's setup: back to where it was opened
   * from, as its BACK button does.
   * @returns whether it went back (false anywhere else)
   */
  public goBack(): boolean {
    if (!this.back || !this.uiManager.isMenuVisible) return false;
    this.back();
    return true;
  }

  /**
   * The settings: music, sound and language. Nothing in them changes how a match plays (that is
   * the quick match's setup), so they open from the pause too.
   */
  public showSettingsMenu(onBack: () => void): void {
    this.open(onBack, () => this.showSettingsMenu(onBack));
    const settings = this.settings.current;

    this.uiManager.showMenu(
      this.i18n.t('settings'),
      '',
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

  /** Switches one setting; the subscription redraws the menu or screen to show it. */
  private changeSetting(entry: Pick<SettingsMenuEntry, 'key' | 'clicks'>, step: 1 | -1 = 1): void {
    this.settings.cycle(entry.key, step);
    if (entry.clicks) {
      // Only audible when sound is on
      this.sfx.playSettingsClick();
    }
  }
}
