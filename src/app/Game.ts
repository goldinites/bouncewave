import { effect, untracked } from '@preact/signals-core';
import { FixedStep } from '@/app/FixedStep';
import { AudioEngine } from '@/audio/AudioEngine';
import { MusicState } from '@/audio/music/intensity';
import { BackgroundMenu } from '@/debug/BackgroundMenu';
import { FpsMeter } from '@/debug/FpsMeter';
import { SkillMenu, SkillOwner } from '@/debug/SkillMenu';
import { ClassicSwitch } from '@/easterEgg/ClassicSwitch';
import { EffectsDirector } from '@/fx/EffectsDirector';
import { ParticleSystem } from '@/fx/ParticleSystem';
import { I18nManager } from '@/i18n/I18nManager';
import { InputHandler } from '@/input/InputHandler';
import { Ball } from '@/match/Ball';
import { ChallengeJudge, ChallengeVerdict } from '@/match/ChallengeJudge';
import { ChallengeId, CHALLENGES, isChallengeId } from '@/match/challenges';
import { COURT, PADDLE } from '@/match/config';
import { DIFFICULTY_CONFIGS, DifficultyLevel } from '@/match/difficulty';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { quickMatchRules } from '@/match/modes';
import { MatchRules } from '@/match/rules';
import { Paddle } from '@/match/Paddle';
import { isSkillId, SKILL_IDS, SkillId } from '@/match/skills/Skill';
import { challengeState, isEveryChallengePassed, markPassed } from '@/profile/ChallengeProgress';
import { ProfileStore } from '@/profile/ProfileStore';
import { getEmptyStatistics } from '@/profile/Statistics';
import { StatsRecorder } from '@/profile/StatsRecorder';
import { StoragePersistence } from '@/profile/StoragePersistence';
import { Renderer } from '@/render/Renderer';
import { RenderFrame } from '@/render/scene';
import { SettingsStore } from '@/settings/SettingsStore';
import { EventBus } from '@/shared/EventBus';
import { Look } from '@/shared/look';
import { COLORS } from '@/shared/palette';
import { BackgroundChoice, isPickableScene, isSceneId, SceneId } from '@/shared/scenes';
import { MenuController } from '@/ui/MenuController';
import { Condition, describeCondition, describeFinale } from '@/ui/challengeTexts';
import { ConditionBar, SIDE_DOCK_QUERY } from '@/ui/ConditionBar';
import { UIManager } from '@/ui/UIManager';

// Longest step the simulation takes in one frame (e.g. after a hitch)
const MAX_FRAME_DT = 0.033;
// The level a match of two players is played at: no CPU, so it only sets the ball's pace, the
// default level's (Medium)
const TWO_PLAYER_PACE = DifficultyLevel.NORMAL;

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
  /**
   * Whether the match being played (or just finished) is two people's at one device. Kept here,
   * not asked of the match: by its end the match has already handed the paddles back to the demo.
   */
  private isTwoPlayers = false;
  /**
   * Two players on a phone held upright: their match (its pause and its end too) is shown in
   * landscape, the phone held sideways between them. Off again back on the main menu.
   */
  private isLandscape = false;
  /**
   * The backdrop the match on court asked for when it started: a challenge's (or, in stage 8, a
   * story chapter's) own; null plays it on the player's. Set by whatever starts the match.
   */
  private matchScene: SceneId | null = null;
  /** Whether the match starting is the one on court started again: it keeps its backdrop. */
  private isRestarting = false;
  /** For developers: the challenge ?challenge= makes every quick match an attempt at. */
  private pinnedChallenge: ChallengeId | null = null;
  /**
   * For developers: the skills ?skills= gives the player, and ?cpuSkills= the CPU, in every match
   * against the CPU, to playtest the prototypes (4.3) before the progression is built around them.
   */
  private readonly pinnedSkills: Record<SkillOwner, readonly SkillId[]> = { player: [], cpu: [] };
  /** How the last attempt at a challenge went, for the debug overlay. */
  private lastVerdict: ChallengeVerdict | null = null;
  private readonly i18n: I18nManager;
  private readonly audio: AudioEngine;
  private readonly renderer: Renderer;
  private readonly uiManager: UIManager;
  private readonly inputHandler: InputHandler;
  private readonly menuController: MenuController;
  /** A challenge's condition in the strip above the court. */
  private readonly conditionBar: ConditionBar;
  /** A phone on its side, as bars.css lays it out: the controls in the margin beside the court. */
  private readonly sideDock = window.matchMedia(SIDE_DOCK_QUERY);

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
  /** Switches the skill prototypes on and off, and counts their uses in the match on court. */
  private readonly skillMenu: SkillMenu;
  /** How often each skill went off in the match on court, for the skill menu. */
  private readonly skillUses = new Map<SkillId, [number, number]>();
  /** The background the debug overlay last showed, to notice when the next match changes it. */
  private debugScene: SceneId | null = null;
  /** The classic look's easter egg, and the look the whole game follows. */
  private readonly classicSwitch: ClassicSwitch;
  private readonly stopFollowingLook: () => void;

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
    // ?challenge=survival makes every quick match an attempt at that challenge;
    // the debug overlay shows how the last attempt went
    const challenge = new URLSearchParams(window.location.search).get('challenge');
    if (isChallengeId(challenge)) this.pinnedChallenge = challenge;
    // ?skills=arc,analyzer,reflex gives the player those skills (match/skills/Skill.ts), and
    // ?cpuSkills= the CPU
    const params = new URLSearchParams(window.location.search);
    const skillsIn = (param: string) => (params.get(param) ?? '').split(',').filter(isSkillId);
    this.pinnedSkills.player = skillsIn('skills');
    this.pinnedSkills.cpu = skillsIn('cpuSkills');
    this.backgroundMenu = new BackgroundMenu(
      (scene) => this.pickBackground(scene),
      this.renderer.scenes,
    );
    this.skillMenu = new SkillMenu(SKILL_IDS, this.pinnedSkills, (owner, skills) =>
      this.chooseSkills(owner, skills.filter(isSkillId)),
    );
    this.fpsMeter = new FpsMeter((isVisible) => {
      this.backgroundMenu.setVisible(isVisible);
      this.skillMenu.setVisible(isVisible);
    });
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
      onPress: () => this.flow.skipFinale(),
    });

    this.effects = new EffectsDirector({
      renderer: this.renderer,
      audio: this.audio,
      particles: this.particles,
      paddles: this.paddles,
      translate: (key) => this.i18n.t(key),
      matchScene: () => this.matchScene,
      isTwoPlayer: () => this.isTwoPlayers,
      challengeFinale: (finale) => {
        const verdict = this.challengeJudge.verdictFor(finale.winnerIndex);
        return (
          verdict && { ...describeFinale(this.i18n, verdict, finale), isPassed: verdict.isPassed }
        );
      },
      isRestart: () => this.isRestarting,
    });

    this.flow = new MatchFlow({
      paddles: this.paddles,
      ball: this.ball,
      input: this.inputHandler,
      getDifficulty: () => this.settings.current.difficulty,
      onEvent: (event) => this.matchEvents.emit(event),
    });

    // The classic look comes and goes only on the main menu. Taps on the title are the phone's
    // way in; a mouse has the Konami code's keyboard to hand
    const title = document.getElementById('gameTitle');
    this.classicSwitch = new ClassicSwitch(
      () => this.menuController.isOnMainMenu,
      window.matchMedia('(pointer: coarse)').matches ? title : null,
    );

    this.menuController = new MenuController(
      this.uiManager,
      this.i18n,
      this.audio.sfx,
      this.settings,
      {
        onStartGame: () => this.start(),
        onRestartGame: () => this.restart(),
        onStartQuickMatch: () => {
          // The classic look has no challenges, not even a pinned one
          this.challenge = this.look === 'classic' ? null : this.pinnedChallenge;
          this.isTwoPlayers = false;
          this.start();
        },
        onStartChallenge: (challenge) => {
          this.challenge = challenge;
          this.isTwoPlayers = false;
          this.start();
        },
        onStartTwoPlayers: () => {
          this.challenge = null;
          this.isTwoPlayers = true;
          this.start();
        },
        isChallengeMatch: () => this.challenge !== null,
        isTwoPlayerMatch: () => this.isTwoPlayers,
        onResumeGame: () => this.resume(),
        onReturnToMainMenu: () => this.toMenu(),
        onUnlockAudio: () => this.unlockAudio(),
        onQuickMatchSetup: (isShown) => this.onQuickMatchSetup(isShown),
        onMenuScene: (scene) => this.showMenuScene(scene),
      },
      {
        get: () => this.profile.current.stats,
        reset: () => this.profile.update({ stats: getEmptyStatistics() }),
      },
      { get: () => this.profile.current.challenges },
      this.classicSwitch.look,
    );

    this.statsRecorder = new StatsRecorder({
      profile: this.profile,
      match: this.flow,
      getDifficulty: () => this.flow.difficulty,
      // The player's record is the player's: neither challenges nor two people's matches count
      isCounted: () => this.challenge === null && !this.isTwoPlayers,
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
    this.matchEvents.subscribe((event) => this.countSkillUse(event));

    this.conditionBar = new ConditionBar();

    this.uiManager.bindPauseButton(() => {
      this.unlockAudio();
      this.togglePause();
    });

    // Everything that looks or sounds the part follows the look; the menus redraw themselves
    this.stopFollowingLook = effect(() => {
      const look = this.classicSwitch.look.value;
      untracked(() => {
        this.renderer.setLook(look);
        this.uiManager.setLook(look);
        this.audio.setLook(look);
      });
    });

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

  /** The M key: the same switch as the music setting. */
  private toggleMusic(): void {
    this.unlockAudio();
    this.settings.cycle('musicMuted');
  }

  private get look(): Look {
    return this.classicSwitch.look.value;
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
   * Keeps a passed challenge in the profile (its reward comes with the money, stage 6) and shows
   * the attempt's result in place of the game-over menu.
   */
  private recordVerdict(verdict: ChallengeVerdict): void {
    const progress = this.profile.current.challenges;
    const isFirstPass =
      verdict.isPassed && challengeState(progress, verdict.challenge) !== 'passed';
    const after = isFirstPass ? markPassed(progress, verdict.challenge) : progress;
    if (isFirstPass) this.profile.update({ challenges: after });
    this.menuController.showChallengeResult({
      verdict,
      isAllPassed: isFirstPass && isEveryChallengePassed(after),
    });
  }

  /**
   * Starts a match: the challenge being played, a match of two players, or else a quick match set
   * up as the player last chose (the settings keep it). Restart and play again start the same.
   */
  public start(): void {
    this.setLandscape(this.isTwoPlayers);
    this.challengeJudge.judge(this.challenge);
    // The scene is set before the match starts: the effects ask for it on its matchStart
    if (this.challenge) {
      // A challenge is set up in advance: its own rules, paddles, level and backdrop
      const { rules, paddles, difficulty, scene } = CHALLENGES[this.challenge];
      this.matchScene = scene;
      this.flow.startMatch(
        this.forLook(rules),
        this.flow.playerVsCpu(paddles, this.skillsOf('player'), this.skillsOf('cpu')),
        difficulty,
      );
    } else if (this.isTwoPlayers) {
      // No CPU to set a level for: the ball plays at the default one's pace
      this.matchScene = null;
      this.flow.startMatch(
        this.forLook(quickMatchRules(this.settings.current.matchPoints)),
        this.flow.twoPlayers(this.inputHandler.players),
        TWO_PLAYER_PACE,
      );
    } else {
      this.matchScene = null;
      this.flow.startMatch(
        this.forLook(quickMatchRules(this.settings.current.matchPoints)),
        this.flow.playerVsCpu(undefined, this.skillsOf('player'), this.skillsOf('cpu')),
      );
    }
    this.uiManager.hideMenu();
    this.uiManager.setPauseButtonVisibility(true);
  }

  /**
   * The rules as the look plays them: the classic look is Pong as it was, with no Overdrive for
   * anyone (and no skills: `skillsOf`).
   */
  private forLook(rules: MatchRules): MatchRules {
    return this.look === 'classic' ? { ...rules, overdrive: false, cpuOverdrive: false } : rules;
  }

  /**
   * The skills the player, or the CPU, brings to a match against the CPU: a developer's, in the
   * neon look.
   */
  private skillsOf(owner: SkillOwner): readonly SkillId[] {
    return this.look === 'classic' ? [] : this.pinnedSkills[owner];
  }

  /**
   * For developers, from the skill menu: the player's or the CPU's skills from now on, in the
   * match on court at once if it is one against the CPU.
   */
  private chooseSkills(owner: SkillOwner, skills: readonly SkillId[]): void {
    this.pinnedSkills[owner] = skills;
    if (this.flow.isDemo || this.isTwoPlayers) return;
    this.paddles.forEach((_, i) => {
      const isPlayers = this.flow.isPlayerPaddle(i);
      if (isPlayers === (owner === 'player')) this.flow.giveSkills(i, this.skillsOf(owner));
    });
  }

  /** Counts each skill's uses in the match on court, the player's and the CPU's, for the menu. */
  private countSkillUse(event: MatchEvent): void {
    if (event.type === 'matchStart') this.skillUses.clear();
    else if (event.type === 'skill') {
      const uses = this.skillUses.get(event.skill) ?? [0, 0];
      uses[this.flow.isPlayerPaddle(event.paddleIndex) ? 0 : 1]++;
      this.skillUses.set(event.skill, uses);
    } else return;
    this.skillMenu.setCounts(this.skillUses);
  }

  /** The match on court again from 0:0, on the backdrop it was being played on. */
  public restart(): void {
    this.isRestarting = true;
    try {
      this.start();
    } finally {
      this.isRestarting = false;
    }
  }

  public toMenu(): void {
    this.setLandscape(false);
    this.flow.returnToMenu();
    this.uiManager.setPauseButtonVisibility(false);
    this.menuController.showMainMenu();
  }

  /**
   * Whether a challenge's condition is drawn on the court: only on a phone on its side, whose
   * controls sit in the narrow margin beside the court with no strip above it (bars.css).
   */
  private get isConditionOnCourt(): boolean {
    return this.sideDock.matches;
  }

  /**
   * Whether the picture is drawn upright for a phone held portrait. The stage is turned on such a
   * phone either way (the court's long side along the screen's); in landscape the picture is left
   * as it is, so it reads with the phone held sideways.
   */
  private get isPortraitView(): boolean {
    return this.inputHandler.isRotated && !this.isLandscape;
  }

  /**
   * Turns two players' match to landscape, or back. An installed app may lock the screen to it;
   * a browser tab refuses, and the turned picture and menus (`game--landscape`) do instead.
   */
  private setLandscape(isOn: boolean): void {
    if (isOn === this.isLandscape) return;
    this.isLandscape = isOn;
    document.getElementById('gameContainer')?.classList.toggle('game--landscape', isOn);
    const orientation = (typeof screen === 'undefined' ? undefined : screen.orientation) as
      (ScreenOrientation & { lock?: (orientation: string) => Promise<void> }) | undefined;
    try {
      if (isOn) orientation?.lock?.('landscape').catch(() => {});
      else orientation?.unlock?.();
    } catch {
      // No orientation lock here: the turned picture stands in for it
    }
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
    this.audio.playMusic(this.buildMusicState());

    // A challenge's condition: in the strip above the court, or on the court on a phone on its
    // side, which has no strip
    const condition = this.flow.isDemo
      ? null
      : describeCondition(
          this.i18n,
          this.flow,
          this.challenge ? CHALLENGES[this.challenge].goal : null,
          this.challengeJudge.progress,
        );
    this.conditionBar.update(condition, !this.isConditionOnCourt);
    const frame = this.buildRenderFrame(condition);
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
   * random and cut straight in: the channels flick past only when a match starts.
   */
  private onQuickMatchSetup(isShown: boolean): void {
    if (isShown) {
      this.previewBackground(this.settings.current.matchBackground);
    } else if (this.renderer.isShowingMystery) {
      this.audio.music.enterScene(this.renderer.switchChannel(false));
      this.showDebugDetail();
    }
  }

  /**
   * The backdrop behind a menu, cut straight in with its song. A challenge's card shows its own;
   * the others the player's: a mode's own backdrop left from a challenge gives way to the chosen
   * one, or with random to one drawn at random, and a pickable one already there stays. Never
   * during a match, nor over a developer's pin.
   */
  private showMenuScene(scene: SceneId | null): void {
    if (this.flow.phase !== 'attract') return;
    const current = this.renderer.scene;
    const isPlayers = isPickableScene(current) && !this.renderer.isShowingMystery;
    if (scene === null ? isPlayers : current === scene) return;
    this.audio.music.enterScene(this.renderer.switchChannel(false, scene));
    this.showDebugDetail();
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
      isMuted: this.settings.current.musicMuted,
      difficulty,
    };
  }

  private buildRenderFrame(condition: Condition | null): RenderFrame {
    return {
      court: {
        gameState: this.flow.gameState,
        isDemo: this.flow.isDemo,
        paddles: this.paddles,
        scores: this.flow.scores,
        balls: this.flow.balls,
        ball: this.flow.leadBall,
        // The moment the ball and paddles are drawn at, between the last two steps (never before
        // the clock starts: a tape counter would read -1)
        time: Math.max(0, this.flow.time - this.simulation.lag),
        serveTime: this.flow.serveTime,
        rally: this.flow.rally,
        timeWarp: this.flow.timeWarp,
        shotReads: this.flow.shotReads,
      },
      hud: {
        readyText: this.i18n.t(this.flow.isDecidingPoint ? 'decider' : 'ready'),
        condition,
        isConditionOnCourt: this.isConditionOnCourt,
        sideLabels: this.isTwoPlayers && !this.flow.isDemo ? this.i18n.t('playerLabels') : null,
        overdriveCharges: this.flow.overdriveCharges,
        overdriveStreaks: this.flow.overdriveStreaks,
      },
      drama: {
        climax: this.effects.climaxLevel,
        vignette: this.effects.vignette,
        zoom: this.effects.cameraZoom,
        paddleGlow: this.effects.paddleGlow,
        paddleTilt: this.effects.paddleTilt,
        meterSpent: this.effects.meterSpent,
      },
      particles: this.particles,
      analyser: this.audio.music.getAnalyser(),
      isRotated: this.isPortraitView,
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
    this.stopFollowingLook();
    this.classicSwitch.dispose();
    this.inputHandler.dispose();
    this.uiManager.dispose();
    this.renderer.dispose();
    this.audio.dispose();
    this.fpsMeter.dispose();
    this.backgroundMenu.dispose();
    this.skillMenu.dispose();
  }
}
