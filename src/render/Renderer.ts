import { CSS_CLASSES, GAME_HEIGHT, GAME_WIDTH } from '@/constants/game.constants';
import {
  LOSS_DURATION,
  SCREEN_FLASH_DECAY,
  SCREEN_SHAKE_DECAY,
  VICTORY_DURATION,
} from '@/constants/visual.constants';
import { Ball } from '@/entities/Ball';
import { Paddle } from '@/entities/Paddle';
import { ParticleSystem } from '@/entities/ParticleSystem';
import { GameMode, GameState } from '@/types/game.types';
import { BackgroundRenderer } from '@/render/BackgroundRenderer';
import { CourtRenderer } from '@/render/CourtRenderer';
import { EntityRenderer } from '@/render/EntityRenderer';
import { HudRenderer } from '@/render/HudRenderer';

// Lightweight scene dimming for menu and pause overlays
const MENU_DIM_RGB = '8, 2, 26';
const MENU_DIM_ALPHA = 0.6;
const MENU_DIM_SPEED = 8;

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private resizeObserver: ResizeObserver;

  public readonly background = new BackgroundRenderer();
  public screenShake = 0;
  public screenFlash = 0;

  private menuDim = MENU_DIM_ALPHA;
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

    this.resizeObserver = new ResizeObserver(() => this.fitToDisplay());
    this.resizeObserver.observe(this.canvas);

    this.fitToDisplay();
  }

  public fitToDisplay(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = this.canvas.clientWidth * dpr;
    this.canvas.height = this.canvas.clientHeight * dpr;

    this.scale = this.canvas.width / GAME_WIDTH;
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

    this.stage.classList.remove(CSS_CLASSES.CRT_GLITCH_ACTIVE, CSS_CLASSES.VICTORY_BURST_ACTIVE);

    void this.stage.offsetWidth;

    this.stage.classList.add(className);

    this.finalEffectTimer = window.setTimeout(() => {
      this.stage?.classList.remove(className);
      this.finalEffectTimer = null;
    }, duration);
  }

  public triggerCrtGlitch(duration = LOSS_DURATION): void {
    this.triggerFinalEffect('crt-glitch-active', duration);
  }

  public triggerVictoryEffect(duration = VICTORY_DURATION): void {
    this.triggerFinalEffect('victory-burst-active', duration);
  }

  public addShake(amount: number): void {
    this.screenShake = Math.max(this.screenShake, amount);
  }

  public addFlash(amount: number): void {
    this.screenFlash = Math.max(this.screenFlash, amount);
  }

  public update(dt: number, gameState: GameState, serveTime: number): void {
    const targetLaserIntensity = gameState === 'menu' || serveTime > 0 ? 1.0 : 0.12;

    this.background.laserIntensity +=
      (targetLaserIntensity - this.background.laserIntensity) * Math.min(1, dt * 2.5);

    this.screenShake *= Math.exp(-dt * SCREEN_SHAKE_DECAY);

    this.screenFlash = Math.max(0, this.screenFlash - dt * SCREEN_FLASH_DECAY);
  }

  public render(
    gameState: GameState,
    gameMode: GameMode,
    paddles: [Paddle, Paddle],
    ball: Ball,
    particleSystem: ParticleSystem,
    analyser: AnalyserNode | null,
    gameTime: number,
    serveTime: number,
    rally: number,
    readyText: string,
    isRotated: boolean,
  ): void {
    const ctx = this.ctx;

    // Independent clock for dimming, including while paused
    const now = performance.now();
    const frameDt = Math.min(0.1, (now - this.lastRenderTime) / 1000);
    this.lastRenderTime = now;

    const dimTarget = gameState === 'play' ? 0 : MENU_DIM_ALPHA;

    this.menuDim += (dimTarget - this.menuDim) * Math.min(1, frameDt * MENU_DIM_SPEED);

    // Reset transform for high-DPI displays
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    // Animated background
    this.background.render(ctx, analyser, gameTime, this.screenShake, isRotated);

    ctx.save();

    // Screen shake
    if (this.screenShake > 0.2) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;

      ctx.translate(shakeX, shakeY);
    }

    // Court boundaries
    CourtRenderer.render(ctx);

    // HUD
    if (gameMode > 0) {
      HudRenderer.render(ctx, paddles, serveTime, readyText, gameTime, isRotated);
    }

    // Paddles
    paddles.forEach((paddle) => EntityRenderer.renderPaddle(ctx, paddle));

    // Ball
    EntityRenderer.renderBall(ctx, ball, rally, gameTime, serveTime);

    // Particles and shockwaves
    EntityRenderer.renderParticles(ctx, particleSystem.particles);

    EntityRenderer.renderShockwaves(ctx, particleSystem.rings);

    ctx.restore();

    // Reset alpha and blend mode
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Lightweight menu / pause overlay
    // No canvas filters, extra buffers, or blur passes
    if (this.menuDim > 0.003) {
      ctx.fillStyle = `rgba(${MENU_DIM_RGB}, ${this.menuDim})`;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    // Screen flash
    if (this.screenFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.screenFlash * 0.25})`;

      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
  }

  public dispose(): void {
    this.resizeObserver.disconnect();

    if (this.finalEffectTimer !== null) {
      window.clearTimeout(this.finalEffectTimer);
      this.finalEffectTimer = null;
    }

    this.stage?.classList.remove(CSS_CLASSES.CRT_GLITCH_ACTIVE, CSS_CLASSES.VICTORY_BURST_ACTIVE);
  }
}
