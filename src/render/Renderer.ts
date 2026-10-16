import { ParticleSystem } from '@/fx/ParticleSystem';
import { Ball } from '@/match/Ball';
import { COURT } from '@/match/config';
import { GameState } from '@/match/GameState';
import { Paddle } from '@/match/Paddle';
import { BackgroundRenderer } from '@/render/BackgroundRenderer';
import { CourtRenderer } from '@/render/CourtRenderer';
import { EntityRenderer } from '@/render/EntityRenderer';
import { FinalScoreRenderer, FinalScoreSign } from '@/render/FinalScoreRenderer';
import { HudRenderer } from '@/render/HudRenderer';
import { clamp } from '@/shared/math';

// Lightweight scene dimming for menu and pause overlays
const MENU_DIM = { RGB: '8, 2, 26', ALPHA: 0.6, SPEED: 8 } as const;
// Deciding-point vignette
const VIGNETTE = { RGB: '4, 0, 14', MAX_ALPHA: 0.6 } as const;
// Screen shake fades exponentially, flash linearly (1/s)
const SHAKE_DECAY = 9;
const FLASH_DECAY = 3;

// Laser background during play: at full climax lasers only rise to CLIMAX_MAX so the court
// stays readable; surges add on top and fade out
const LASERS = {
  CLIMAX_MAX: 0.6,
  CLIMAX_SURGE: 0.2, // on the climax drop
  CELEBRATION_SURGE: 1.0,
  SURGE_DECAY: 1.5, // 1/s
} as const;
const CLIMAX_FLASH = 0.2; // soft flash on the drop, no screen shake
const CELEBRATION_DECAY = 0.45; // 1/s, linear

// CSS effects on the stage at the end of a match; their animations live in main.css
const STAGE_CLASSES = {
  CRT_GLITCH: 'crt-glitch-active',
  VICTORY_BURST: 'victory-burst-active',
} as const;
type StageClass = (typeof STAGE_CLASSES)[keyof typeof STAGE_CLASSES];

/** Everything the renderer needs to draw (and animate toward) one frame. */
export interface RenderFrame {
  gameState: GameState;
  /** The AI-vs-AI demo behind the menus (no HUD). */
  isDemo: boolean;
  paddles: [Paddle, Paddle];
  ball: Ball;
  particles: ParticleSystem;
  analyser: AnalyserNode | null;
  time: number;
  serveTime: number;
  rally: number;
  readyText: string;
  isRotated: boolean;
  /** Edge darkening from the deciding-point drama: 0 = none, may go above 1 on a heartbeat. */
  vignette: number;
  /** Camera zoom centered on the ball (1 = none). */
  zoom: number;
  /** Rally climax intensity in [0, 1]: lasers stay lit and the ball burns hotter. */
  climax: number;
  /** Hit glow of each paddle in [0, 1]. */
  paddleGlow: readonly [number, number];
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private resizeObserver: ResizeObserver;

  private readonly background = new BackgroundRenderer();
  private readonly hud = new HudRenderer();
  private screenShake = 0;
  private screenFlash = 0;
  private laserSurge = 0;
  /** Laser brightness, eased toward a target that depends on what is happening. */
  private laserIntensity = 1.0;
  /** Victory celebration in [0, 1]: lasers sweep through hues, Memphis heats up. */
  private celebration = 0;
  private vignetteGradient: CanvasGradient;

  private finalSign: FinalScoreSign | null = null;
  private finalSignAge = 0;

  private menuDim: number = MENU_DIM.ALPHA;

  private stage: HTMLElement | null = null;
  /** Bumped on every stage effect, so a finishing older one never clears a newer one. */
  private stageEffectId = 0;

  /** The classic-mode easter egg; also silences every flashy feedback method below. */
  private isClassicMode = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.stage = canvas.closest('#gameStage');

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context not supported');
    }

    this.ctx = context;

    // Built once in game coordinates; strength is applied via globalAlpha
    this.vignetteGradient = context.createRadialGradient(
      COURT.WIDTH / 2,
      COURT.HEIGHT / 2,
      COURT.HEIGHT * 0.35,
      COURT.WIDTH / 2,
      COURT.HEIGHT / 2,
      COURT.WIDTH * 0.62,
    );
    this.vignetteGradient.addColorStop(0, `rgba(${VIGNETTE.RGB}, 0)`);
    this.vignetteGradient.addColorStop(1, `rgba(${VIGNETTE.RGB}, 1)`);

    this.resizeObserver = new ResizeObserver(() => this.fitToDisplay());
    this.resizeObserver.observe(this.canvas);

    this.fitToDisplay();
  }

  public fitToDisplay(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = this.canvas.clientWidth * dpr;
    this.canvas.height = this.canvas.clientHeight * dpr;

    this.scale = this.canvas.width / COURT.WIDTH;
  }

  /**
   * Plays a CSS effect on the stage. The class stays on until the animations it starts on the
   * stage (pseudo-elements included) have finished, so their durations live only in the CSS.
   * With reduced motion those animations are switched off and the class is removed at once.
   */
  private triggerStageEffect(className: StageClass): void {
    const stage = this.stage;
    if (!stage || this.isClassicMode) return;

    const id = ++this.stageEffectId;
    stage.classList.remove(STAGE_CLASSES.CRT_GLITCH, STAGE_CLASSES.VICTORY_BURST);
    // Reflow so re-adding the same class restarts its animations
    void stage.offsetWidth;
    stage.classList.add(className);

    const animations = (stage.getAnimations?.({ subtree: true }) ?? []).filter(
      (animation) =>
        animation.effect instanceof KeyframeEffect &&
        animation.effect.target === stage &&
        Number.isFinite(animation.effect.getComputedTiming().endTime),
    );

    Promise.all(animations.map((animation) => animation.finished)).then(
      () => {
        if (id === this.stageEffectId) stage.classList.remove(className);
      },
      () => {
        // Cancelled because a newer effect replaced the class
      },
    );
  }

  public triggerCrtGlitch(): void {
    this.triggerStageEffect(STAGE_CLASSES.CRT_GLITCH);
  }

  public triggerVictoryEffect(): void {
    this.triggerStageEffect(STAGE_CLASSES.VICTORY_BURST);
  }

  public addShake(amount: number): void {
    if (this.isClassicMode) return;
    this.screenShake = Math.max(this.screenShake, amount);
  }

  public addFlash(amount: number): void {
    if (this.isClassicMode) return;
    this.screenFlash = Math.max(this.screenFlash, amount);
  }

  /**
   * Soft accent when the climax peaks: a gentle laser swell and flash, no screen shake.
   * Memphis shapes are not thrown outward here: the uniform push reads as a zoom of the
   * whole background mid-rally. That burst is kept for the victory celebration only.
   */
  public triggerClimaxSurge(): void {
    if (this.isClassicMode) return;
    // Raises the laser target rather than the value, so the swell eases in
    this.laserSurge = LASERS.CLIMAX_SURGE;
    this.addFlash(CLIMAX_FLASH);
  }

  /** Victory: lasers flare and sweep through hues, Memphis shapes burst outward and heat up. */
  public celebrate(): void {
    if (this.isClassicMode) return;
    this.laserSurge = LASERS.CELEBRATION_SURGE;
    this.celebration = 1;
    this.background.triggerDrop();
  }

  /** Switches to the other background (on every return to the menu). */
  public nextBackground(): void {
    this.background.nextBackground();
  }

  /** Swaps the whole canvas scene for a flat monochrome 1972 look, with no flashy feedback. */
  public setClassicMode(enabled: boolean): void {
    this.isClassicMode = enabled;
  }

  public get classicMode(): boolean {
    return this.isClassicMode;
  }

  public showFinalScore(sign: FinalScoreSign): void {
    this.finalSign = sign;
    this.finalSignAge = 0;
  }

  public hideFinalScore(): void {
    this.finalSign = null;
    this.celebration = 0;
  }

  /** Advances time-based effects (shake, flash, lasers). Not called while paused. */
  public update(dt: number, frame: RenderFrame): void {
    const { gameState, serveTime, climax } = frame;
    this.laserSurge *= Math.exp(-dt * LASERS.SURGE_DECAY);
    this.finalSignAge += dt;

    this.celebration = Math.max(0, this.celebration - dt * CELEBRATION_DECAY);

    // During play the climax lights lasers only part-way so the court stays readable;
    // the victory celebration (no play happening) may go all the way
    const climaxLasers = (LASERS.CLIMAX_MAX - 0.12) * climax;
    const celebrationLasers = 0.88 * this.celebration;
    const playLaserIntensity = 0.12 + Math.max(climaxLasers, celebrationLasers) + this.laserSurge;
    const targetLaserIntensity = gameState === 'menu' || serveTime > 0 ? 1.0 : playLaserIntensity;

    this.laserIntensity += (targetLaserIntensity - this.laserIntensity) * Math.min(1, dt * 2.5);

    this.screenShake *= Math.exp(-dt * SHAKE_DECAY);

    this.screenFlash = Math.max(0, this.screenFlash - dt * FLASH_DECAY);
  }

  /**
   * Draws the frame. `realDt` is wall-clock time since the last frame, paused frames
   * included, for the few things that keep moving behind the pause menu.
   */
  public render(frame: RenderFrame, realDt: number): void {
    const { gameState, isDemo, paddles, ball, particles, serveTime, isRotated } = frame;
    const gameTime = frame.time;
    const ctx = this.ctx;

    const dimTarget = gameState === 'play' ? 0 : MENU_DIM.ALPHA;

    this.menuDim += (dimTarget - this.menuDim) * Math.min(1, realDt * MENU_DIM.SPEED);

    // Reset transform for high-DPI displays
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    if (this.isClassicMode) {
      this.renderClassic(frame, realDt);
      return;
    }

    // Camera: everything up to the screen overlays zooms in on the ball
    ctx.save();
    this.applyZoom(frame.zoom, ball.x, ball.y);

    // Animated background
    this.background.render(ctx, frame.analyser, gameTime, this.screenShake, isRotated, {
      laserIntensity: this.laserIntensity,
      climax: frame.climax,
      celebration: this.celebration,
    });

    ctx.save();

    // Screen shake
    if (this.screenShake > 0.2) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;

      ctx.translate(shakeX, shakeY);
    }

    // Court boundaries
    CourtRenderer.render(ctx);

    // HUD (the final-score sign takes its place at the end of a match)
    if (!isDemo && !this.finalSign) {
      this.hud.render(ctx, realDt, paddles, serveTime, frame.readyText, gameTime, isRotated);
    }

    // Paddles
    paddles.forEach((paddle, i) => EntityRenderer.renderPaddle(ctx, paddle, frame.paddleGlow[i]));

    // Ball
    EntityRenderer.renderBall(ctx, ball, frame.rally, gameTime, serveTime, frame.climax);

    // Particles and shockwaves
    EntityRenderer.renderParticles(ctx, particles.particles);

    EntityRenderer.renderShockwaves(ctx, particles.rings);

    if (this.finalSign) {
      FinalScoreRenderer.render(ctx, this.finalSign, this.finalSignAge, isRotated);
    }

    ctx.restore();
    ctx.restore();

    // Reset alpha and blend mode
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Lightweight menu / pause overlay
    // No canvas filters, extra buffers, or blur passes
    if (this.menuDim > 0.003) {
      ctx.fillStyle = `rgba(${MENU_DIM.RGB}, ${this.menuDim})`;
      ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);
    }

    // Deciding-point vignette
    if (frame.vignette > 0.01) {
      // Canvas ignores a globalAlpha above 1 instead of clamping it
      ctx.globalAlpha = Math.min(1, frame.vignette * VIGNETTE.MAX_ALPHA);
      ctx.fillStyle = this.vignetteGradient;
      ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);
      ctx.globalAlpha = 1;
    }

    // Screen flash
    if (this.screenFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.screenFlash * 0.25})`;

      ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);
    }
  }

  /**
   * The classic-mode easter egg's whole scene: flat black and white, no background, glow,
   * particles, shake, zoom or vignette — just the court, the paddles, the ball and the score.
   */
  private renderClassic(frame: RenderFrame, realDt: number): void {
    const { isDemo, paddles, ball, serveTime, isRotated } = frame;
    const ctx = this.ctx;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);

    CourtRenderer.renderClassic(ctx);

    if (!isDemo && !this.finalSign) {
      this.hud.render(
        ctx,
        realDt,
        paddles,
        serveTime,
        frame.readyText,
        frame.time,
        isRotated,
        true,
      );
    }

    paddles.forEach((paddle) => EntityRenderer.renderClassicPaddle(ctx, paddle));
    EntityRenderer.renderClassicBall(ctx, ball);

    if (this.finalSign) {
      FinalScoreRenderer.render(ctx, this.finalSign, this.finalSignAge, isRotated, true);
    }

    if (this.menuDim > 0.003) {
      ctx.fillStyle = `rgba(0, 0, 0, ${this.menuDim})`;
      ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);
    }
  }

  /**
   * Scales the scene around a focus point. The focus is kept on the court, so the zoomed scene
   * always covers the whole canvas even when the ball is already past the goal line.
   */
  private applyZoom(zoom: number, focusX: number, focusY: number): void {
    if (zoom <= 1.001) return;

    const x = clamp(focusX, 0, COURT.WIDTH);
    const y = clamp(focusY, 0, COURT.HEIGHT);
    this.ctx.translate(x, y);
    this.ctx.scale(zoom, zoom);
    this.ctx.translate(-x, -y);
  }

  public dispose(): void {
    this.resizeObserver.disconnect();

    this.stageEffectId++;
    this.stage?.classList.remove(STAGE_CLASSES.CRT_GLITCH, STAGE_CLASSES.VICTORY_BURST);
  }
}
