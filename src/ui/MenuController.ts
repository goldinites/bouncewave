import { h } from 'preact';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { I18nManager } from '@/i18n/I18nManager';
import { LANGUAGES, TRANSLATIONS } from '@/i18n/translations';
import { ChallengeVerdict } from '@/match/ChallengeJudge';
import { CHALLENGE_IDS, ChallengeId, CHALLENGES } from '@/match/challenges';
import { MatchEvent } from '@/match/MatchFlow';
import { MATCH_POINTS, MODE_IDS, ModeId, MODES } from '@/match/modes';
import { DIFFICULTY_LEVELS } from '@/match/difficulty';
import {
  ChallengeProgress,
  challengeState,
  getEmptyChallengeProgress,
  nextChallenge,
} from '@/profile/ChallengeProgress';
import { getEmptyStatistics, Statistics } from '@/profile/Statistics';
import { SettingsStore } from '@/settings/SettingsStore';
import { UserSettings } from '@/settings/UserSettings';
import { EventBus } from '@/shared/EventBus';
import { BACKGROUND_CHOICES, SceneId } from '@/shared/scenes';
import { describeShortfall } from '@/ui/challengeTexts';
import { ChallengeCard } from '@/ui/screens/ChallengeCard';
import { ChallengeList } from '@/ui/screens/ChallengeList';
import { ChallengeResult, ChallengeResultAction } from '@/ui/screens/ChallengeResult';
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

/** How far the player has got through the challenges, as the profile keeps it. */
export interface ChallengeProgressAccess {
  get(): ChallengeProgress;
}

/** How an attempt at a challenge went, as its result screen shows it. */
export interface ChallengeOutcome {
  verdict: ChallengeVerdict;
  /** Whether this attempt passed the last challenge still to pass: every one is passed now. */
  isAllPassed: boolean;
}

export interface GameMenuActions {
  /** Starts the same match again from 0:0, set up as it was (restart, play again). */
  onStartGame: () => void;
  /** Starts a quick match, as the player last set it up (the settings keep the setup). */
  onStartQuickMatch: () => void;
  /** Starts an attempt at a challenge. */
  onStartChallenge: (challenge: ChallengeId) => void;
  /** Starts a match of two players, as they last set it up (the settings keep the setup). */
  onStartTwoPlayers?: () => void;
  /**
   * Whether two people play the match on court: its end names the winner instead of "you win" or
   * "game over". Nobody does when left out.
   */
  isTwoPlayerMatch?: () => boolean;
  /**
   * Whether the match on court is an attempt at a challenge: its end shows the attempt's result
   * (`showChallengeResult`) instead of the game-over menu. No match is when left out.
   */
  isChallengeMatch?: () => boolean;
  onResumeGame: () => void;
  onReturnToMainMenu: () => void;
  onUnlockAudio: () => void;
  /** The quick match's setup came on screen (true) or gave way to another (false). */
  onQuickMatchSetup?: (isShown: boolean) => void;
  /**
   * A menu came on screen that wants a backdrop behind it: a challenge's card its challenge's
   * own, the main menu, the PLAY menu and the challenges' list the player's (null). Menus that
   * belong to a match (pause, its end, an attempt's result) leave the backdrop as it is.
   */
  onMenuScene?: (scene: SceneId | null) => void;
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
  /** Every value it can show, so its row keeps the widest one's room. */
  values: (i18n: I18nManager) => string[];
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
    // Each language is named in itself, whichever the menus are in
    values: () => LANGUAGES.map((language) => TRANSLATIONS[language].lang_name),
  },
];

/**
 * The choices of a match of two players: the quick match's, but its difficulty, which sets how
 * well the CPU plays. They share the settings with it: the backdrop and length the players like.
 */
const TWO_PLAYER_SETUP = (): ChoiceEntry[] =>
  QUICK_MATCH_SETUP.filter((entry) => entry.key !== 'difficulty');

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
    values: (i18n) => BACKGROUND_CHOICES.map((choice) => i18n.getBackgroundName(choice)),
  },
  {
    kind: 'choice',
    key: 'difficulty',
    color: 'yellow',
    name: (i18n) => i18n.t('diff'),
    value: (s, i18n) => i18n.getDifficultyInfo(s.difficulty)[0],
    values: (i18n) => DIFFICULTY_LEVELS.map((level) => i18n.getDifficultyInfo(level)[0]),
  },
  {
    kind: 'choice',
    key: 'matchPoints',
    color: 'pink',
    name: (i18n) => i18n.t('points'),
    value: (s) => String(s.matchPoints),
    values: () => MATCH_POINTS.map(String),
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
  /** Which challenges the player has passed, for their screens and the statistics. */
  private readonly challenges: ChallengeProgressAccess;
  /** Where Esc leads from what is on screen (the settings, the PLAY menu, the setup). */
  private back: (() => void) | null = null;
  /** Whether the quick match's setup is the last screen opened. */
  private isQuickMatchSetupShown = false;
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
    challenges: ChallengeProgressAccess = { get: getEmptyChallengeProgress },
  ) {
    this.uiManager = uiManager;
    this.i18n = i18n;
    this.sfx = sfx;
    this.settings = settings;
    this.actions = actions;
    this.statistics = statistics;
    this.challenges = challenges;

    // A setting may also change from outside the menu (the music chip, the M key)
    this.unsubscribe = settings.subscribe(() => {
      if (this.redraw && this.uiManager.isMenuVisible) this.redraw();
    });
  }

  public dispose(): void {
    this.unsubscribe();
  }

  /**
   * Forgets where BACK and Esc led: called by every menu and screen as it opens, and says when
   * the quick match's setup comes on screen or goes (not when it is merely redrawn).
   * @param scene the backdrop the screen wants behind it (null for the player's); left out, the
   *   backdrop stays as it is
   */
  private open(
    back: (() => void) | null = null,
    redraw: (() => void) | null = null,
    isQuickMatchSetup = false,
    scene?: SceneId | null,
  ): void {
    this.back = back;
    this.redraw = redraw;
    if (isQuickMatchSetup !== this.isQuickMatchSetupShown) {
      this.isQuickMatchSetupShown = isQuickMatchSetup;
      this.actions.onQuickMatchSetup?.(isQuickMatchSetup);
    }
    if (scene !== undefined) this.actions.onMenuScene?.(scene);
  }

  public showMainMenu(): void {
    this.open(null, null, false, null);
    this.uiManager.showMenu(
      this.uiManager.gameTitle,
      '',
      [
        {
          label: this.i18n.t('play'),
          action: () => this.showPlayMenu(),
        },
        {
          label: this.i18n.t('multiplayer'),
          color: 'green',
          action: () => this.showTwoPlayerSetup(),
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

  /**
   * The player's record: the overall one, then wins at each difficulty, then the challenges
   * passed (they don't count toward the rest).
   */
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
          {
            heading: t('challengesHeading'),
            rows: [{ label: t('challengesPassed'), value: this.passedCount() }],
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
    this.open(back, null, false, null);
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
    if (mode === 'challenges') this.showChallengeList();
  }

  /** "4 / 9": the challenges passed, of them all. */
  private passedCount(): string {
    return `${this.challenges.get().passed.length} / ${CHALLENGE_IDS.length}`;
  }

  /** Every challenge in the order they open, the count of those passed under the title. */
  public showChallengeList(): void {
    const back = () => this.showPlayMenu();
    this.open(back, null, false, null);
    const progress = this.challenges.get();
    this.uiManager.showScreen(
      this.i18n.getModeName('challenges'),
      `${this.i18n.t('challengesPassed')}: ${this.passedCount()}`,
      h(ChallengeList, {
        challenges: CHALLENGE_IDS.map((id) => ({
          id,
          name: this.i18n.getChallengeInfo(id)[0],
          state: challengeState(progress, id),
        })),
        backLabel: this.i18n.t('back'),
        onPick: (id) => this.showChallengeCard(id),
        onBack: back,
      }),
      this.actions.onUnlockAudio,
      'challenges',
    );
  }

  /**
   * A challenge's card: its name and its description (which says what sets its match apart), START
   * and BACK. A passed one is marked so, and can be played again. Its reward (money) joins it with
   * the economy (stage 6).
   */
  public showChallengeCard(challenge: ChallengeId): void {
    const back = () => this.showChallengeList();
    // The card shows the challenge on its own backdrop, its song with it
    this.open(back, null, false, CHALLENGES[challenge].scene);
    const [name, description] = this.i18n.getChallengeInfo(challenge);
    const isPassed = challengeState(this.challenges.get(), challenge) === 'passed';
    this.uiManager.showScreen(
      name,
      description,
      h(ChallengeCard, {
        passedLabel: isPassed ? this.i18n.t('attemptPassed') : null,
        startLabel: this.i18n.t('start'),
        backLabel: this.i18n.t('back'),
        onStart: () => this.actions.onStartChallenge(challenge),
        onBack: back,
      }),
      this.actions.onUnlockAudio,
      `challenge:${challenge}`,
    );
  }

  /**
   * How an attempt went, in place of the game-over menu. Passed: NEXT (on to the next one's card)
   * and the list, with a flourish once every challenge is passed. Not passed: what it fell short
   * by, TRY AGAIN and the list.
   */
  public showChallengeResult({ verdict, isAllPassed }: ChallengeOutcome): void {
    this.open();
    const { challenge, isPassed } = verdict;
    const next = nextChallenge(challenge);
    // Out of the finished match, back to the menus, and on to a challenge's screen
    const leave = (show: () => void) => () => {
      this.actions.onReturnToMainMenu();
      show();
    };
    const toList: ChallengeResultAction = {
      id: 'list',
      label: this.i18n.t('toChallenges'),
      color: 'purple',
      onClick: leave(() => this.showChallengeList()),
    };
    const actions: ChallengeResultAction[] = [];
    if (!isPassed) {
      actions.push({
        id: 'again',
        label: this.i18n.t('tryAgain'),
        color: 'cyan',
        onClick: () => this.actions.onStartGame(),
      });
    } else if (next) {
      actions.push({
        id: 'next',
        label: this.i18n.t('nextChallenge'),
        color: 'cyan',
        onClick: leave(() => this.showChallengeCard(next)),
      });
    }
    actions.push(toList);

    let message = '';
    if (!isPassed) message = describeShortfall(this.i18n, verdict);
    else if (isAllPassed) message = this.i18n.t('attemptAllPassed');

    this.uiManager.showScreen(
      this.i18n.t(isPassed ? 'attemptPassed' : 'attemptFailed'),
      this.i18n.getChallengeInfo(challenge)[0],
      h(ChallengeResult, { message, isCelebration: isPassed && isAllPassed, actions }),
      this.actions.onUnlockAudio,
      'challengeResult',
    );
  }

  /**
   * The quick match's setup: backdrop, difficulty and length, as last chosen; START plays it.
   * The difficulty's description stands under the title, as it did in the settings.
   */
  public showQuickMatchSetup(): void {
    const back = () => this.showPlayMenu();
    this.open(back, () => this.showQuickMatchSetup(), true);
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
        onStart: () => this.actions.onStartQuickMatch(),
        onBack: back,
      }),
      this.actions.onUnlockAudio,
      'quickMatch',
    );
  }

  /**
   * The setup of a match of two players on one device: backdrop and length, as last chosen; how
   * each steers stands under the title. START plays it.
   */
  public showTwoPlayerSetup(): void {
    const back = () => this.showMainMenu();
    this.open(back, () => this.showTwoPlayerSetup(), true);
    const settings = this.settings.current;
    this.uiManager.showScreen(
      this.i18n.t('twoPlayers'),
      this.i18n.t('twoPlayersHint'),
      h(QuickMatchSetup, {
        options: TWO_PLAYER_SETUP().map((entry) => this.choiceOf(entry, settings)),
        previousLabel: this.i18n.t('previousChoice'),
        nextLabel: this.i18n.t('nextChoice'),
        startLabel: this.i18n.t('start'),
        backLabel: this.i18n.t('back'),
        onStart: () => this.actions.onStartTwoPlayers?.(),
        onBack: back,
      }),
      this.actions.onUnlockAudio,
      'twoPlayers',
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
   * Opens the game-over menu (and puts the pause button away) whenever a match ends; after an
   * attempt at a challenge, its result comes instead, told by `showChallengeResult`.
   * @returns a function that stops it
   */
  public listenTo(events: EventBus<MatchEvent>): () => void {
    return events.on('gameOver', ({ winnerIndex, scores }) => {
      this.uiManager.setPauseButtonVisibility(false);
      if (this.actions.isChallengeMatch?.()) return;
      this.showGameOverMenu(winnerIndex, scores);
    });
  }

  public showGameOverMenu(winnerIndex: number, scores: [number, number]): void {
    this.open();
    // With two players the winner is named; otherwise the left side is the player
    const title = this.actions.isTwoPlayerMatch?.()
      ? this.i18n.t(winnerIndex === 0 ? 'player1Wins' : 'player2Wins')
      : this.i18n.t(winnerIndex === 0 ? 'win' : 'lose');
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
   * Esc in the settings, the statistics, the PLAY menu, a match's setup (quick, two players) or a challenge's
   * screen (the list, a card): back to
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
      values: entry.values(this.i18n),
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
