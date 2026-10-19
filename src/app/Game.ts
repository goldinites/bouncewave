import { FixedStep } from '@/app/FixedStep';
import { AudioEngine } from '@/audio/AudioEngine';
import { MusicState } from '@/audio/music/intensity';
import { BackgroundMenu } from '@/debug/BackgroundMenu';
import { FpsMeter } from '@/debug/FpsMeter';
import { KonamiCode } from '@/easterEgg/KonamiCode';
import { TitleTaps } from '@/easterEgg/TitleTaps';
import { EffectsDirector } from '@/fx/EffectsDirector';
import { ParticleSystem } from '@/fx/ParticleSystem';
import { I18nManager } from '@/i18n/I18nManager';
import { InputHandler } from '@/input/InputHandler';
import { Ball } from '@/match/Ball';
import { ChallengeJudge, ChallengeVerdict } from '@/match/ChallengeJudge';
import { ChallengeId, CHALLENGES, isChallengeId } from '@/match/challenges';
import { COURT, PADDLE } from '@/match/config';
import { DIFFICULTY_CONFIGS } from '@/match/difficulty';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { quickMatchRules } from '@/match/modes';
import { Paddle } from '@/match/Paddle';
import { challengeState, markPassed, nextChallenge } from '@/profile/ChallengeProgress';
import { ProfileStore } from '@/profile/ProfileStore';
import { getEmptyStatistics } from '@/profile/Statistics';
import { StatsRecorder } from '@/profile/StatsRecorder';
import { StoragePersistence } from '@/profile/StoragePersistence';
import { Renderer, RenderFrame } from '@/render/Renderer';
import { SettingsStore } from '@/settings/SettingsStore';
import { EventBus } from '@/shared/EventBus';
import { COLORS } from '@/shared/palette';
import { BackgroundChoice, isSceneId, SceneId } from '@/shared/scenes';
import { MenuController } from '@/ui/MenuController';
import { NowPlaying } from '@/ui/NowPlaying';
import { UIManager } from '@/ui/UIManager';

// Longest step the simulation takes in one frame (e.g. after a hitch)
const MAX_FRAME_DT = 0.033;

/**
 * Composition root and main loop. Wires the match (MatchFlow), its presentation
 * (EffectsDirector), input, audio, rendering and the DOM menus together.
 */
export class Game {
  /** Everything saved between visits; the settings are its first part. */
  private readonly profile = new ProfileStore();
  private readonly settings = new SettingsStore(this.profile.settings);
  /** Asks the browser to keep the profile once a match has been played. */
  private readonly storagePersistence = new StoragePersistence();
  /** Counts the player's finished matches into the profile. */
  private readonly statsRecorder: StatsRecorder;
  /** Says whether each finished attempt at a challenge passed. */
  private readonly challengeJudge: ChallengeJudge;
  /** The challenge the match on court (and its restarts) is an attempt at; null for a quick match. */
  private challenge: ChallengeId | null = null;
  /** For developers: the challenge ?challenge= makes every quick match an attempt at. */
  private pinnedChallenge: ChallengeId | null = null;
  /** How the last attempt at a challenge went, for the debug overlay. */
  private lastVerdict: ChallengeVerdict | null = null;
  private readonly i18n: I18nManager;
  private readonly audio: AudioEngine;
  private readonly renderer: Renderer;
  private readonly uiManager: UIManager;
  private readonly inputHandler: InputHandler;
  private readonly menuController: MenuController;
  private readonly nowPlaying: NowPlaying;

  private readonly paddles: readonly Paddle[];
  private readonly ball = new Ball();
  private readonly particles = new ParticleSystem();
  private readonly flow: MatchFlow;
  /**
   * Everything the match reports, for whoever reacts to it (the effects, the menus). A listener
   * that fails is reported in the debug overlay; the match and the other listeners go on.
   */
  private readonly matchEvents = new EventBus<MatchEvent>((error) =>
    this.fpsMeter.reportError(error),
  );
  /** Cuts frame times into the match's fixed simulation steps. */
  private readonly simulation = new FixedStep();
  private readonly effects: EffectsDirector;
  private readonly fpsMeter: FpsMeter;
  private readonly backgroundMenu: BackgroundMenu;
  /** The background the debug overlay last showed, to notice when the next match changes it. */
  private debugScene: SceneId | null = null;
  private readonly konamiCode: KonamiCode;
  private readonly titleTaps: TitleTaps | null;

  /**
   * The classic-mode easter egg: the Konami code, or on a phone five quick taps on the menu's
   * title, toggles it.
   */
  private classicMode = false;

  private lastTimestamp = 0;
  private isRunning = false;
  private animationFrameId: number | null = null;
  private readonly listeners = new AbortController();
  private readonly unsubscribeSettings: () => void;

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
    // The game opens on the background the player chose for their matches, if they chose one
    const choice = this.settings.current.matchBackground;
    this.renderer.chooseBackground(choice);
    if (choice !== 'random') this.renderer.switchChannel(false);
    // For developers: ?bg=fuji pins a background from the start, matches included, and the
    // debug overlay comes with a menu of them all
    const pinned = new URLSearchParams(window.location.search).get('bg');
    if (pinned && isSceneId(pinned)) this.renderer.pinBackground(pinned);
    // ?challenge=survival makes every quick match an attempt at that challenge, locked or not;
    // the debug overlay shows how the last attempt went
    const challenge = new URLSearchParams(window.location.search).get('challenge');
    if (isChallengeId(challenge)) this.pinnedChallenge = challenge;
    this.backgroundMenu = new BackgroundMenu((scene) => this.pickBackground(scene));
    this.fpsMeter = new FpsMeter((isVisible) => this.backgroundMenu.setVisible(isVisible));
    // The music opens with the song of whichever backdrop comes up first
    this.audio.music.enterScene(this.renderer.scene);
    this.showDebugDetail();
    this.uiManager = new UIManager(this.i18n);

    // The UI language follows the settings, and the background behind the menus the choice of
    // one for the quick match, so the player sees what they are picking
    let background = choice;
    this.unsubscribeSettings = this.settings.subscribe(({ language, matchBackground }) => {
      if (matchBackground !== background) {
        background = matchBackground;
        this.previewBackground(matchBackground);
      }
      if (language === this.i18n.language) return;
      this.i18n.language = language;
      this.uiManager.updateTexts();
    });

    this.inputHandler = new InputHandler(canvas, {
      onUnlockAudio: () => this.unlockAudio(),
      // In the settings menu Esc steps back to the menu it came from instead
      onTogglePause: () => {
        if (!this.menuController.goBack()) this.togglePause();
      },
      onToggleFullscreen: () => this.toggleFullscreen(),
      onToggleMusic: () => this.toggleMusic(),
      onNextTrack: () => this.nextTrack(),
      onPress: () => this.flow.skipFinale(),
    });

    this.effects = new EffectsDirector({
      renderer: this.renderer,
      audio: this.audio,
      particles: this.particles,
      paddles: this.paddles,
      translate: (key) => this.i18n.t(key),
    });

    this.flow = new MatchFlow({
      paddles: this.paddles,
      ball: this.ball,
      input: this.inputHandler,
      getDifficulty: () => this.settings.current.difficulty,
      onEvent: (event) => this.matchEvents.emit(event),
    });

    this.menuController = new MenuController(
      this.uiManager,
      this.i18n,
      this.audio.sfx,
      this.settings,
      {
        onStartGame: () => this.start(),
        onStartQuickMatch: () => {
          this.challenge = this.pinnedChallenge;
          this.start();
        },
        onStartChallenge: (challenge) => {
          this.challenge = challenge;
          this.start();
        },
        isChallengeMatch: () => this.challenge !== null,
        onResumeGame: () => this.resume(),
        onReturnToMainMenu: () => this.toMenu(),
        onUnlockAudio: () => this.unlockAudio(),
        onQuickMatchSetup: (isShown) => this.onQuickMatchSetup(isShown),
      },
      {
        get: () => this.profile.current.stats,
        reset: () => this.profile.update({ stats: getEmptyStatistics() }),
      },
      { get: () => this.profile.current.challenges },
    );

    this.statsRecorder = new StatsRecorder({
      profile: this.profile,
      match: this.flow,
      getDifficulty: () => this.flow.difficulty,
      isCounted: () => this.challenge === null,
    });

    this.challengeJudge = new ChallengeJudge({
      match: this.flow,
      onVerdict: (verdict) => {
        this.lastVerdict = verdict;
        this.showDebugDetail();
        this.recordVerdict(verdict);
      },
    });

    // The effects hear each event before the menus do
    this.effects.listenTo(this.matchEvents);
    this.menuController.listenTo(this.matchEvents);
    this.statsRecorder.listenTo(this.matchEvents);
    this.challengeJudge.listenTo(this.matchEvents);
    this.storagePersistence.listenTo(this.matchEvents);

    this.nowPlaying = new NowPlaying(this.i18n, {
      onToggle: () => this.toggleMusic(),
      onNext: () => this.nextTrack(),
    });

    this.uiManager.bindPauseButton(() => {
      this.unlockAudio();
      this.togglePause();
    });

    this.konamiCode = new KonamiCode(() => this.setClassicMode(!this.classicMode));
    // Taps are the phone's way in; a mouse has the Konami code's keyboard to hand
    const title = document.getElementById('gameTitle');
    this.titleTaps =
      title && window.matchMedia('(pointer: coarse)').matches
        ? new TitleTaps(title, () => this.setClassicMode(!this.classicMode))
        : null;

    // Errors outside the game loop (input and button handlers): shown in the ?debug overlay
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

  /** The now-playing chip and the M key: the same switch as the music setting. */
  private toggleMusic(): void {
    this.unlockAudio();
    this.settings.cycle('musicMuted');
  }

  /** The chip's skip and the N key: another synthwave song, at random (classic mode has one). */
  private nextTrack(): void {
    if (this.classicMode) return;
    this.unlockAudio();
    this.audio.music.skipSong();
  }

  /** Swaps the whole presentation (canvas, menu chrome and music) for the 1972 look. */
  private setClassicMode(enabled: boolean): void {
    this.classicMode = enabled;
    this.renderer.setClassicMode(enabled);
    this.uiManager.setClassicMode(enabled);
  }

  /**
   * F toggles fullscreen; the field itself grows via the `:fullscreen` CSS in main.css.
   * Desktop only — skipped on a touch pointer even if a keyboard happens to be attached
   * (e.g. an iPad), since phones and tablets already run full-bleed in their browser chrome.
   */
  private toggleFullscreen(): void {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const request = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();

    request.catch((error: unknown) => this.fpsMeter.reportError(error));
  }

  /**
   * Keeps a passed challenge in the profile (which opens the next one) and shows the attempt's
   * result in place of the game-over menu.
   */
  private recordVerdict(verdict: ChallengeVerdict): void {
    const progress = this.profile.current.challenges;
    const isFirstPass =
      verdict.isPassed && challengeState(progress, verdict.challenge) !== 'passed';
    if (isFirstPass) {
      this.profile.update({ challenges: markPassed(progress, verdict.challenge) });
    }
    const next = nextChallenge(verdict.challenge);
    this.menuController.showChallengeResult({
      verdict,
      unlocked: isFirstPass ? next : null,
      isAllPassed: isFirstPass && next === null,
    });
  }

  /**
   * Starts a match: the challenge being played, or else a quick match set up as the player last
   * chose (the settings keep it). Restart and play again start the same.
   */
  public start(): void {
    this.challengeJudge.judge(this.challenge);
    if (this.challenge) {
      // A challenge is set up in advance: its own rules, paddles and level
      const { rules, paddles, difficulty } = CHALLENGES[this.challenge];
      this.flow.startMatch(rules, this.flow.playerVsCpu(paddles), difficulty);
    } else {
      this.flow.startMatch(quickMatchRules(this.settings.current.matchPoints));
    }
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
      this.uiManager.setPauseButtonVisibility(false);
    }
  }

  public resume(): void {
    this.flow.resume();
    this.uiManager.hideMenu();
    this.uiManager.setPauseButtonVisibility(true);
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
    if (
      this.renderer.trackFrameTime(timestamp - this.lastTimestamp) ||
      this.renderer.scene !== this.debugScene
    ) {
      this.showDebugDetail();
    }

    const realDt = Math.min(MAX_FRAME_DT, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;

    // Everything freezes while paused; only the menu dimming keeps its own clock
    const isPaused = this.flow.phase === 'paused';
    if (!isPaused) {
      this.effects.beforeSimulation(realDt, this.flow);
      // Match-point slow motion scales the simulation, not the screen effects
      const dt = realDt * this.effects.timeScale;
      // The match runs in whole steps of a fixed length; the effects, which only decorate it,
      // follow the frame's own smooth time
      this.simulation.advance(dt, (step) => this.flow.update(step));
      this.effects.afterSimulation(dt, this.flow);
    }
    this.flow.interpolate(this.simulation.alpha);

    // Music reads this on its own scheduler tick, paused frames included (it muffles in pause)
    this.audio.music.setState(this.buildMusicState());
    this.audio.classicMusic.setActive(this.classicMode && !this.settings.current.musicMuted);
    this.nowPlaying.update(
      this.classicMode ? null : this.audio.music.getSongTitle(),
      this.settings.current.musicMuted,
    );

    const frame = this.buildRenderFrame();
    if (!isPaused) {
      this.renderer.update(realDt, frame);
    }
    this.renderer.render(frame, realDt);
  }

  /**
   * Shows the dynamic resolution, the last challenge verdict and the background in the ?debug
   * overlay and its menu.
   */
  private showDebugDetail(): void {
    this.debugScene = this.renderer.scene;
    const verdict = this.lastVerdict;
    const attempt = verdict
      ? ` · ${verdict.challenge} ${verdict.isPassed ? 'passed' : 'failed'} ${verdict.progress}/${verdict.target}`
      : '';
    this.fpsMeter.setDetail(`res ×${this.renderer.pixelRatio.toFixed(2)}${attempt}`);
    this.backgroundMenu.setCurrent(this.renderer.scene);
  }

  /**
   * The quick match's setup shows its background behind it: the one chosen when it opens, and
   * the unknown channel for random. Left with the unknown channel on, a real backdrop is drawn at
   * random, flicking through the channels.
   */
  private onQuickMatchSetup(isShown: boolean): void {
    if (isShown) {
      this.previewBackground(this.settings.current.matchBackground);
    } else if (this.renderer.isShowingMystery) {
      this.audio.music.enterScene(this.renderer.switchChannel());
      this.audio.sfx.playChannelSurf();
      this.showDebugDetail();
    }
  }

  /**
   * The quick match's background was picked: from now on matches are played on it, and it cuts
   * in behind the menu at once, its song with it, so the player can flick through them; random
   * puts the unknown channel there, since which backdrop it will be is not known yet.
   */
  private previewBackground(choice: BackgroundChoice): void {
    this.renderer.chooseBackground(choice);
    if (this.flow.phase !== 'attract') return;
    if (choice === 'random') {
      this.renderer.showMystery();
      return;
    }
    this.audio.music.enterScene(this.renderer.switchChannel(false));
    this.showDebugDetail();
  }

  /** For developers, from the debug menu: pins a background, its music coming in with it. */
  private pickBackground(scene: SceneId): void {
    this.renderer.pinBackground(scene);
    this.audio.music.enterScene(scene);
    this.showDebugDetail();
  }

  private buildMusicState(): MusicState {
    // In a match, the match's level (a challenge sets its own); behind the menus, the chosen one
    const difficulty = this.flow.isDemo ? this.settings.current.difficulty : this.flow.difficulty;
    return {
      gameState: this.flow.gameState,
      serveTime: this.flow.serveTime,
      // The music builds with the fastest ball on court
      ballSpeed: Math.max(...this.flow.balls.map((b) => b.speed)),
      maxBallSpeed: DIFFICULTY_CONFIGS[difficulty].maxSpeed,
      rally: this.flow.rally,
      scores: [...this.flow.scores],
      winningScores: this.flow.rules.winningScores,
      isMuted: this.settings.current.musicMuted || this.classicMode,
      difficulty,
    };
  }

  private buildRenderFrame(): RenderFrame {
    return {
      gameState: this.flow.gameState,
      isDemo: this.flow.isDemo,
      paddles: this.paddles,
      scores: this.flow.scores,
      balls: this.flow.balls,
      ball: this.flow.leadBall,
      particles: this.particles,
      analyser: this.audio.music.getAnalyser(),
      // The moment the ball and paddles are drawn at, between the last two steps (never before
      // the clock starts: a tape counter would read -1)
      time: Math.max(0, this.flow.time - this.simulation.lag),
      serveTime: this.flow.serveTime,
      rally: this.flow.rally,
      readyText: this.i18n.t(this.flow.isDecidingPoint ? 'decider' : 'ready'),
      isRotated: this.inputHandler.isRotated,
      vignette: this.effects.vignette,
      zoom: this.effects.cameraZoom,
      climax: this.effects.climaxLevel,
      paddleGlow: this.effects.paddleGlow,
      overdriveCharge: this.flow.rules.overdrive ? this.flow.overdriveCharge : null,
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
    this.matchEvents.clear();
    this.unsubscribeSettings();
    this.menuController.dispose();
    this.nowPlaying.dispose();
    this.konamiCode.dispose();
    this.titleTaps?.dispose();
    this.inputHandler.dispose();
    this.uiManager.dispose();
    this.renderer.dispose();
    this.audio.dispose();
    this.fpsMeter.dispose();
    this.backgroundMenu.dispose();
  }
}
