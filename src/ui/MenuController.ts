import { h } from 'preact';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { I18nManager } from '@/i18n/I18nManager';
import { MatchEvent } from '@/match/MatchFlow';
import { MODE_IDS, ModeId, MODES } from '@/match/modes';
import { DIFFICULTY_LEVELS } from '@/match/difficulty';
import { getEmptyStatistics, Statistics } from '@/profile/Statistics';
import { SettingsStore } from '@/settings/SettingsStore';
import { UserSettings } from '@/settings/UserSettings';
import { EventBus } from '@/shared/EventBus';
import { PlayMenu } from '@/ui/screens/PlayMenu';
import { Choice } from '@/ui/screens/OptionRow';
import { QuickMatchSetup } from '@/ui/screens/QuickMatchSetup';
import { SettingsScreen } from '@/ui/screens/SettingsScreen';
import { StatsScreen } from '@/ui/screens/StatsScreen';
import { ButtonColor, UIManager } from '@/ui/UIManager';

/** The player's statistics, as the statistics screen shows and wipes them. */
export interface StatisticsAccess {
  get(): Statistics;
  /** Back to nothing, for good. */
  reset(): void;
}

export interface GameMenuActions {
  /** Starts a quick match, as the player last set it up (the settings keep the setup). */
  onStartGame: () => void;
  onResumeGame: () => void;
  onReturnToMainMenu: () => void;
  onUnlockAudio: () => void;
}

/** An on/off setting: a toggle, filled while on; picking it switches it. */
interface ToggleEntry {
  kind: 'toggle';
  key: keyof UserSettings;
  label: (settings: UserSettings, i18n: I18nManager) => string;
  isOn: (settings: UserSettings) => boolean;
  /** Play the menu click after the change, e.g. to let the player hear sound is back on. */
  clicks?: boolean;
  color: ButtonColor;
}

/** A setting picked from a list: its name and value between arrows that step it either way. */
interface ChoiceEntry {
  kind: 'choice';
  key: keyof UserSettings;
  name: (i18n: I18nManager) => string;
  value: (settings: UserSettings, i18n: I18nManager) => string;
  color: ButtonColor;
}

type SettingsMenuEntry = ToggleEntry | ChoiceEntry;

/** Each mode's button color in the PLAY menu; a new mode needs one. */
const MODE_COLORS: Record<ModeId, ButtonColor> = {
  story: 'pink',
  challenges: 'purple',
  quick: 'cyan',
};

const onOff = (i18n: I18nManager, isMuted: boolean) => i18n.t(isMuted ? 'off' : 'on');

/** The settings menu, top to bottom. */
const SETTINGS_MENU: SettingsMenuEntry[] = [
  {
    kind: 'toggle',
    key: 'musicMuted',
    color: 'pink',
    label: (s, i18n) => `${i18n.t('music')}: ${onOff(i18n, s.musicMuted)}`,
    isOn: (s) => !s.musicMuted,
  },
  {
    kind: 'toggle',
    key: 'soundMuted',
    color: 'purple',
    label: (s, i18n) => `${i18n.t('sound')}: ${onOff(i18n, s.soundMuted)}`,
    clicks: true,
    isOn: (s) => !s.soundMuted,
  },
  {
    kind: 'choice',
    key: 'language',
    color: 'green',
    name: (i18n) => i18n.t('lang'),
    value: (_, i18n) => i18n.t('lang_name'),
  },
];

/**
 * The quick match's choices, top to bottom. They are kept with the settings, so the next quick
 * match is set up as the last one was.
 */
const QUICK_MATCH_SETUP: ChoiceEntry[] = [
  {
    kind: 'choice',
    key: 'matchBackground',
    color: 'green',
    name: (i18n) => i18n.t('background'),
    value: (s, i18n) => i18n.getBackgroundName(s.matchBackground),
  },
  {
    kind: 'choice',
    key: 'difficulty',
    color: 'yellow',
    name: (i18n) => i18n.t('diff'),
    value: (s, i18n) => i18n.getDifficultyInfo(s.difficulty)[0],
  },
  {
    kind: 'choice',
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
  /** The player's record, as the profile keeps it, for the statistics screen. */
  private readonly statistics: StatisticsAccess;
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
    statistics: StatisticsAccess = { get: getEmptyStatistics, reset: () => {} },
  ) {
    this.uiManager = uiManager;
    this.i18n = i18n;
    this.sfx = sfx;
    this.settings = settings;
    this.actions = actions;
    this.statistics = statistics;

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
          // Local multiplayer comes in stage 2; until then it is on the menu, switched off
          label: this.i18n.t('multiplayer'),
          color: 'green',
          disabled: true,
          action: () => {},
        },
        {
          label: this.i18n.t('stats'),
          color: 'yellow',
          action: () => this.showStatistics(),
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

  /** The player's record: the overall one, then wins at each difficulty. */
  public showStatistics(): void {
    const back = () => this.showMainMenu();
    this.open(back);
    const stats = this.statistics.get();
    const t = (key: Parameters<I18nManager['t']>[0]) => this.i18n.t(key) as string;
    const percent = stats.played > 0 ? Math.round((100 * stats.won) / stats.played) : 0;

    this.uiManager.showScreen(
      t('stats'),
      '',
      h(StatsScreen, {
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
              return { label: this.i18n.getDifficultyInfo(level)[0], value: `${won} / ${played}` };
            }),
          },
        ],
        resetLabel: t('resetStats'),
        resetConfirmLabel: t('resetStatsConfirm'),
        onReset: () => {
          this.statistics.reset();
          this.showStatistics();
        },
        backLabel: t('back'),
        onBack: back,
      }),
      this.actions.onUnlockAudio,
      'stats',
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
      'play',
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
        options: QUICK_MATCH_SETUP.map((entry) => this.choiceOf(entry, settings)),
        previousLabel: this.i18n.t('previousChoice'),
        nextLabel: this.i18n.t('nextChoice'),
        startLabel: this.i18n.t('start'),
        backLabel: this.i18n.t('back'),
        onStart: () => this.actions.onStartGame(),
        onBack: back,
      }),
      this.actions.onUnlockAudio,
      'quickMatch',
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
   * Esc in the settings, the statistics, the PLAY menu or the quick match's setup: back to
   * where it was opened from, as its BACK button does.
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

    this.uiManager.showScreen(
      this.i18n.t('settings'),
      '',
      h(SettingsScreen, {
        items: SETTINGS_MENU.map((entry) =>
          entry.kind === 'toggle'
            ? {
                kind: 'toggle' as const,
                id: entry.key,
                label: entry.label(settings, this.i18n),
                color: entry.color,
                isOn: entry.isOn(settings),
                onToggle: () => this.changeSetting(entry),
              }
            : { kind: 'choice' as const, ...this.choiceOf(entry, settings) },
        ),
        previousLabel: this.i18n.t('previousChoice'),
        nextLabel: this.i18n.t('nextChoice'),
        backLabel: this.i18n.t('back'),
        onBack,
      }),
      this.actions.onUnlockAudio,
      'settings',
    );
  }

  /** A choice as its row shows it, its arrows stepping the setting either way. */
  private choiceOf(entry: ChoiceEntry, settings: UserSettings): Choice {
    return {
      id: entry.key,
      name: entry.name(this.i18n),
      value: entry.value(settings, this.i18n),
      color: entry.color,
      onNext: () => this.changeSetting(entry, 1),
      onPrevious: () => this.changeSetting(entry, -1),
    };
  }

  /** Switches one setting; the subscription redraws the menu or screen to show it. */
  private changeSetting(
    entry: { key: keyof UserSettings; clicks?: boolean },
    step: 1 | -1 = 1,
  ): void {
    this.settings.cycle(entry.key, step);
    if (entry.clicks) {
      // Only audible when sound is on
      this.sfx.playSettingsClick();
    }
  }
}
