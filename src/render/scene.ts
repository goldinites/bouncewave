import { Ball } from '@/match/Ball';
import { CourtConditions } from '@/match/court';
import { ModifierId } from '@/match/modifiers/Modifier';
import { GameState } from '@/match/GameState';
import { Paddle } from '@/match/Paddle';
import { Scores } from '@/match/side';
import { ShotRead } from '@/match/skills/Skill';
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
  /** The shots read ahead for their paddles (Analyzer): their flights and arrivals. */
  shotReads: readonly ShotRead[];
  /** The match's modifiers (none in the demo), and what they make the court do. */
  modifiers: readonly ModifierId[];
  conditions: CourtConditions;
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
  /** OVERTIME, while the rally on court is in it (match/overtime.ts); null otherwise. */
  overtimeText: string | null;
  /**
   * The paddle (an index into `paddles`) whose perfect zone glows, so a learner sees where to meet
   * the ball (the tutorial); null for none.
   */
  perfectZoneMark: number | null;
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
  /**
   * How brightly the charge each paddle's meter just lost still burns, in [0, 1], in the
   * order of `paddles`: the segment flares and goes out, so the player sees where it went.
   */
  meterSpent: readonly number[];
  /** How far each paddle leans, in radians, positive clockwise (a whip off a spinning hit). */
  paddleTilt: readonly number[];
  /** How far each paddle is knocked back toward its own goal by its last hit, px. */
  paddleRecoil: readonly number[];
  /** How far each paddle is shorted out by the point it just lost, in [0, 1]. */
  paddleOut: readonly number[];
  /** How white-hot each ball burns off a perfect hit, in [0, 1], by its place in `court.balls`. */
  ballWhiteHot: readonly number[];
  /** Each ball's squash off its last hit or bounce, by its place in `court.balls`; null for round. */
  ballSquash: readonly (Squash | null)[];
}

/** How a ball is squashed: along `axis` by `amount` (> 0 flattened, < 0 stretched). */
export interface Squash {
  axis: 'x' | 'y';
  amount: number;
}

/** The point that won the match shown again, slowed, in cinema bars (app/MatchReplay). */
export interface ReplayView {
  /** REPLAY, in the player's language. */
  label: string;
}

/** Everything the renderer needs to draw (and animate toward) one frame, by who reads it. */
export interface RenderFrame {
  court: CourtView;
  hud: HudView;
  drama: DramaView;
  particles: ParticleView;
  /** The replay being shown instead of the match; null when it is the match. */
  replay: ReplayView | null;
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
  /** Where a hit has knocked the court to, px: it is pushed the way the ball was struck. */
  kick: { x: number; y: number };
  /** Whether this frame is a power shot's impact frame: the whole picture inverted. */
  isImpactFrame: boolean;
  /** The backdrop's mood (BackdropMood). */
  mood: BackgroundMood;
  /** Wall-clock seconds since the last frame, paused frames included. */
  realDt: number;
}

/** A whole look's picture of a frame: the neon scene, or the classic one. */
export interface Scene {
  render(ctx: CanvasRenderingContext2D, frame: RenderFrame, state: SceneState): void;
}
