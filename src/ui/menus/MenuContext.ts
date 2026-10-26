import { ReadonlySignal } from '@preact/signals-core';
import { I18nManager } from '@/i18n/I18nManager';
import { ChallengeVerdict } from '@/match/ChallengeJudge';
import { ChallengeId } from '@/match/challenges';
import { ChallengeProgress } from '@/profile/ChallengeProgress';
import { Statistics } from '@/profile/Statistics';
import { SettingsStore } from '@/settings/SettingsStore';
import { Look } from '@/shared/look';
import { SceneId } from '@/shared/scenes';
import { ScreenEntry } from '@/ui/ScreenStack';
import { UIManager } from '@/ui/UIManager';

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
  /** Starts the tutorial (step 4.8). */
  onStartTutorial?: () => void;
  /**
   * Whether PLAY offers the tutorial first: to someone who has neither gone through it nor turned
   * it down. Never when left out.
   */
  isTutorialOffered?: () => boolean;
  /** The tutorial offered was turned down (NO): it isn't offered again. */
  onDeclineTutorial?: () => void;
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
  /** The sound volume was stepped: a hit plays at the new volume, as sounds play only in a match. */
  onSoundVolume?: () => void;
  /** The quick match's setup came on screen (true) or gave way to another (false). */
  onQuickMatchSetup?: (isShown: boolean) => void;
  /**
   * A menu came on screen that wants a backdrop behind it: a challenge's card its challenge's
   * own, the main menu, the PLAY menu and the challenges' list the player's (null). Menus that
   * belong to a match (pause, its end, an attempt's result) leave the backdrop as it is.
   */
  onMenuScene?: (scene: SceneId | null) => void;
}

/** The screens one section of the menus leads to in another. */
export interface MenuRoutes {
  main(): ScreenEntry;
  play(): ScreenEntry;
  /** The PLAY button: the tutorial offered first to someone new, the PLAY menu otherwise. */
  playOrTutorialOffer(): ScreenEntry;
  quickMatchSetup(): ScreenEntry;
  twoPlayerSetup(): ScreenEntry;
  statistics(): ScreenEntry;
  /** The challenges' list, on the tier of the first challenge still to pass. */
  challenges(): ScreenEntry;
  /** Opens the settings over the screen on show. */
  openSettings(): void;
}

/** What every section of the menus builds its screens from. */
export interface MenuContext {
  readonly ui: UIManager;
  readonly i18n: I18nManager;
  readonly settings: SettingsStore;
  readonly actions: GameMenuActions;
  readonly statistics: StatisticsAccess;
  readonly challenges: ChallengeProgressAccess;
  /** The game's look, which decides what the menus offer. */
  readonly look: ReadonlySignal<Look>;
  readonly routes: MenuRoutes;
  /** Opens a screen over the one on show. */
  open(entry: ScreenEntry): void;
  /** Shows the last screen given, the others the way back down to it. */
  reset(...entries: ScreenEntry[]): void;
  /** Back down the stack, as BACK does. */
  readonly back: () => void;
}
