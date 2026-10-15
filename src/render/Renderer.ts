import { ParticleSystem } from '@/fx/ParticleSystem';
import { Ball } from '@/match/Ball';
import { COURT } from '@/match/config';
import { GameState, GameMode } from '@/match/modes';
import { Paddle } from '@/match/Paddle';
import { BackgroundRenderer } from '@/render/BackgroundRenderer';
import { CourtRenderer } from '@/render/CourtRenderer';
import { EntityRenderer } from '@/render/EntityRenderer';
import { FinalScoreRenderer, FinalScoreSign } from '@/render/FinalScoreRenderer';
import { HudRenderer } from '@/render/HudRenderer';

// Lightweight scene dimming for menu and pause overlays
const MENU_DIM = { RGB: '8, 2, 26', ALPHA: 0.6, SPEED: 8 } as const;
// Match-point vignette
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

// CSS effects on the stage at the end of a match; durations must match main.css (ms)
const STAGE_CLASSES = {
  CRT_GLITCH: 'crt-glitch-active',
  VICTORY_BURST: 'victory-burst-active',
} as const;
const STAGE_EFFECT_MS = { VICTORY: 900, LOSS: 700 } as const;

/** Everything the renderer needs to draw (and animate toward) one frame. */
export interface RenderFrame {
  gameState: GameState;
  gameMode: GameMode;
  paddles: [Paddle, Paddle];
  ball: Ball;
  particles: ParticleSystem;
  analyser: AnalyserNode | null;
  time: number;
  serveTime: number;
  rally: number;
  readyText: string;
  isRotated: boolean;
  /** Edge darkening in [0, 1], driven by match-point drama. */
  vignette: number;
  /** Rally climax intensity in [0, 1]: lasers stay lit and the ball burns hotter. */
  climax: number;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private resizeObserver: ResizeObserver;

  public readonly background = new BackgroundRenderer();
  private readonly hud = new HudRenderer();
  private screenShake = 0;
  private screenFlash = 0;
  private laserSurge = 0;
  private vignetteGradient: CanvasGradient;

  private finalSign: FinalScoreSign | null = null;
  private finalSignAge = 0;

  private menuDim: number = MENU_DIM.ALPHA;
  private lastRenderTime = performance.now();

  private stage: HTMLElement | null = null;
  private finalEffectTimer: number | null = null;

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

  private triggerFinalEffect(
    className: 'crt-glitch-active' | 'victory-burst-active',
    duration: number,
  ): void {
    if (!this.stage) return;

    if (this.finalEffectTimer !== null) {
      window.clearTimeout(this.finalEffectTimer);
      this.finalEffectTimer = null;
    }

    this.stage.classList.remove(STAGE_CLASSES.CRT_GLITCH, STAGE_CLASSES.VICTORY_BURST);

    void this.stage.offsetWidth;

    this.stage.classList.add(className);

    this.finalEffectTimer = window.setTimeout(() => {
      this.stage?.classList.remove(className);
      this.finalEffectTimer = null;
    }, duration);
  }

  public triggerCrtGlitch(duration: number = STAGE_EFFECT_MS.LOSS): void {
    this.triggerFinalEffect(STAGE_CLASSES.CRT_GLITCH, duration);
  }

  public triggerVictoryEffect(duration: number = STAGE_EFFECT_MS.VICTORY): void {
    this.triggerFinalEffect(STAGE_CLASSES.VICTORY_BURST, duration);
  }

  public addShake(amount: number): void {
    this.screenShake = Math.max(this.screenShake, amount);
  }

  public addFlash(amount: number): void {
    this.screenFlash = Math.max(this.screenFlash, amount);
  }

  /**
   * Soft accent when the climax peaks: a gentle laser swell and flash, no screen shake.
   * Memphis shapes are not thrown outward here: the uniform push reads as a zoom of the
   * whole background mid-rally. That burst is kept for the victory celebration only.
   */
  public triggerClimaxSurge(): void {
    // Raises the laser target rather than the value, so the swell eases in
    this.laserSurge = LASERS.CLIMAX_SURGE;
    this.addFlash(CLIMAX_FLASH);
  }

  /** Victory: lasers flare and sweep through hues, Memphis shapes burst outward and heat up. */
  public celebrate(): void {
    this.laserSurge = LASERS.CELEBRATION_SURGE;
    this.background.celebration = 1;
    this.background.triggerDrop();
  }

  public showFinalScore(sign: FinalScoreSign): void {
    this.finalSign = sign;
    this.finalSignAge = 0;
  }

  public hideFinalScore(): void {
    this.finalSign = null;
    this.background.celebration = 0;
  }

  /** Advances time-based effects (shake, flash, lasers). Not called while paused. */
  public update(dt: number, frame: RenderFrame): void {
    const { gameState, serveTime, climax } = frame;
    this.laserSurge *= Math.exp(-dt * LASERS.SURGE_DECAY);
    this.finalSignAge += dt;

    const celebration = this.background.celebration;
    this.background.celebration = Math.max(0, celebration - dt * CELEBRATION_DECAY);

    // During play the climax lights lasers only part-way so the court stays readable;
    // the victory celebration (no play happening) may go all the way
    const climaxLasers = (LASERS.CLIMAX_MAX - 0.12) * climax;
    const celebrationLasers = 0.88 * celebration;
    const playLaserIntensity = 0.12 + Math.max(climaxLasers, celebrationLasers) + this.laserSurge;
    const targetLaserIntensity = gameState === 'menu' || serveTime > 0 ? 1.0 : playLaserIntensity;

    this.background.laserIntensity +=
      (targetLaserIntensity - this.background.laserIntensity) * Math.min(1, dt * 2.5);

    this.screenShake *= Math.exp(-dt * SHAKE_DECAY);

    this.screenFlash = Math.max(0, this.screenFlash - dt * FLASH_DECAY);
  }

  public render(frame: RenderFrame): void {
    const { gameState, gameMode, paddles, ball, particles, serveTime, isRotated } = frame;
    const gameTime = frame.time;
    const ctx = this.ctx;

    // Independent clock for dimming, including while paused
    const now = performance.now();
    const frameDt = Math.min(0.1, (now - this.lastRenderTime) / 1000);
    this.lastRenderTime = now;

    const dimTarget = gameState === 'play' ? 0 : MENU_DIM.ALPHA;

    this.menuDim += (dimTarget - this.menuDim) * Math.min(1, frameDt * MENU_DIM.SPEED);

    // Reset transform for high-DPI displays
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    // Animated background
    this.background.climax = frame.climax;
    this.background.render(ctx, frame.analyser, gameTime, this.screenShake, isRotated);

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
    if (gameMode === GameMode.PLAYER_VS_AI && !this.finalSign) {
      this.hud.render(ctx, paddles, serveTime, frame.readyText, gameTime, isRotated);
    }

    // Paddles
    paddles.forEach((paddle) => EntityRenderer.renderPaddle(ctx, paddle));

    // Ball
    EntityRenderer.renderBall(ctx, ball, frame.rally, gameTime, serveTime, frame.climax);

    // Particles and shockwaves
    EntityRenderer.renderParticles(ctx, particles.particles);

    EntityRenderer.renderShockwaves(ctx, particles.rings);

    if (this.finalSign) {
      FinalScoreRenderer.render(ctx, this.finalSign, this.finalSignAge, isRotated);
    }

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

    // Match-point vignette
    if (frame.vignette > 0.01) {
      ctx.globalAlpha = frame.vignette * VIGNETTE.MAX_ALPHA;
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

  public dispose(): void {
    this.resizeObserver.disconnect();

    if (this.finalEffectTimer !== null) {
      window.clearTimeout(this.finalEffectTimer);
      this.finalEffectTimer = null;
    }

    this.stage?.classList.remove(STAGE_CLASSES.CRT_GLITCH, STAGE_CLASSES.VICTORY_BURST);
  }
}
