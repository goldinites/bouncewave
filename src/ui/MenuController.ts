import { effect, ReadonlySignal, signal, untracked } from '@preact/signals-core';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { I18nManager } from '@/i18n/I18nManager';
import { ChallengeId } from '@/match/challenges';
import { MatchEvent } from '@/match/MatchFlow';
import { TutorialCard } from '@/match/tutorial';
import { getEmptyChallengeProgress } from '@/profile/ChallengeProgress';
import { getEmptyStatistics } from '@/profile/Statistics';
import { SettingsStore } from '@/settings/SettingsStore';
import { EventBus } from '@/shared/EventBus';
import { Look } from '@/shared/look';
import { ChallengeMenus } from '@/ui/menus/ChallengeMenus';
import { MainMenus } from '@/ui/menus/MainMenus';
import { MatchMenus } from '@/ui/menus/MatchMenus';
import {
  ChallengeOutcome,
  ChallengeProgressAccess,
  GameMenuActions,
  MenuContext,
  StatisticsAccess,
} from '@/ui/menus/MenuContext';
import { ModeMenus } from '@/ui/menus/ModeMenus';
import { SettingsMenus } from '@/ui/menus/SettingsMenus';
import { TutorialMenus } from '@/ui/menus/TutorialMenus';
import { ScreenEntry, ScreenStack, ScreenView } from '@/ui/ScreenStack';
import { UIManager } from '@/ui/UIManager';

export type {
  ChallengeOutcome,
  ChallengeProgressAccess,
  GameMenuActions,
  StatisticsAccess,
} from '@/ui/menus/MenuContext';

/**
 * Every menu of the game, each a Preact screen on a stack (`ScreenStack`): a button opens a
 * screen over the one on show, BACK and Esc step back down to the one it was opened from. The
 * screen on show is drawn in an effect, so a setting, the profile or the look changing (from the
 * menu or from outside it: the M key, the classic look's easter egg) draws it again by itself.
 * The classic look plays only a quick match and a match of two: its main menu offers just those,
 * and their setups have no backdrop to choose.
 *
 * The screens are built by sections (`ui/menus/`), each from the same `MenuContext`; this keeps
 * the stack, draws its top and is the way into each section from outside the menus.
 */
export class MenuController {
  private readonly uiManager: UIManager;
  private readonly sfx: SoundEffects;
  private readonly actions: GameMenuActions;
  private readonly stack = new ScreenStack();
  private readonly main: MainMenus;
  private readonly modes: ModeMenus;
  private readonly tutorial: TutorialMenus;
  private readonly challenges: ChallengeMenus;
  private readonly settingsMenus: SettingsMenus;
  private readonly match: MatchMenus;
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
    this.sfx = sfx;
    uiManager.onMenuSound = (sound) =>
      sound === 'move' ? sfx.playMenuMove() : sfx.playMenuSelect();
    this.actions = actions;

    const context: MenuContext = {
      ui: uiManager,
      i18n,
      settings,
      actions,
      statistics,
      challenges,
      look,
      routes: {
        main: () => this.main.main(),
        play: () => this.modes.play(),
        playOrTutorialOffer: () =>
          actions.isTutorialOffered?.() ? this.tutorial.offer() : this.modes.play(),
        quickMatchSetup: () => this.modes.quickMatchSetup(),
        twoPlayerSetup: () => this.modes.twoPlayerSetup(),
        statistics: () => this.main.statistics(),
        challenges: () => this.challenges.fromPlay(),
        openSettings: () => this.showSettingsMenu(),
      },
      open: (entry) => this.stack.push(entry),
      reset: (...entries) => this.stack.reset(...entries),
      back: () => {
        if (this.stack.back()) this.sfx.playMenuBack();
      },
    };
    this.main = new MainMenus(context);
    this.modes = new ModeMenus(context);
    this.tutorial = new TutorialMenus(context);
    this.challenges = new ChallengeMenus(context);
    this.settingsMenus = new SettingsMenus(context);
    this.match = new MatchMenus(context);

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

  public showMainMenu(): void {
    this.stack.reset(this.main.main());
  }

  /**
   * The player's record: the overall one, then wins at each difficulty, then the challenges
   * passed (they don't count toward the rest).
   */
  public showStatistics(): void {
    this.stack.reset(this.main.main(), this.main.statistics());
  }

  /** The PLAY menu: a button per mode, those not playable yet switched off. */
  public showPlayMenu(): void {
    this.stack.reset(this.main.main(), this.modes.play());
  }

  /**
   * The card that opens a tutorial step, over the paused match; GOT IT (or Esc, as from the
   * pause) plays it.
   */
  public showTutorialCard(card: TutorialCard, onOk: () => void): void {
    this.stack.reset(this.tutorial.card(card, onOk));
  }

  /** The tutorial's end: on to a quick match, or back to the menu. */
  public showTutorialDone(): void {
    this.stack.reset(this.tutorial.done());
  }

  /** Every challenge in the order they open, the count of those passed under the title. */
  public showChallengeList(): void {
    this.challenges.showList();
  }

  /** A challenge's card: START plays it, BACK goes to the list. */
  public showChallengeCard(challenge: ChallengeId): void {
    this.challenges.showCard(challenge);
  }

  /** How an attempt went, in place of the game-over menu. */
  public showChallengeResult(outcome: ChallengeOutcome): void {
    this.stack.reset(this.challenges.result(outcome));
  }

  /** The quick match's setup: backdrop, difficulty and length, as last chosen; START plays it. */
  public showQuickMatchSetup(): void {
    // The classic look has no PLAY menu: its main menu opens the setup itself
    const way = this.main.isClassic ? [] : [this.modes.play()];
    this.stack.reset(this.main.main(), ...way, this.modes.quickMatchSetup());
  }

  /** The setup of a match of two players on one device; START plays it. */
  public showTwoPlayerSetup(): void {
    this.stack.reset(this.main.main(), this.modes.twoPlayerSetup());
  }

  public showPauseMenu(): void {
    this.stack.reset(this.match.pause());
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
    this.stack.reset(this.match.gameOver(winnerIndex, scores));
  }

  /**
   * Esc on a screen opened from another (the settings, the statistics, the PLAY menu, a match's
   * setup, a challenge's list or card): back to the one it was opened from, as its BACK button
   * does.
   * @returns whether it went back (false on the main menu, the pause and a match's end)
   */
  public goBack(): boolean {
    if (!this.uiManager.isMenuVisible) return false;
    const isBack = this.stack.back();
    if (isBack) this.sfx.playMenuBack();
    return isBack;
  }

  /**
   * The settings over the screen on show (the main menu, the pause, a match's end), which BACK
   * returns to.
   */
  public showSettingsMenu(): void {
    this.stack.push(this.settingsMenus.settings());
  }
}
