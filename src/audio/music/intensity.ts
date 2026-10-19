import { Tier } from '@/audio/music/score';
import { getRallyHeat, getSpeedHeat } from '@/match/heat';
import { GameState } from '@/match/GameState';
import { DifficultyLevel } from '@/match/difficulty';
import { STANDARD_RULES } from '@/match/rules';
import { Scores } from '@/match/side';
import { clamp } from '@/shared/math';

// Per sequencer step (~0.13 s), how quickly intensity follows the rally climax
const CLIMAX_INTENSITY_FOLLOW = 0.1;
// The music lets a rally climax die away more slowly than the screen does: once the game's
// climax drops, the climax layers and the intensity they lend fade over this many seconds
export const MUSIC_CLIMAX_RELEASE = 8;

/** What the music needs to know about the game, pushed in once per frame. */
export interface MusicState {
  gameState: GameState;
  serveTime: number;
  ballSpeed: number;
  /** Top ball speed of the current difficulty. */
  maxBallSpeed: number;
  rally: number;
  scores: [number, number];
  /** Points that win the match being played, for each side. */
  winningScores: Scores;
  isMuted: boolean;
  difficulty: DifficultyLevel;
}

export const INITIAL_MUSIC_STATE: MusicState = {
  gameState: 'menu',
  serveTime: 0,
  ballSpeed: 0,
  maxBallSpeed: 1,
  rally: 0,
  scores: [0, 0],
  winningScores: STANDARD_RULES.winningScores,
  isMuted: false,
  difficulty: DifficultyLevel.EASY,
};

const MENU_INTENSITY = 0.35;
const SERVE_INTENSITY = 0.25;
// During a rally: base + range × (speed and rally heat), plus a late-match lift
const RALLY_BASE_INTENSITY = 0.25;
const RALLY_INTENSITY_RANGE = 0.65;
const SPEED_WEIGHT = 0.7;
const RALLY_WEIGHT = 0.3;
// Late in the match: either side has this share of the points that win it for that side
// (6 of 10, 2 of 3)
const LATE_MATCH_SHARE = 0.6;
const LATE_MATCH_BONUS = 0.1;
// Per sequencer step; intensity drifts slowly so the arrangement never lurches
const INTENSITY_FOLLOW = 0.025;
// The chorus takes over above this intensity or climax, and lets go only once intensity falls
// below the lower bar, so a rally hovering at the edge doesn't bounce between sections
const HIGH_INTENSITY = 0.7;
const HIGH_RELEASE_INTENSITY = 0.55;
const HIGH_CLIMAX = 0.25;

/** Where intensity is heading for the current game state. Paused holds the current value. */
export function getTargetIntensity(state: MusicState, current: number): number {
  switch (state.gameState) {
    case 'paused':
      return current;
    case 'menu':
      return MENU_INTENSITY;
    case 'play': {
      if (state.serveTime > 0) return SERVE_INTENSITY;

      const heat =
        getSpeedHeat(state.ballSpeed, state.maxBallSpeed) * SPEED_WEIGHT +
        getRallyHeat(state.rally) * RALLY_WEIGHT;
      const isLate = state.scores.some(
        (score, side) => score >= LATE_MATCH_SHARE * state.winningScores[side],
      );
      const lateMatch = isLate ? LATE_MATCH_BONUS : 0;
      return RALLY_BASE_INTENSITY + RALLY_INTENSITY_RANGE * clamp(heat, 0, 1) + lateMatch;
    }
  }
}

/**
 * The music's own climax level: rises with the game's at once (the build-up and the drop stay
 * in sync with the screen), but falls no faster than MUSIC_CLIMAX_RELEASE allows.
 */
export function followClimax(musicLevel: number, gameLevel: number, dt: number): number {
  return Math.max(gameLevel, musicLevel - dt / MUSIC_CLIMAX_RELEASE);
}

/**
 * One sequencer step of intensity smoothing. A rally climax pulls it toward full,
 * in step with the climax build-up level, faster than the usual drift.
 */
export function stepIntensity(
  current: number,
  target: number,
  climaxLevel: number,
  gameState: GameState,
): number {
  if (climaxLevel > 0 && gameState === 'play') {
    const climaxTarget = target + (1 - target) * climaxLevel;
    return current + (climaxTarget - current) * CLIMAX_INTENSITY_FOLLOW;
  }
  return current + (target - current) * INTENSITY_FOLLOW;
}

/**
 * Which kind of section the game calls for: calm in the menu, the groove during play and the
 * chorus when a rally gets hot. Paused holds on to whatever is playing.
 */
export function getWantedTier(
  gameState: GameState,
  intensity: number,
  climaxLevel: number,
  current: Tier,
): Tier {
  if (gameState === 'menu') return 'calm';

  const isHigh = current === 'high' || current === 'rise';
  if (gameState === 'paused') return isHigh ? 'high' : current;

  const threshold = isHigh ? HIGH_RELEASE_INTENSITY : HIGH_INTENSITY;
  return climaxLevel > HIGH_CLIMAX || intensity > threshold ? 'high' : 'groove';
}
