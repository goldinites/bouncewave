import { effect, ReadonlySignal, signal, untracked } from '@preact/signals-core';
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
import { Look } from '@/shared/look';
import { BACKGROUND_CHOICES, SceneId } from '@/shared/scenes';
import { describeShortfall } from '@/ui/challengeTexts';
import { ScreenEntry, ScreenStack, ScreenView } from '@/ui/ScreenStack';
import { ButtonMenu } from '@/ui/screens/ButtonMenu';
import { ChallengeCard } from '@/ui/screens/ChallengeCard';
import { ChallengeList } from '@/ui/screens/ChallengeList';
import { ChallengeResult, ChallengeResultAction } from '@/ui/screens/ChallengeResult';
import { PlayMenu } from '@/ui/screens/PlayMenu';
import { Choice } from '@/ui/screens/OptionRow';
import { QuickMatchSetup } from '@/ui/screens/QuickMatchSetup';
import { SettingsScreen } from '@/ui/screens/SettingsScreen';
import { StatsScreen } from '@/ui/screens/StatsScreen';
import { ButtonColor, UIManager } from '@/ui/UIManager';

/**
 * The player's statistics, as the statistics screen shows and wipes them. Read from a signal
 * (the profile's), the screen follows a change by itself.
 */
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
  /**
   * Starts the match on court again from 0:0 (the pause's restart): as `onStartGame`, but on the
   * same backdrop, with no channels flicking over. `onStartGame` stands in when left out.
   */
  onRestartGame?: () => void;
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

/** A match's setup in a look: the classic one draws no backdrop, so it has none to choose. */
const setupIn = (look: Look, entries: ChoiceEntry[]): ChoiceEntry[] =>
  look === 'classic' ? entries.filter((entry) => entry.key !== 'matchBackground') : entries;

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

/**
 * Every menu of the game, each a Preact screen on a stack (`ScreenStack`): a button opens a
 * screen over the one on show, BACK and Esc step back down to the one it was opened from. The
 * screen on show is drawn in an effect, so a setting, the profile or the look changing (from the
 * menu or from outside it: the M key, the classic look's easter egg) draws it again by itself.
 * The classic look plays only a quick match and a match of two: its main menu offers just those,
 * and their setups have no backdrop to choose.
 */
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
  private readonly stack = new ScreenStack();
  /** The game's look, which decides what the menus offer. */
  private readonly look: ReadonlySignal<Look>;
  /** The screen last drawn, to tell one drawn again from one that has just come on screen. */
  private drawn: ScreenEntry | null = null;
  /** Whether a match's setup (quick, two players) was the last screen to come up. */
  private isMatchSetupShown = false;
  private readonly stopDrawing: () => void;

  constructor(
    uiManager: UIManager,
    i18n: I18nManager,
    sfx: SoundEffects,
    settings: SettingsStore,
    actions: GameMenuActions,
    statistics: StatisticsAccess = { get: getEmptyStatistics, reset: () => {} },
    challenges: ChallengeProgressAccess = { get: getEmptyChallengeProgress },
    look: ReadonlySignal<Look> = signal('neon'),
  ) {
    this.uiManager = uiManager;
    this.i18n = i18n;
    this.sfx = sfx;
    this.settings = settings;
    this.actions = actions;
    this.statistics = statistics;
    this.challenges = challenges;
    this.look = look;

    this.stopDrawing = effect(() => {
      const entry = this.stack.top.value;
      if (!entry) return;
      // What the screen reads here is what draws it again when it changes
      const view = entry.view();
      untracked(() => this.draw(entry, view));
    });
  }

  public dispose(): void {
    this.stopDrawing();
  }

  /**
   * Shows the screen on top of the stack. One that has just come up tells the game (the backdrop
   * it wants, whether it sets a match up); one drawn again only changes in place, and not at all
   * while the menus are put away for a match, so a setting changed during play (the M key) leaves
   * them hidden.
   */
  private draw(entry: ScreenEntry, view: ScreenView): void {
    const isNew = entry !== this.drawn;
    if (!isNew && !this.uiManager.isMenuVisible) return;
    this.drawn = entry;
    if (isNew) {
      const wasMatchSetup = this.isMatchSetupShown;
      this.isMatchSetupShown = entry.isMatchSetup ?? false;
      if (this.isMatchSetupShown !== wasMatchSetup) {
        this.actions.onQuickMatchSetup?.(this.isMatchSetupShown);
      }
      if (entry.scene !== undefined) this.actions.onMenuScene?.(entry.scene);
    }
    this.uiManager.showScreen(
      view.title,
      view.subtitle,
      view.body,
      this.actions.onUnlockAudio,
      entry.id,
    );
  }

  /** Whether the main menu is on show (the one place the look may change). */
  public get isOnMainMenu(): boolean {
    return this.uiManager.isMenuVisible && this.stack.top.value?.id === 'main';
  }

  /** Back down the stack, as BACK does. */
  private readonly back = () => {
    this.stack.back();
  };

  public showMainMenu(): void {
    this.stack.reset(this.mainMenu());
  }

  private mainMenu(): ScreenEntry {
    return {
      id: 'main',
      scene: null,
      view: () => ({
        title: this.uiManager.gameTitle,
        subtitle: '',
        body: h(ButtonMenu, {
          items: [
            this.look.value === 'classic'
              ? {
                  id: 'quick',
                  label: this.i18n.getModeName('quick'),
                  onClick: () => this.open(this.quickMatchSetup()),
                }
              : {
                  id: 'play',
                  label: this.i18n.t('play'),
                  onClick: () => this.open(this.playMenu()),
                },
            {
              id: 'multiplayer',
              label: this.i18n.t('multiplayer'),
              color: 'green',
              onClick: () => this.open(this.twoPlayerSetup()),
            },
            {
              id: 'stats',
              label: this.i18n.t('stats'),
              color: 'yellow',
              onClick: () => this.open(this.statisticsScreen()),
            },
            {
              id: 'settings',
              label: this.i18n.t('settings'),
              color: 'pink',
              onClick: () => this.showSettingsMenu(),
            },
          ],
        }),
      }),
    };
  }

  /** Opens a screen over the one on show. */
  private open(entry: ScreenEntry): void {
    this.stack.push(entry);
  }

  /**
   * The player's record: the overall one, then wins at each difficulty, then the challenges
   * passed (they don't count toward the rest).
   */
  public showStatistics(): void {
    this.stack.reset(this.mainMenu(), this.statisticsScreen());
  }

  private statisticsScreen(): ScreenEntry {
    return {
      id: 'stats',
      view: () => {
        const stats = this.statistics.get();
        const t = (key: Parameters<I18nManager['t']>[0]) => this.i18n.t(key) as string;
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
                    label: this.i18n.getDifficultyInfo(level)[0],
                    value: `${won} / ${played}`,
                  };
                }),
              },
              {
                heading: t('challengesHeading'),
                rows: [{ label: t('challengesPassed'), value: this.passedCount() }],
              },
            ],
            resetLabel: t('resetStats'),
            resetConfirmLabel: t('resetStatsConfirm'),
            // The profile is a signal: wiped, the screen shows it by itself
            onReset: () => this.statistics.reset(),
            backLabel: t('back'),
            onBack: this.back,
          }),
        };
      },
    };
  }

  /** The PLAY menu: a button per mode, those not playable yet switched off. */
  public showPlayMenu(): void {
    this.stack.reset(this.mainMenu(), this.playMenu());
  }

  private playMenu(): ScreenEntry {
    return {
      id: 'play',
      scene: null,
      view: () => ({
        title: this.i18n.t('mode'),
        subtitle: '',
        body: h(PlayMenu, {
          modes: MODE_IDS.map((id) => ({
            id,
            name: this.i18n.getModeName(id),
            color: MODE_COLORS[id],
            isPlayable: MODES[id].isPlayable,
          })),
          backLabel: this.i18n.t('back'),
          onPick: (mode) => this.pickMode(mode),
          onBack: this.back,
        }),
      }),
    };
  }

  private pickMode(mode: ModeId): void {
    if (mode === 'quick') this.open(this.quickMatchSetup());
    if (mode === 'challenges') this.open(this.challengeList());
  }

  /** "4 / 9": the challenges passed, of them all. */
  private passedCount(): string {
    return `${this.challenges.get().passed.length} / ${CHALLENGE_IDS.length}`;
  }

  /** Every challenge in the order they open, the count of those passed under the title. */
  public showChallengeList(): void {
    this.stack.reset(this.mainMenu(), this.playMenu(), this.challengeList());
  }

  private challengeList(): ScreenEntry {
    return {
      id: 'challenges',
      scene: null,
      view: () => {
        const progress = this.challenges.get();
        return {
          title: this.i18n.getModeName('challenges'),
          subtitle: `${this.i18n.t('challengesPassed')}: ${this.passedCount()}`,
          body: h(ChallengeList, {
            challenges: CHALLENGE_IDS.map((id) => ({
              id,
              name: this.i18n.getChallengeInfo(id)[0],
              state: challengeState(progress, id),
            })),
            backLabel: this.i18n.t('back'),
            onPick: (id) => this.open(this.challengeCard(id)),
            onBack: this.back,
          }),
        };
      },
    };
  }

  /**
   * A challenge's card: its name and its description (which says what sets its match apart), START
   * and BACK. A passed one is marked so, and can be played again. Its reward (money) joins it with
   * the economy (stage 6).
   */
  public showChallengeCard(challenge: ChallengeId): void {
    this.stack.reset(
      this.mainMenu(),
      this.playMenu(),
      this.challengeList(),
      this.challengeCard(challenge),
    );
  }

  private challengeCard(challenge: ChallengeId): ScreenEntry {
    return {
      id: `challenge:${challenge}`,
      // The card shows the challenge on its own backdrop, its song with it
      scene: CHALLENGES[challenge].scene,
      view: () => {
        const [name, description] = this.i18n.getChallengeInfo(challenge);
        const isPassed = challengeState(this.challenges.get(), challenge) === 'passed';
        return {
          title: name,
          subtitle: description,
          body: h(ChallengeCard, {
            passedLabel: isPassed ? this.i18n.t('attemptPassed') : null,
            startLabel: this.i18n.t('start'),
            backLabel: this.i18n.t('back'),
            onStart: () => this.actions.onStartChallenge(challenge),
            onBack: this.back,
          }),
        };
      },
    };
  }

  /**
   * How an attempt went, in place of the game-over menu. Passed: NEXT (on to the next one's card)
   * and the list, with a flourish once every challenge is passed. Not passed: what it fell short
   * by, TRY AGAIN and the list.
   */
  public showChallengeResult({ verdict, isAllPassed }: ChallengeOutcome): void {
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

    this.stack.reset({
      id: 'challengeResult',
      view: () => ({
        title: this.i18n.t(isPassed ? 'attemptPassed' : 'attemptFailed'),
        subtitle: this.i18n.getChallengeInfo(challenge)[0],
        body: h(ChallengeResult, { message, isCelebration: isPassed && isAllPassed, actions }),
      }),
    });
  }

  /**
   * The quick match's setup: backdrop, difficulty and length, as last chosen; START plays it.
   * The difficulty's description stands under the title, as it did in the settings.
   */
  public showQuickMatchSetup(): void {
    // The classic look has no PLAY menu: its main menu opens the setup itself
    const way = this.look.value === 'classic' ? [] : [this.playMenu()];
    this.stack.reset(this.mainMenu(), ...way, this.quickMatchSetup());
  }

  private quickMatchSetup(): ScreenEntry {
    return {
      id: 'quickMatch',
      isMatchSetup: true,
      view: () => {
        const settings = this.settings.current;
        return {
          title: this.i18n.getModeName('quick'),
          subtitle: this.i18n.getDifficultyInfo(settings.difficulty)[1],
          body: h(QuickMatchSetup, {
            options: setupIn(this.look.value, QUICK_MATCH_SETUP).map((entry) =>
              this.choiceOf(entry, settings),
            ),
            previousLabel: this.i18n.t('previousChoice'),
            nextLabel: this.i18n.t('nextChoice'),
            startLabel: this.i18n.t('start'),
            backLabel: this.i18n.t('back'),
            onStart: () => this.actions.onStartQuickMatch(),
            onBack: this.back,
          }),
        };
      },
    };
  }

  /**
   * The setup of a match of two players on one device: backdrop and length, as last chosen; how
   * each steers stands under the title. START plays it.
   */
  public showTwoPlayerSetup(): void {
    this.stack.reset(this.mainMenu(), this.twoPlayerSetup());
  }

  private twoPlayerSetup(): ScreenEntry {
    return {
      id: 'twoPlayers',
      isMatchSetup: true,
      view: () => {
        const settings = this.settings.current;
        return {
          title: this.i18n.t('twoPlayers'),
          subtitle: this.i18n.t('twoPlayersHint'),
          body: h(QuickMatchSetup, {
            options: setupIn(this.look.value, TWO_PLAYER_SETUP()).map((entry) =>
              this.choiceOf(entry, settings),
            ),
            previousLabel: this.i18n.t('previousChoice'),
            nextLabel: this.i18n.t('nextChoice'),
            startLabel: this.i18n.t('start'),
            backLabel: this.i18n.t('back'),
            onStart: () => this.actions.onStartTwoPlayers?.(),
            onBack: this.back,
          }),
        };
      },
    };
  }

  public showPauseMenu(): void {
    this.stack.reset({
      id: 'pause',
      view: () => ({
        title: this.i18n.t('pause'),
        subtitle: '',
        body: h(ButtonMenu, {
          items: [
            {
              id: 'resume',
              label: this.i18n.t('resume'),
              onClick: () => this.actions.onResumeGame(),
            },
            {
              // The same match again from 0:0, set up as it was
              id: 'restart',
              label: this.i18n.t('restart'),
              color: 'yellow',
              onClick: () => (this.actions.onRestartGame ?? this.actions.onStartGame)(),
            },
            {
              id: 'settings',
              label: this.i18n.t('settings'),
              color: 'pink',
              onClick: () => this.showSettingsMenu(),
            },
            {
              id: 'menu',
              label: this.i18n.t('menu'),
              color: 'purple',
              onClick: () => this.actions.onReturnToMainMenu(),
            },
          ],
        }),
      }),
    });
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
    // Asked now: whether two played is the match's that has just ended
    const isTwoPlayers = this.actions.isTwoPlayerMatch?.() ?? false;
    this.stack.reset({
      id: 'gameOver',
      view: () => ({
        // With two players the winner is named; otherwise the left side is the player
        title: isTwoPlayers
          ? this.i18n.t(winnerIndex === 0 ? 'player1Wins' : 'player2Wins')
          : this.i18n.t(winnerIndex === 0 ? 'win' : 'lose'),
        subtitle: `${scores[0]} : ${scores[1]}`,
        body: h(ButtonMenu, {
          items: [
            { id: 'again', label: this.i18n.t('again'), onClick: () => this.actions.onStartGame() },
            {
              id: 'settings',
              label: this.i18n.t('settings'),
              color: 'pink',
              onClick: () => this.showSettingsMenu(),
            },
            {
              id: 'menu',
              label: this.i18n.t('menu'),
              color: 'purple',
              onClick: () => this.actions.onReturnToMainMenu(),
            },
          ],
        }),
      }),
    });
  }

  /**
   * Esc on a screen opened from another (the settings, the statistics, the PLAY menu, a match's
   * setup, a challenge's list or card): back to the one it was opened from, as its BACK button
   * does.
   * @returns whether it went back (false on the main menu, the pause and a match's end)
   */
  public goBack(): boolean {
    if (!this.uiManager.isMenuVisible) return false;
    return this.stack.back();
  }

  /**
   * The settings: music, sound and language, over the screen on show (the main menu, the pause,
   * a match's end), which BACK returns to. Nothing in them changes how a match plays (that is
   * the quick match's setup), so they open from the pause too.
   */
  public showSettingsMenu(): void {
    this.open({
      id: 'settings',
      view: () => {
        const settings = this.settings.current;
        return {
          title: this.i18n.t('settings'),
          subtitle: '',
          body: h(SettingsScreen, {
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
            onBack: this.back,
          }),
        };
      },
    });
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

  /** Switches one setting; the screen showing it is drawn again by itself. */
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
