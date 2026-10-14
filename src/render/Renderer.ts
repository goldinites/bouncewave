import { GAME_HEIGHT, GAME_WIDTH } from '@/constants/game.constants';
import { SCREEN_FLASH_DECAY, SCREEN_SHAKE_DECAY } from '@/constants/visual.constants';
import { Ball } from '@/entities/Ball';
import { Paddle } from '@/entities/Paddle';
import { ParticleSystem } from '@/entities/ParticleSystem';
import { GameMode, GameState } from '@/types/game.types';
import { BackgroundRenderer } from '@/render/BackgroundRenderer';
import { CourtRenderer } from '@/render/CourtRenderer';
import { EntityRenderer } from '@/render/EntityRenderer';
import { HudRenderer } from '@/render/HudRenderer';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private resizeObserver: ResizeObserver;

  public readonly background = new BackgroundRenderer();
  public screenShake = 0;
  public screenFlash = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
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
    _gameState: GameState,
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

    // Reset transform to handle high DPI
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    // Render animated background
    this.background.render(ctx, analyser, gameTime, this.screenShake, isRotated);

    ctx.save();

    // Apply screen shake offset
    if (this.screenShake > 0.2) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // Court boundaries
    CourtRenderer.render(ctx);

    // HUD (scores, "GET READY" prompt)
    if (gameMode > 0) {
      HudRenderer.render(ctx, paddles, serveTime, readyText, gameTime, isRotated);
    }

    // Paddles
    paddles.forEach((paddle) => EntityRenderer.renderPaddle(ctx, paddle));

    // Neon glowing Ball
    EntityRenderer.renderBall(ctx, ball, rally, gameTime, serveTime);

    // Particles & Shockwave rings
    EntityRenderer.renderParticles(ctx, particleSystem.particles);
    EntityRenderer.renderShockwaves(ctx, particleSystem.rings);

    ctx.restore();

    // Reset alpha and blend mode
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Screen flash overlay
    if (this.screenFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.screenFlash * 0.25})`;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
  }

  public dispose(): void {
    this.resizeObserver.disconnect();
  }
}
