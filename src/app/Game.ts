import { AudioEngine } from '@/audio/AudioEngine';
import { MusicState } from '@/audio/music/intensity';
import { FpsMeter } from '@/debug/FpsMeter';
import { KonamiCode } from '@/easterEgg/KonamiCode';
import { EffectsDirector } from '@/fx/EffectsDirector';
import { ParticleSystem } from '@/fx/ParticleSystem';
import { I18nManager } from '@/i18n/I18nManager';
import { InputHandler } from '@/input/InputHandler';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { DIFFICULTY_CONFIGS } from '@/match/difficulty';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';
import { Renderer, RenderFrame } from '@/render/Renderer';
import { SettingsStore } from '@/settings/SettingsStore';
import { COLORS } from '@/shared/palette';
import { MenuController } from '@/ui/MenuController';
import { UIManager } from '@/ui/UIManager';

// Longest step the simulation takes in one frame (e.g. after a hitch)
const MAX_FRAME_DT = 0.033;

/**
 * Composition root and main loop. Wires the match (MatchFlow), its presentation
 * (EffectsDirector), input, audio, rendering and the DOM menus together.
 */
export class Game {
  private readonly settings = new SettingsStore();
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
  private readonly konamiCode: KonamiCode;

  /** The classic-mode easter egg: `?classic` in the URL, or the Konami code, toggles it. */
  private classicMode = false;

  private lastTimestamp = 0;
  private isRunning = false;
  private animationFrameId: number | null = null;
  private readonly listeners = new AbortController();

  constructor(canvas: HTMLCanvasElement) {
    this.i18n = new I18nManager(this.settings.current.language);

    this.paddles = [
      new Paddle(0, PADDLE.OFFSET_X, COLORS.CYAN),
      new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, COLORS.PINK),
    ];

    this.audio = new AudioEngine(
      () => this.settings.current.soundMuted,
      () => this.flow.gameState === 'play',
    );

    this.renderer = new Renderer(canvas);
    this.uiManager = new UIManager(this.i18n);

    // The UI language follows the settings
    this.settings.subscribe(({ language }) => {
      if (language === this.i18n.language) return;
      this.i18n.language = language;
      this.uiManager.updateHint();
    });

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
      getDifficulty: () => DIFFICULTY_CONFIGS[this.settings.current.difficulty],
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

    this.konamiCode = new KonamiCode(() => this.setClassicMode(!this.classicMode));
    this.setClassicMode(new URLSearchParams(window.location.search).has('classic'));

    // Errors outside the game loop (input and button handlers): shown in the ?fps overlay
    window.addEventListener(
      'error',
      (event) => this.fpsMeter.reportError(event.error ?? event.message),
      {
        signal: this.listeners.signal,
      },
    );
    window.addEventListener(
      'unhandledrejection',
      (event) => this.fpsMeter.reportError(event.reason),
      { signal: this.listeners.signal },
    );

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

  /** Swaps the whole presentation (canvas, menu chrome and music) for the 1972 look. */
  private setClassicMode(enabled: boolean): void {
    this.classicMode = enabled;
    this.renderer.setClassicMode(enabled);
    this.uiManager.setClassicMode(enabled);
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
    // Effects are presentation only: if one fails (e.g. the browser rejects an audio change),
    // the match and its menus must still go on
    try {
      this.effects.handle(event);
    } catch (error) {
      this.fpsMeter.reportError(error);
    }

    if (event.type === 'gameOver') {
      this.uiManager.setPauseButtonVisibility(false);
      this.menuController.showGameOverMenu(event.winnerIndex, event.scores);
    }
  }

  private gameLoop(timestamp: number): void {
    if (!this.isRunning) return;

    // Ask for the next frame first: an error in this one must not stop the game for good
    this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));

    try {
      this.runFrame(timestamp);
    } catch (error) {
      this.fpsMeter.reportError(error);
    }
  }

  private runFrame(timestamp: number): void {
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

    // Music reads this on its own scheduler tick, paused frames included (it muffles in pause)
    this.audio.music.setState(this.buildMusicState());
    this.audio.classicMusic.setActive(this.classicMode && !this.settings.current.musicMuted);

    const frame = this.buildRenderFrame();
    if (!isPaused) {
      this.renderer.update(realDt, frame);
    }
    this.renderer.render(frame, realDt);
  }

  private buildMusicState(): MusicState {
    return {
      gameState: this.flow.gameState,
      serveTime: this.flow.serveTime,
      ballSpeed: this.ball.speed,
      maxBallSpeed: DIFFICULTY_CONFIGS[this.settings.current.difficulty].maxSpeed,
      rally: this.flow.rally,
      scores: [this.paddles[0].score, this.paddles[1].score],
      isMuted: this.settings.current.musicMuted || this.classicMode,
      difficulty: this.settings.current.difficulty,
    };
  }

  private buildRenderFrame(): RenderFrame {
    return {
      gameState: this.flow.gameState,
      isDemo: this.flow.isDemo,
      paddles: this.paddles,
      ball: this.ball,
      particles: this.particles,
      analyser: this.audio.music.getAnalyser(),
      time: this.flow.time,
      serveTime: this.flow.serveTime,
      rally: this.flow.rally,
      readyText: this.i18n.t(this.effects.isDecidingPoint ? 'decider' : 'ready'),
      isRotated: this.inputHandler.isRotated,
      vignette: this.effects.vignette,
      zoom: this.effects.cameraZoom,
      climax: this.effects.climaxLevel,
      paddleGlow: this.effects.paddleGlow,
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
    this.konamiCode.dispose();
    this.inputHandler.dispose();
    this.uiManager.dispose();
    this.renderer.dispose();
    this.audio.dispose();
    this.fpsMeter.dispose();
  }
}
