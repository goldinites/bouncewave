import { MusicPlace } from '@/audio/music/score';
import type { SkillOwner } from '@/debug/SkillMenu';
import { I18nManager } from '@/i18n/I18nManager';
import { InputHandler } from '@/input/InputHandler';
import { ChallengeId } from '@/match/challenges';
import { MatchFlow } from '@/match/MatchFlow';
import { MatchRules } from '@/match/rules';
import { SkillId } from '@/match/skills/Skill';
import { SceneId } from '@/shared/scenes';
import { Condition } from '@/ui/challengeTexts';

/** What a session reads from the game to set up and follow its matches. */
export interface SessionContext {
  readonly flow: MatchFlow;
  readonly input: InputHandler;
  readonly i18n: I18nManager;
  /** A quick match's rules as the player set it up, the look and a developer's pins applied. */
  quickRules(): MatchRules;
  /** The rules as the look plays them: the classic look has no Overdrive and no modifiers. */
  forLook(rules: MatchRules): MatchRules;
  /** The skills the player, or the CPU, brings to a match against the CPU. */
  skillsOf(owner: SkillOwner): readonly SkillId[];
}

/**
 * What is being played: a quick match, two people's, a challenge, the tutorial (and in stage 8 the
 * story). It starts its match and its restarts, and answers whatever about the match depends on
 * the mode, so `Game` never asks which mode it is. It lasts from the match's start until the
 * player leaves for the menus.
 */
export interface Session {
  /** The backdrop its matches are played on, or null for the player's. */
  readonly scene: SceneId | null;
  /** The music's place while it plays (the tutorial's own), or null for the backdrop's song. */
  readonly place: MusicPlace | null;
  /**
   * Whether two people play it at one device: shown in landscape, its sides named, its end a win
   * for one of them.
   */
  readonly isTwoPlayers: boolean;
  /** The challenge its matches are attempts at, or null. */
  readonly challenge: ChallengeId | null;
  /** Whether its matches count in the player's statistics. */
  readonly isCounted: boolean;
  /** Whether the point that wins its match may be replayed. */
  readonly isReplayed: boolean;
  /**
   * The paddle whose perfect zone is marked on the court (the tutorial's, while it teaches perfect
   * hits), or null.
   */
  readonly perfectZoneMark: number | null;
  /** Puts its match on court from 0:0. */
  start(): void;
  /** The line over the court while its match is on: a goal's progress, a step, a clock. */
  condition(): Condition | null;
  /** Each frame its match is on and not paused. */
  update(dt: number): void;
  /** Its match resumes from the pause or a card. */
  onResume(): void;
}
