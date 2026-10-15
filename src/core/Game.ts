import { AudioEngine } from '@/audio/AudioEngine';
import { DIFFICULTY_CONFIGS } from '@/constants/difficulty.constants';
import {
  BALL_INITIAL_SPEED,
  COLORS,
  GAME_WIDTH,
  PADDLE_OFFSET_X,
  PADDLE_WIDTH,
  SERVE_DELAY_DEMO,
  SERVE_DELAY_GAME_OVER,
  SERVE_DELAY_NORMAL,
  SERVE_DELAY_START,
  WINNING_SCORE,
} from '@/constants/game.constants';
import {
  CLIMAX_EMBER_COLORS,
  CLIMAX_EMBER_RATE,
  FINAL_SEQUENCE_LOSS_DURATION,
  FINAL_SEQUENCE_SKIP_AFTER,
  FINAL_SEQUENCE_WIN_DURATION,
  FIREWORK_FLASH,
  FIREWORK_PARTICLES,
  FIREWORK_SHAKE,
  FIREWORK_SPEED,
  LOSS_DURATION,
  PARTICLE_SCORE_BURST_COUNT,
  PARTICLE_SCORE_BURST_SPEED,
  SCORE_SHOCKWAVE_EXPANSION_SPEED,
  SCREEN_FLASH_SCORE,
  SCREEN_FLASH_START,
  SCREEN_SHAKE_SCORE,
  VICTORY_DURATION,
} from '@/constants/visual.constants';
import { Ball } from '@/entities/Ball';
import { Paddle } from '@/entities/Paddle';
import { ParticleSystem } from '@/entities/ParticleSystem';
import { I18nManager } from '@/i18n/I18nManager';
import { Renderer } from '@/render/Renderer';
import { SettingsStorage } from '@/storage/SettingsStorage';
import { UserSettings } from '@/types/audio.types';
import { GameMode, GameState } from '@/types/game.types';
import { MenuController } from '@/ui/MenuController';
import { UIManager } from '@/ui/UIManager';
import { AiController } from '@/core/AiController';
import { InputHandler } from '@/core/InputHandler';
import { MatchPointDrama } from '@/core/MatchPointDrama';
import { RallyClimax } from '@/core/RallyClimax';
import { Physics } from '@/core/Physics';
import { VictoryFireworks } from '@/core/VictoryFireworks';
import { FpsMeter } from '@/debug/FpsMeter';

export class Game {
  private settings: UserSettings;
  private i18n: I18nManager;
  private audio: AudioEngine;
  private renderer: Renderer;
  private uiManager: UIManager;
  private inputHandler: InputHandler;
  private menuController: MenuController;

  private paddles: [Paddle, Paddle];
  private ball: Ball;
  private particleSystem: ParticleSystem;

  private gameState: GameState = 'menu';
  private previousState: GameState = 'play';
  private gameMode: GameMode = GameMode.DEMO;

  private gameTime = 0;
  private serveTime = 0;
  private rally = 0;
  private lastTimestamp = 0;
  private isRunning = false;

  private isFinalSequence = false;
  private finalWinnerIndex: number | null = null;
  private finalElapsed = 0;
  private finalDuration = 0;
  private fireworks: VictoryFireworks | null = null;

  private readonly fpsMeter = new FpsMeter();
  private readonly drama = new MatchPointDrama();
  private readonly climax = new RallyClimax();

  constructor(canvas: HTMLCanvasElement) {
    this.settings = SettingsStorage.load();
    this.i18n = new I18nManager(this.settings.language);

    this.audio = new AudioEngine(() => this.settings.soundMuted, {
      getGameState: () => this.gameState,
      getServeTime: () => this.serveTime,
      getBallSpeed: () => this.ball.speed,
      getRally: () => this.rally,
      getScores: () => [this.paddles[0].score, this.paddles[1].score],
      getDifficultyConfig: () => DIFFICULTY_CONFIGS[this.settings.difficulty],
      getIsMusicMuted: () => this.settings.musicMuted,
    });

    this.renderer = new Renderer(canvas);
    this.uiManager = new UIManager(this.i18n);

    this.inputHandler = new InputHandler(canvas, {
      onUnlockAudio: () => this.unlockAudio(),
      onTogglePause: () => this.togglePause(),
      onPress: () => this.skipFinalSequence(),
    });

    this.particleSystem = new ParticleSystem();

    const paddle1 = new Paddle(0, PADDLE_OFFSET_X, COLORS.CYAN);
    const paddle2 = new Paddle(1, GAME_WIDTH - PADDLE_OFFSET_X - PADDLE_WIDTH, COLORS.PINK);
    this.paddles = [paddle1, paddle2];

    this.ball = new Ball();

    this.menuController = new MenuController(
      this.uiManager,
      this.i18n,
      this.audio.sfx,
      this.settings,
      {
        onStartGame: () => this.start(GameMode.PLAYER_VS_AI),
        onResumeGame: () => this.resume(),
        onReturnToMainMenu: () => this.toMenu(),
        onUnlockAudio: () => this.unlockAudio(),
      },
    );

    this.uiManager.bindPauseButton(() => {
      this.unlockAudio();
      this.togglePause();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.gameState === 'play') {
        this.togglePause();
      }
    });
  }

  public init(): void {
    this.serve(1, SERVE_DELAY_DEMO);
    this.menuController.showMainMenu();
    this.uiManager.setPauseButtonVisibility(false);

    this.isRunning = true;
    this.lastTimestamp = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  public unlockAudio(): void {
    this.audio.unlock();
  }

  public start(mode: GameMode = GameMode.PLAYER_VS_AI): void {
    this.renderer.addFlash(SCREEN_FLASH_START);

    this.gameMode = mode;
    this.resetDrama();
    this.paddles[0].resetScore();
    this.paddles[1].resetScore();

    this.serve(Math.random() < 0.5 ? 1 : -1, SERVE_DELAY_START);
    this.gameState = 'play';
    this.uiManager.hideMenu();
    this.uiManager.setPauseButtonVisibility(true);
  }

  public toMenu(): void {
    this.audio.music.newSong();
    this.renderer.background.nextBackground();
    this.gameMode = GameMode.DEMO;
    this.resetDrama();
    this.paddles[0].resetScore();
    this.paddles[1].resetScore();

    this.serve(1, SERVE_DELAY_DEMO);
    this.gameState = 'menu';
    this.uiManager.setPauseButtonVisibility(false);
    this.menuController.showMainMenu();
  }

  public togglePause(): void {
    if (this.isFinalSequence) return;

    if (this.gameState === 'paused') {
      this.resume();
      return;
    }
    if (this.gameState !== 'play') return;

    this.previousState = this.gameState;
    this.gameState = 'paused';
    this.menuController.showPauseMenu();
  }

  public resume(): void {
    this.gameState = this.previousState;
    this.uiManager.hideMenu();
  }

  public serve(direction: number, delay = SERVE_DELAY_NORMAL): void {
    this.ball.serve(direction, BALL_INITIAL_SPEED);
    this.rally = 0;
    this.serveTime = delay;
    this.drama.onServe();
  }

  private resetDrama(): void {
    this.drama.reset();
    this.audio.music.setDramaLevel(0);
    this.renderer.vignette = 0;

    this.climax.reset();
    this.audio.music.setClimaxLevel(0);
    this.renderer.climax = 0;
  }

  /** Burning-ball embers during the rally climax. */
  private emitClimaxEmbers(dt: number): void {
    const expected = CLIMAX_EMBER_RATE * this.climax.level * dt;
    const count = Math.floor(expected + Math.random());

    for (let i = 0; i < count; i++) {
      const angle = Math.atan2(-this.ball.vy, -this.ball.vx) + (Math.random() - 0.5) * 1.6;
      const speed = 40 + Math.random() * 110;
      this.particleSystem.addParticle({
        x: this.ball.x + (Math.random() - 0.5) * this.ball.radius,
        y: this.ball.y + (Math.random() - 0.5) * this.ball.radius,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.3,
        color: CLIMAX_EMBER_COLORS[Math.floor(Math.random() * CLIMAX_EMBER_COLORS.length)],
        size: 1 + Math.random() * 2,
      });
    }
  }

  private handleScore(scoringPlayerIndex: number): void {
    const burstX = scoringPlayerIndex === 0 ? GAME_WIDTH - 6 : 6;
    const scoringPaddle = this.paddles[scoringPlayerIndex];

    this.particleSystem.burst(
      burstX,
      this.ball.y,
      scoringPaddle.color,
      PARTICLE_SCORE_BURST_COUNT,
      PARTICLE_SCORE_BURST_SPEED,
    );
    this.particleSystem.shockwave(
      burstX,
      this.ball.y,
      scoringPaddle.color,
      SCORE_SHOCKWAVE_EXPANSION_SPEED,
    );

    this.renderer.addShake(SCREEN_SHAKE_SCORE);
    this.renderer.addFlash(SCREEN_FLASH_SCORE);

    if (this.gameMode === GameMode.DEMO) {
      this.serve(scoringPlayerIndex === 0 ? 1 : -1, SERVE_DELAY_DEMO);
      return;
    }

    scoringPaddle.score++;
    this.audio.sfx.playScore();

    if (scoringPaddle.score >= WINNING_SCORE) {
      this.beginFinalSequence(scoringPlayerIndex);
      return;
    }

    this.serve(scoringPlayerIndex === 0 ? 1 : -1, SERVE_DELAY_NORMAL);
  }

  private handleGameOver(winnerIndex: number): void {
    this.gameMode = GameMode.DEMO;
    this.resetDrama();
    this.gameState = 'menu';
    this.uiManager.setPauseButtonVisibility(false);
    this.serve(winnerIndex === 0 ? 1 : -1, SERVE_DELAY_GAME_OVER);
    this.menuController.showGameOverMenu(winnerIndex, [
      this.paddles[0].score,
      this.paddles[1].score,
    ]);
  }

  /**
   * End-of-match cutscene. Play is frozen (paddles, ball, rules) but the canvas stays live:
   * particles, flashes, background and the neon score sign keep animating until the menu.
   */
  private beginFinalSequence(winnerIndex: number): void {
    if (this.isFinalSequence) return;

    this.isFinalSequence = true;
    this.finalWinnerIndex = winnerIndex;
    this.finalElapsed = 0;
    this.resetDrama();

    const playerWon = winnerIndex === 0;
    this.finalDuration = playerWon ? FINAL_SEQUENCE_WIN_DURATION : FINAL_SEQUENCE_LOSS_DURATION;

    if (playerWon) {
      this.renderer.triggerVictoryEffect(VICTORY_DURATION);
      this.renderer.celebrate();
      this.renderer.addFlash(0.9);
      this.renderer.addShake(12);

      // The winning ball went into the right-hand goal
      this.fireworks = new VictoryFireworks(1, this.ball.y, [
        this.paddles[0].color,
        COLORS.WHITE,
        COLORS.YELLOW,
      ]);

      this.audio.sfx.playVictory();
      this.audio.music.duck();
    } else {
      this.renderer.triggerCrtGlitch(LOSS_DURATION);
      this.renderer.addShake(18);

      this.audio.sfx.playDefeat();
      this.audio.music.tapeStop();
    }

    this.renderer.showFinalScore({
      scores: [this.paddles[0].score, this.paddles[1].score],
      label: this.i18n.t(playerWon ? 'win' : 'lose'),
      color: this.paddles[winnerIndex].color,
      isWin: playerWon,
    });
  }

  private updateFinalSequence(realDt: number): void {
    this.finalElapsed += realDt;
    this.gameTime += realDt;

    for (const shot of this.fireworks?.update(realDt) ?? []) {
      this.particleSystem.burst(shot.x, shot.y, shot.color, FIREWORK_PARTICLES, FIREWORK_SPEED);
      this.particleSystem.shockwave(shot.x, shot.y, shot.color, SCORE_SHOCKWAVE_EXPANSION_SPEED);
      this.renderer.addFlash(FIREWORK_FLASH);
      this.renderer.addShake(FIREWORK_SHAKE);
      this.audio.sfx.playFireworkPop();
    }

    // Paddles stay put but keep glowing and sparking
    this.paddles.forEach((p) => p.update(realDt, this.particleSystem, 0));
    this.renderer.update(realDt, this.gameState, this.serveTime);
    this.particleSystem.update(realDt);

    if (this.finalElapsed >= this.finalDuration) {
      this.finishFinalSequence();
    }
  }

  /** Tap or key press skips the rest of the cutscene once the key moment has played. */
  private skipFinalSequence(): void {
    if (this.isFinalSequence && this.finalElapsed >= FINAL_SEQUENCE_SKIP_AFTER) {
      this.finishFinalSequence();
    }
  }

  private finishFinalSequence(): void {
    if (!this.isFinalSequence || this.finalWinnerIndex === null) return;

    const winnerIndex = this.finalWinnerIndex;
    this.isFinalSequence = false;
    this.finalWinnerIndex = null;
    this.fireworks = null;

    this.renderer.hideFinalScore();
    this.audio.music.recover();
    this.handleGameOver(winnerIndex);
  }

  private update(realDt: number): void {
    if (this.isFinalSequence) {
      this.updateFinalSequence(realDt);
      return;
    }

    const isMatchActive = this.gameMode === GameMode.PLAYER_VS_AI && this.gameState === 'play';
    this.drama.update(realDt, isMatchActive, this.ball, this.paddles);
    this.audio.music.setDramaLevel(this.drama.level);
    this.renderer.vignette = this.drama.level;

    // Slow build-up while the rally stays hot; the drop lands when it peaks
    if (this.climax.update(realDt, isMatchActive, this.rally, this.serveTime)) {
      this.renderer.triggerClimaxSurge();
      this.audio.music.triggerDrop();
    }
    this.audio.music.setClimaxLevel(this.climax.level);
    this.renderer.climax = this.climax.level;

    // Simulation runs on scaled time; screen effects below keep the wall clock
    const dt = realDt * this.drama.timeScale;
    this.gameTime += dt;

    if (this.gameState === 'menu' || this.gameState === 'play') {
      const diffConfig = DIFFICULTY_CONFIGS[this.settings.difficulty];

      // Player 1 paddle update
      if (this.gameMode === GameMode.PLAYER_VS_AI) {
        this.inputHandler.pollPlayerMovement(this.paddles[0], dt);
      } else {
        AiController.update(this.paddles[0], this.ball, this.gameMode, diffConfig, dt);
      }

      // CPU (Player 2) paddle update
      AiController.update(this.paddles[1], this.ball, this.gameMode, diffConfig, dt);

      // Smooth paddle positions and emit sparks
      this.paddles.forEach((p) => p.update(dt, this.particleSystem, this.rally));

      // Ball movement
      if (this.serveTime > 0) {
        this.serveTime -= dt;
      } else {
        this.ball.updateTrail();
        const rallyRef = { current: this.rally };
        let scored = false;

        Physics.updateBallMovement(
          this.ball,
          this.paddles,
          this.particleSystem,
          diffConfig,
          this.gameMode,
          rallyRef,
          dt,
          {
            onWallBounce: () => this.audio.sfx.playWallBounce(),
            onPaddleHit: (idx, r, isPerfect) => this.audio.sfx.playPaddleHit(r, isPerfect, idx),
            onScore: (winner) => {
              scored = true;
              this.handleScore(winner);
            },
            onScreenShake: (amount) => this.renderer.addShake(amount),
            onScreenFlash: (amount) => this.renderer.addFlash(amount),
          },
        );

        this.rally = scored ? 0 : rallyRef.current;

        if (this.climax.level > 0.05) {
          this.emitClimaxEmbers(dt);
        }
      }
    }

    const currentDiffConfig = DIFFICULTY_CONFIGS[this.settings.difficulty];
    this.ball.updateRadius(dt, this.rally, currentDiffConfig.maxSpeed);
    this.renderer.update(realDt, this.gameState, this.serveTime);
    this.particleSystem.update(dt);
  }

  private gameLoop(timestamp: number): void {
    if (!this.isRunning) return;

    this.fpsMeter.tick(timestamp);

    const dt = Math.min(0.033, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;

    if (this.gameState !== 'paused') {
      this.update(dt);
    }

    this.renderer.render(
      this.gameState,
      this.gameMode,
      this.paddles,
      this.ball,
      this.particleSystem,
      this.audio.music.getAnalyser(),
      this.gameTime,
      this.serveTime,
      this.rally,
      this.i18n.t('ready'),
      this.inputHandler.isRotated,
    );

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  public dispose(): void {
    this.isRunning = false;
    this.renderer.dispose();
    this.audio.music.dispose();
    this.fpsMeter.dispose();
  }
}
