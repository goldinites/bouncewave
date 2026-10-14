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
import { Physics } from '@/core/Physics';
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
  private finalSequenceTimer: number | null = null;

  private readonly fpsMeter = new FpsMeter();

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
    this.gameState = 'menu';
    this.uiManager.setPauseButtonVisibility(false);
    this.serve(winnerIndex === 0 ? 1 : -1, SERVE_DELAY_GAME_OVER);
    this.menuController.showGameOverMenu(winnerIndex, [
      this.paddles[0].score,
      this.paddles[1].score,
    ]);
  }

  private beginFinalSequence(winnerIndex: number): void {
    if (this.isFinalSequence) return;

    this.isFinalSequence = true;

    const playerWon = winnerIndex === 0;

    if (playerWon) {
      this.renderer.triggerVictoryEffect(VICTORY_DURATION);

      this.renderer.addFlash(0.9);
      this.renderer.addShake(12);
    } else {
      this.renderer.triggerCrtGlitch(LOSS_DURATION);
      this.renderer.addShake(18);
    }

    this.audio.sfx.playGameOver();

    this.finalSequenceTimer = window.setTimeout(
      () => {
        this.finalSequenceTimer = null;
        this.isFinalSequence = false;
        this.handleGameOver(winnerIndex);
      },
      playerWon ? VICTORY_DURATION : LOSS_DURATION,
    );
  }

  private update(dt: number): void {
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
            onPaddleHit: (_idx, r) => this.audio.sfx.playPaddleHit(r),
            onScore: (winner) => {
              scored = true;
              this.handleScore(winner);
            },
            onScreenShake: (amount) => this.renderer.addShake(amount),
          },
        );

        this.rally = scored ? 0 : rallyRef.current;
      }
    }

    const currentDiffConfig = DIFFICULTY_CONFIGS[this.settings.difficulty];
    this.ball.updateRadius(dt, this.rally, currentDiffConfig.maxSpeed);
    this.renderer.update(dt, this.gameState, this.serveTime);
    this.particleSystem.update(dt);
  }

  private gameLoop(timestamp: number): void {
    if (!this.isRunning) return;

    this.fpsMeter.tick(timestamp);

    const dt = Math.min(0.033, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;

    if (!this.isFinalSequence) {
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
    }

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  public dispose(): void {
    this.isRunning = false;
    this.renderer.dispose();
    this.audio.music.dispose();
    this.fpsMeter.dispose();

    if (this.finalSequenceTimer !== null) {
      window.clearTimeout(this.finalSequenceTimer);
      this.finalSequenceTimer = null;
    }
  }
}
