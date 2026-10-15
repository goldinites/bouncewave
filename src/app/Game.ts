import { AudioEngine } from '@/audio/AudioEngine';
import { DIFFICULTY_CONFIGS } from '@/constants/difficulty.constants';
import { COLORS, GAME_WIDTH, PADDLE_OFFSET_X, PADDLE_WIDTH } from '@/constants/game.constants';
import { EffectsDirector } from '@/fx/EffectsDirector';
import { InputHandler } from '@/input/InputHandler';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { FpsMeter } from '@/debug/FpsMeter';
import { Ball } from '@/entities/Ball';
import { Paddle } from '@/entities/Paddle';
import { ParticleSystem } from '@/entities/ParticleSystem';
import { I18nManager } from '@/i18n/I18nManager';
import { Renderer, RenderFrame } from '@/render/Renderer';
import { SettingsStorage } from '@/storage/SettingsStorage';
import { UserSettings } from '@/types/audio.types';
import { MenuController } from '@/ui/MenuController';
import { UIManager } from '@/ui/UIManager';

// Longest step the simulation takes in one frame (e.g. after a hitch)
const MAX_FRAME_DT = 0.033;

/**
 * Composition root and main loop. Wires the match (MatchFlow), its presentation
 * (EffectsDirector), input, audio, rendering and the DOM menus together.
 */
export class Game {
  private readonly settings: UserSettings;
  private readonly i18n: I18nManager;
  private readonly audio: AudioEngine;
  private readonly renderer: Renderer;
  private readonly uiManager: UIManager;
  private readonly inputHandler: InputHandler;
  private readonly menuController: MenuController;

  private readonly paddles: [Paddle, Paddle];
  private readonly ball = new Ball();
  private readonly particles = new ParticleSystem();
  private readonly flow: MatchFlow;
  private readonly effects: EffectsDirector;
  private readonly fpsMeter = new FpsMeter();

  private lastTimestamp = 0;
  private isRunning = false;
  private animationFrameId: number | null = null;
  private readonly listeners = new AbortController();

  constructor(canvas: HTMLCanvasElement) {
    this.settings = SettingsStorage.load();
    this.i18n = new I18nManager(this.settings.language);

    this.paddles = [
      new Paddle(0, PADDLE_OFFSET_X, COLORS.CYAN),
      new Paddle(1, GAME_WIDTH - PADDLE_OFFSET_X - PADDLE_WIDTH, COLORS.PINK),
    ];

    this.audio = new AudioEngine(() => this.settings.soundMuted, {
      getGameState: () => this.flow.gameState,
      getServeTime: () => this.flow.serveTime,
      getBallSpeed: () => this.ball.speed,
      getRally: () => this.flow.rally,
      getScores: () => [this.paddles[0].score, this.paddles[1].score],
      getDifficultyConfig: () => DIFFICULTY_CONFIGS[this.settings.difficulty],
      getIsMusicMuted: () => this.settings.musicMuted,
    });

    this.renderer = new Renderer(canvas);
    this.uiManager = new UIManager(this.i18n);

    this.inputHandler = new InputHandler(canvas, {
      onUnlockAudio: () => this.unlockAudio(),
      onTogglePause: () => this.togglePause(),
      onPress: () => this.flow.skipFinale(),
    });

    this.effects = new EffectsDirector({
      renderer: this.renderer,
      audio: this.audio,
      particles: this.particles,
      paddles: this.paddles,
      ball: this.ball,
      translate: (key) => this.i18n.t(key),
    });

    this.flow = new MatchFlow({
      paddles: this.paddles,
      ball: this.ball,
      input: this.inputHandler,
      getDifficulty: () => DIFFICULTY_CONFIGS[this.settings.difficulty],
      onEvent: (event) => this.onMatchEvent(event),
    });

    this.menuController = new MenuController(
      this.uiManager,
      this.i18n,
      this.audio.sfx,
      this.settings,
      {
        onStartGame: () => this.start(),
        onResumeGame: () => this.resume(),
        onReturnToMainMenu: () => this.toMenu(),
        onUnlockAudio: () => this.unlockAudio(),
      },
    );

    this.uiManager.bindPauseButton(() => {
      this.unlockAudio();
      this.togglePause();
    });

    // Auto-pause when the tab is hidden (AudioEngine suspends the sound on its own)
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.pause();
      },
      { signal: this.listeners.signal },
    );
  }

  public init(): void {
    this.flow.startAttract();
    this.menuController.showMainMenu();
    this.uiManager.setPauseButtonVisibility(false);

    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
  }

  public unlockAudio(): void {
    this.audio.unlock();
  }

  public start(): void {
    this.flow.startMatch();
    this.uiManager.hideMenu();
    this.uiManager.setPauseButtonVisibility(true);
  }

  public toMenu(): void {
    this.flow.returnToMenu();
    this.uiManager.setPauseButtonVisibility(false);
    this.menuController.showMainMenu();
  }

  public togglePause(): void {
    if (this.flow.phase === 'paused') {
      this.resume();
    } else {
      this.pause();
    }
  }

  private pause(): void {
    if (this.flow.pause()) {
      this.menuController.showPauseMenu();
    }
  }

  public resume(): void {
    this.flow.resume();
    this.uiManager.hideMenu();
  }

  private onMatchEvent(event: MatchEvent): void {
    this.effects.handle(event);

    if (event.type === 'gameOver') {
      this.uiManager.setPauseButtonVisibility(false);
      this.menuController.showGameOverMenu(event.winnerIndex, event.scores);
    }
  }

  private gameLoop(timestamp: number): void {
    if (!this.isRunning) return;

    this.fpsMeter.tick(timestamp);

    const realDt = Math.min(MAX_FRAME_DT, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;

    // Everything freezes while paused; only the menu dimming keeps its own clock
    const isPaused = this.flow.phase === 'paused';
    if (!isPaused) {
      this.effects.beforeSimulation(realDt, this.flow);
      // Match-point slow motion scales the simulation, not the screen effects
      const dt = realDt * this.effects.timeScale;
      this.flow.update(dt);
      this.effects.afterSimulation(dt, this.flow);
    }

    const frame = this.buildRenderFrame();
    if (!isPaused) {
      this.renderer.update(realDt, frame);
    }
    this.renderer.render(frame);

    this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
  }

  private buildRenderFrame(): RenderFrame {
    return {
      gameState: this.flow.gameState,
      gameMode: this.flow.gameMode,
      paddles: this.paddles,
      ball: this.ball,
      particles: this.particles,
      analyser: this.audio.music.getAnalyser(),
      time: this.flow.time,
      serveTime: this.flow.serveTime,
      rally: this.flow.rally,
      readyText: this.i18n.t('ready'),
      isRotated: this.inputHandler.isRotated,
      vignette: this.effects.tension,
      climax: this.effects.climaxLevel,
    };
  }

  /** Stops the loop and releases every listener, timer and audio resource. */
  public dispose(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.listeners.abort();
    this.inputHandler.dispose();
    this.uiManager.dispose();
    this.renderer.dispose();
    this.audio.dispose();
    this.fpsMeter.dispose();
  }
}
