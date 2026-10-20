import { Ball } from '@/match/Ball';
import { GameState } from '@/match/GameState';
import { Paddle } from '@/match/Paddle';
import { Scores } from '@/match/side';
import { TimeWarp } from '@/match/skills/SkillSet';
import { BackgroundMood } from '@/render/backgrounds/Background';
import { FinalScoreSign } from '@/render/FinalScoreRenderer';
import { HudCondition } from '@/render/HudRenderer';
import { ParticleView } from '@/render/particles';

/** What is on the court, as it stands at the moment drawn. */
export interface CourtView {
  gameState: GameState;
  /** The AI-vs-AI demo behind the menus (no HUD). */
  isDemo: boolean;
  /** Every paddle on the court; the player plays the left side's first. */
  paddles: readonly Paddle[];
  /** Points each side has won. */
  scores: Scores;
  /** Every ball on court. */
  balls: readonly Ball[];
  /** The one the camera closes in on: the ball about to decide the point. */
  ball: Ball;
  time: number;
  serveTime: number;
  rally: number;
  /** Whoever is slowing the world down (Reflex); null when no one is. */
  timeWarp: TimeWarp | null;
}

/** What the HUD writes over the court. */
export interface HudView {
  readyText: string;
  /** A challenge's condition under the score ("RALLY 12 / 20 · 0:41"); null for none. */
  condition: HudCondition | null;
  /** Whether its line is drawn on the court; elsewhere the strip above it shows the line. */
  isConditionOnCourt: boolean;
  /** Each side's label under its score, [left, right]; null to show none (only two players have them). */
  sideLabels: readonly [string, string] | null;
  /**
   * Charges in each paddle's Overdrive meter (0..OVERDRIVE.CHARGE), in the order of `paddles`;
   * null for a paddle that shows none (the CPU's, every one under rules without Overdrive).
   */
  overdriveCharges: readonly (number | null)[];
  /**
   * The perfect hits in a row in each meter, lit brighter than the rest of its charges: the same
   * as `overdriveCharges` unless an implants' core keeps charges a broken streak left.
   */
  overdriveStreaks: readonly (number | null)[];
  /** What a slowed world is labelled (Reflex's glitch). */
  timeWarpLabel: string;
}

/** How the drama presents the moment (fx/EffectsDirector). */
export interface DramaView {
  /** Rally climax intensity in [0, 1]: lasers stay lit and the ball burns hotter. */
  climax: number;
  /** Edge darkening from the deciding-point drama: 0 = none, may go above 1 on a heartbeat. */
  vignette: number;
  /** Camera zoom centered on the ball (1 = none). */
  zoom: number;
  /** Hit glow of each paddle in [0, 1], in the order of `paddles`. */
  paddleGlow: readonly number[];
  /** How far each paddle leans, in radians, positive clockwise (a whip off a spinning hit). */
  paddleTilt: readonly number[];
}

/** Everything the renderer needs to draw (and animate toward) one frame, by who reads it. */
export interface RenderFrame {
  court: CourtView;
  hud: HudView;
  drama: DramaView;
  particles: ParticleView;
  analyser: AnalyserNode | null;
  isRotated: boolean;
}

/** What the renderer itself keeps between frames, for the scene to draw with. */
export interface SceneState {
  /** The final score, once the match is over; the HUD and meters give way to it. */
  finalSign: FinalScoreSign | null;
  /** Seconds the final score has been up. */
  finalSignAge: number;
  /** The darkening behind the menus, in [0, 1]. */
  menuDim: number;
  /** How hard the screen shakes, in px. */
  shake: number;
  /** The white flash, in [0, 1]. */
  flash: number;
  /** The backdrop's mood (BackdropMood). */
  mood: BackgroundMood;
  /** Wall-clock seconds since the last frame, paused frames included. */
  realDt: number;
}

/** A whole look's picture of a frame: the neon scene, or the classic one. */
export interface Scene {
  render(ctx: CanvasRenderingContext2D, frame: RenderFrame, state: SceneState): void;
}
