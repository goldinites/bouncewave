import { getRallyHeat, getSpeedHeat } from '@/match/heat';
import { GameState } from '@/match/modes';
import { clamp } from '@/shared/math';

// Per sequencer step (~0.13 s), how quickly intensity follows the rally climax
const CLIMAX_INTENSITY_FOLLOW = 0.1;

/** What the music needs to know about the game, pushed in once per frame. */
export interface MusicState {
  gameState: GameState;
  serveTime: number;
  ballSpeed: number;
  /** Top ball speed of the current difficulty. */
  maxBallSpeed: number;
  rally: number;
  scores: [number, number];
  isMuted: boolean;
}

export const INITIAL_MUSIC_STATE: MusicState = {
  gameState: 'menu',
  serveTime: 0,
  ballSpeed: 0,
  maxBallSpeed: 1,
  rally: 0,
  scores: [0, 0],
  isMuted: false,
};

const MENU_INTENSITY = 0.35;
const SERVE_INTENSITY = 0.25;
// During a rally: base + range × (speed and rally heat), plus a late-match lift
const RALLY_BASE_INTENSITY = 0.25;
const RALLY_INTENSITY_RANGE = 0.65;
const SPEED_WEIGHT = 0.7;
const RALLY_WEIGHT = 0.3;
const LATE_MATCH_SCORE = 6;
const LATE_MATCH_BONUS = 0.1;
// Per sequencer step; intensity drifts slowly so the arrangement never lurches
const INTENSITY_FOLLOW = 0.025;

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
      const lateMatch = Math.max(...state.scores) >= LATE_MATCH_SCORE ? LATE_MATCH_BONUS : 0;
      return RALLY_BASE_INTENSITY + RALLY_INTENSITY_RANGE * clamp(heat, 0, 1) + lateMatch;
    }
  }
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
