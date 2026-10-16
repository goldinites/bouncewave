import { AiController, SHOT_THREAT } from '@/match/AiController';
import { AiForm } from '@/match/AiForm';
import { Ball } from '@/match/Ball';
import { BALL, WINNING_SCORE } from '@/match/config';
import { AiSkill, DEMO_AI_SKILL, DIFFICULTY_CONFIGS, DifficultyLevel } from '@/match/difficulty';
import { GameState } from '@/match/GameState';
import { Paddle } from '@/match/Paddle';
import { OVERDRIVE, Overdrive } from '@/match/Overdrive';
import { Physics, PhysicsEvent } from '@/match/Physics';

// Seconds the ball waits at center before each kind of serve
export const SERVE_DELAY = {
  NORMAL: 1.2,
  START: 1.5,
  DEMO: 0.5,
  GAME_OVER: 0.8,
} as const;

// End-of-match cutscene (seconds); the canvas stays live throughout
export const FINALE = {
  WIN_DURATION: 2.4,
  LOSS_DURATION: 1.9,
  SKIP_AFTER: 0.6, // tap/key can skip once this has passed
} as const;

/**
 * - `attract`: AI-vs-AI demo behind the menus
 * - `serving`: a match is on, the ball waits at center for the serve countdown
 * - `rally`: the ball is in play
 * - `paused`: a match is frozen behind the pause menu
 * - `finale`: the match is decided; play is frozen while the end cutscene runs
 */
export type MatchPhase = 'attract' | 'serving' | 'rally' | 'paused' | 'finale';

export type MatchEvent =
  | { type: 'matchStart' }
  | { type: 'returnToMenu' }
  | { type: 'serve' }
  | { type: 'wallBounce'; x: number; y: number }
  | {
      type: 'paddleHit';
      paddleIndex: 0 | 1;
      isPerfect: boolean;
      x: number;
      y: number;
      speed: number;
      /** Rally length including this hit. */
      rally: number;
      /** The player's Overdrive went off on this hit. */
      isPowerShot: boolean;
      /** This hit filled the player's Overdrive meter. */
      chargedOverdrive: boolean;
    }
  | { type: 'score'; scoringPlayerIndex: 0 | 1; y: number; isDemo: boolean }
  | { type: 'finaleStart'; winnerIndex: 0 | 1; ballY: number; scores: [number, number] }
  | { type: 'gameOver'; winnerIndex: 0 | 1; scores: [number, number] };

/** Anything that can steer the player's paddle (keyboard, pointer, touch). */
export interface PlayerInput {
  pollPlayerMovement(paddle: Paddle, dt: number): void;
}

export interface MatchFlowDeps {
  paddles: [Paddle, Paddle];
  ball: Ball;
  input: PlayerInput;
  getDifficulty: () => DifficultyLevel;
  /** Called synchronously, in order, for everything that happens. */
  onEvent: (event: MatchEvent) => void;
  random?: () => number;
}

/**
 * The rules and timing of a match: phases, serves, scoring, the finale timer, and the
 * simulation step (input, AI, physics). It knows nothing about sound or pixels; it reports
 * what happened through `onEvent` and the presentation reacts.
 */
export class MatchFlow {
  private _phase: MatchPhase = 'attract';
  private resumePhase: MatchPhase = 'serving';
  private _serveTime = 0;
  private _rally = 0;
  private _time = 0;

  private finaleWinner: 0 | 1 = 0;
  private finaleElapsed = 0;
  private finaleDuration = 0;

  private readonly ai: AiController;
  /** The CPU's form in a match: drifts with the score, see AiForm. */
  private readonly aiForm = new AiForm();
  /** How the CPU plays this point; picked on every serve. */
  private aiSkill: AiSkill = DEMO_AI_SKILL;
  /** The player's Overdrive meter; only fills in a real match. */
  private readonly overdrive = new Overdrive();
  private readonly paddles: [Paddle, Paddle];
  private readonly ball: Ball;
  private readonly input: PlayerInput;
  private readonly getDifficulty: () => DifficultyLevel;
  private readonly emit: (event: MatchEvent) => void;
  private readonly random: () => number;

  constructor(deps: MatchFlowDeps) {
    this.paddles = deps.paddles;
    this.ball = deps.ball;
    this.input = deps.input;
    this.getDifficulty = deps.getDifficulty;
    this.emit = deps.onEvent;
    this.random = deps.random ?? Math.random;
    this.ai = new AiController(this.random);
  }

  public get phase(): MatchPhase {
    return this._phase;
  }

  /** Seconds left before the ball is served (0 once it is in play). */
  public get serveTime(): number {
    return this._serveTime;
  }

  /** Charges in the player's Overdrive meter, 0..OVERDRIVE.CHARGE. */
  public get overdriveCharge(): number {
    return this.overdrive.charge;
  }

  public get rally(): number {
    return this._rally;
  }

  /** Simulation clock; drives time-based animation. */
  public get time(): number {
    return this._time;
  }

  /** The AI-vs-AI demo behind the menus is running, not a match. */
  public get isDemo(): boolean {
    return this._phase === 'attract';
  }

  /** Coarse state for audio and rendering, which only care about menu / play / paused. */
  public get gameState(): GameState {
    if (this._phase === 'attract') return 'menu';
    if (this._phase === 'paused') return 'paused';
    return 'play';
  }

  /** A real match is being played right now (not demo, paused or finished). */
  public get isMatchActive(): boolean {
    return this._phase === 'serving' || this._phase === 'rally';
  }

  /** The ball is moving on court (demo included). */
  public get isBallLive(): boolean {
    return (this._phase === 'attract' || this._phase === 'rally') && this._serveTime <= 0;
  }

  public startAttract(): void {
    this._phase = 'attract';
    this.serve(1, SERVE_DELAY.DEMO);
  }

  public startMatch(): void {
    this.emit({ type: 'matchStart' });
    this.resetScores();
    this._phase = 'serving';
    this.serve(this.random() < 0.5 ? 1 : -1, SERVE_DELAY.START);
  }

  public returnToMenu(): void {
    this.emit({ type: 'returnToMenu' });
    this.resetScores();
    this.startAttract();
  }

  /** @returns whether the match was paused (only possible while one is being played) */
  public pause(): boolean {
    if (!this.isMatchActive) return false;
    this.resumePhase = this._phase;
    this._phase = 'paused';
    return true;
  }

  public resume(): boolean {
    if (this._phase !== 'paused') return false;
    this._phase = this.resumePhase;
    return true;
  }

  /** Ends the finale early, once its key moment has played. @returns whether it ended */
  public skipFinale(): boolean {
    if (this._phase !== 'finale' || this.finaleElapsed < FINALE.SKIP_AFTER) return false;
    this.finishFinale();
    return true;
  }

  /** Advances the simulation by `dt` seconds. Does nothing while paused. */
  public update(dt: number): void {
    if (this._phase === 'paused') return;

    this._time += dt;

    if (this._phase === 'finale') {
      // Paddles stay put but settle; the ball is already out of play
      this.paddles.forEach((p) => p.update(dt));
      this.finaleElapsed += dt;
      if (this.finaleElapsed >= this.finaleDuration) {
        this.finishFinale();
      }
      return;
    }

    const difficulty = DIFFICULTY_CONFIGS[this.getDifficulty()];
    this.updatePaddles(dt);

    if (this._serveTime > 0) {
      this._serveTime -= dt;
      if (this._serveTime <= 0 && this._phase === 'serving') {
        this._phase = 'rally';
      }
    } else {
      this.ball.updateTrail();
      for (const event of Physics.step(this.ball, this.paddles, difficulty, dt)) {
        this.handlePhysicsEvent(event);
      }
    }

    // Radius grows with rally and speed, and also affects collisions, so it is simulation
    this.ball.updateRadius(dt, this._rally, difficulty.maxSpeed);
  }

  private updatePaddles(dt: number): void {
    const [player, cpu] = this.paddles;
    const skill = this.aiSkill;

    if (this.isDemo) {
      this.ai.update(player, this.ball, skill, dt, cpu);
    } else {
      this.input.pollPlayerMovement(player, dt);
    }
    this.ai.update(cpu, this.ball, skill, dt, player);

    this.paddles.forEach((p) => p.update(dt));
  }

  private handlePhysicsEvent(event: PhysicsEvent): void {
    switch (event.type) {
      case 'wallBounce':
        this.emit(event);
        break;
      case 'paddleHit': {
        this._rally++;
        const isPlayerHit = event.paddleIndex === 0 && !this.isDemo;
        const wasCharged = this.overdrive.isCharged;
        const isPowerShot = isPlayerHit && this.overdrive.onHit(event.isPerfect);
        const chargedOverdrive = isPlayerHit && !wasCharged && this.overdrive.isCharged;

        this.ball.isPowerShot = isPowerShot;
        if (isPowerShot) {
          this.ball.applyBoost(OVERDRIVE.BOOST, OVERDRIVE.BOOST_DURATION);
        }

        // The other paddle now has to read the return, the harder the better it was hit
        const threat = isPowerShot
          ? SHOT_THREAT.POWER
          : event.isPerfect
            ? SHOT_THREAT.PERFECT
            : SHOT_THREAT.NORMAL;
        this.ai.readShot(this.paddles[1 - event.paddleIndex], this.aiSkill, threat);
        this.emit({ ...event, rally: this._rally, isPowerShot, chargedOverdrive });
        break;
      }
      case 'score':
        this.handleScore(event.scoringPlayerIndex, event.y);
        break;
    }
  }

  private handleScore(scorer: 0 | 1, y: number): void {
    const nextServe = scorer === 0 ? 1 : -1;

    if (this._phase === 'attract') {
      this.emit({ type: 'score', scoringPlayerIndex: scorer, y, isDemo: true });
      this.serve(nextServe, SERVE_DELAY.DEMO);
      return;
    }

    this.paddles[scorer].score++;
    this.aiForm.onPoint(scorer);
    this.emit({ type: 'score', scoringPlayerIndex: scorer, y, isDemo: false });

    if (this.paddles[scorer].score >= WINNING_SCORE) {
      this.beginFinale(scorer, y);
      return;
    }

    this._phase = 'serving';
    this.serve(nextServe, SERVE_DELAY.NORMAL);
  }

  private beginFinale(winner: 0 | 1, ballY: number): void {
    this._phase = 'finale';
    this.finaleWinner = winner;
    this.finaleElapsed = 0;
    this.finaleDuration = winner === 0 ? FINALE.WIN_DURATION : FINALE.LOSS_DURATION;

    this.emit({ type: 'finaleStart', winnerIndex: winner, ballY, scores: this.scores });
  }

  private finishFinale(): void {
    const winner = this.finaleWinner;
    this._phase = 'attract';

    this.emit({ type: 'gameOver', winnerIndex: winner, scores: this.scores });
    this.serve(winner === 0 ? 1 : -1, SERVE_DELAY.GAME_OVER);
  }

  private serve(direction: number, delay: number): void {
    this.ball.serve(direction, BALL.INITIAL_SPEED);
    // The receiver reads the serve like any other shot
    this.aiSkill = this.pickAiSkill();
    this.ai.readShot(this.paddles[direction > 0 ? 1 : 0], this.aiSkill);
    this._rally = 0;
    this._serveTime = delay;
    this.emit({ type: 'serve' });
  }

  /**
   * The demo plays at its own level; in a match the CPU plays at the chosen difficulty, in
   * whatever form the score has put it.
   */
  private pickAiSkill(): AiSkill {
    if (this.isDemo) return DEMO_AI_SKILL;

    const level = this.getDifficulty();
    this.aiForm.update(this.scores, DIFFICULTY_CONFIGS[level].adaptivity);
    return this.aiForm.skillFor(level);
  }

  private resetScores(): void {
    this.paddles.forEach((p) => p.resetScore());
    this.ai.reset();
    this.aiForm.reset();
    this.overdrive.reset();
  }

  private get scores(): [number, number] {
    return [this.paddles[0].score, this.paddles[1].score];
  }
}
