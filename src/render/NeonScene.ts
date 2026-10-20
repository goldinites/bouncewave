import { COURT } from '@/match/config';
import { BackgroundRenderer } from '@/render/BackgroundRenderer';
import { CourtRenderer } from '@/render/CourtRenderer';
import { EntityRenderer } from '@/render/EntityRenderer';
import { FinalScoreRenderer } from '@/render/FinalScoreRenderer';
import { HudRenderer } from '@/render/HudRenderer';
import { DARKNESS, Flash, ModifierRenderer } from '@/render/ModifierRenderer';
import { RenderFrame, Scene, SceneState } from '@/render/scene';
import {
  AFTERIMAGES,
  Afterimage,
  ARC_TRAIL,
  SkillRenderer,
  TrailPoint,
} from '@/render/SkillRenderer';
import { Ball } from '@/match/Ball';
import { approach, clamp } from '@/shared/math';

// Lightweight scene dimming behind the menus and the pause
const MENU_DIM_RGB = '8, 2, 26';
// Deciding-point vignette
const VIGNETTE = { RGB: '4, 0, 14', MAX_ALPHA: 0.6 } as const;
const SHAKE_FROM = 0.2; // px; a weaker shake isn't worth moving the court for
const FLASH_ALPHA = 0.25; // of a full flash
const TIME_WARP_FADE = 14; // 1/s the slowed world's cast comes and goes at
// A turbo ball's heat: none at the serve's speed, full this much faster (px/s)
const TURBO_HEAT = { FROM: 380, SPAN: 520 } as const;

/**
 * Where a layer is drawn: `backdrop` under the camera's zoom; `court` under the zoom and the
 * screen shake (the backdrop takes the shake as its own parallax); `screen` over everything, fixed.
 */
export type LayerSpace = 'backdrop' | 'court' | 'screen';

/** One thing the neon scene draws, in its place in the order. */
export interface Layer {
  readonly id: string;
  readonly space: LayerSpace;
  render(ctx: CanvasRenderingContext2D, frame: RenderFrame, state: SceneState): void;
}

/**
 * The neon look's picture: an ordered list of layers, from the backdrop to the screen's overlays.
 * The camera zooms on the lead ball and the court shakes; the overlays stay put. Each layer reads
 * only its part of the frame. Effects that draw (4.3) join the list as layers of their own.
 */
export class NeonScene implements Scene {
  private readonly layers: readonly Layer[];
  private readonly isMotionReduced: () => boolean;

  /**
   * @param ctx the canvas the scene draws on, to build its gradients once
   * @param isMotionReduced no shake or zoom when the player asked for less motion
   */
  constructor(
    ctx: CanvasRenderingContext2D,
    background: BackgroundRenderer,
    isMotionReduced: () => boolean,
  ) {
    this.isMotionReduced = isMotionReduced;
    this.layers = neonLayers(ctx, background, isMotionReduced);
  }

  public render(ctx: CanvasRenderingContext2D, frame: RenderFrame, state: SceneState): void {
    // Camera: everything up to the screen overlays zooms in on the ball
    ctx.save();
    this.applyZoom(ctx, frame);
    this.renderSpace('backdrop', ctx, frame, state);

    ctx.save();
    if (state.shake > SHAKE_FROM) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
    this.renderSpace('court', ctx, frame, state);
    ctx.restore();
    ctx.restore();

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.renderSpace('screen', ctx, frame, state);
  }

  private renderSpace(
    space: LayerSpace,
    ctx: CanvasRenderingContext2D,
    frame: RenderFrame,
    state: SceneState,
  ): void {
    for (const layer of this.layers) {
      if (layer.space === space) layer.render(ctx, frame, state);
    }
  }

  /**
   * Scales the scene around the lead ball. The focus is kept on the court, so the zoomed scene
   * always covers the whole canvas even when the ball is already past the goal line.
   */
  private applyZoom(ctx: CanvasRenderingContext2D, frame: RenderFrame): void {
    const { zoom } = frame.drama;
    if (zoom <= 1.001 || this.isMotionReduced()) return;
    const { ball } = frame.court;
    const x = clamp(ball.drawX, 0, COURT.WIDTH);
    const y = clamp(ball.drawY, 0, COURT.HEIGHT);
    ctx.translate(x, y);
    ctx.scale(zoom, zoom);
    ctx.translate(-x, -y);
  }
}

/** The neon scene's layers, bottom to top. */
function neonLayers(
  ctx: CanvasRenderingContext2D,
  background: BackgroundRenderer,
  isMotionReduced: () => boolean,
): Layer[] {
  const hud = new HudRenderer(isMotionReduced);

  // Built once in game coordinates; its strength is applied with globalAlpha
  const vignette = ctx.createRadialGradient(
    COURT.WIDTH / 2,
    COURT.HEIGHT / 2,
    COURT.HEIGHT * 0.35,
    COURT.WIDTH / 2,
    COURT.HEIGHT / 2,
    COURT.WIDTH * 0.62,
  );
  vignette.addColorStop(0, `rgba(${VIGNETTE.RGB}, 0)`);
  vignette.addColorStop(1, `rgba(${VIGNETTE.RGB}, 1)`);

  const fillScreen = (c: CanvasRenderingContext2D) => c.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);

  // Arc's trail of each spinning ball: laid while it spins, fading once it has stopped; a ball
  // spun again starts a new one
  const arcTrails = new Map<Ball, { points: TrailPoint[]; isLaying: boolean }>();
  const followArcTrails = (balls: readonly Ball[], realDt: number) => {
    for (const ball of balls) {
      const trail = arcTrails.get(ball);
      if (ball.spin !== 0 && !trail?.isLaying) arcTrails.set(ball, { points: [], isLaying: true });
    }
    for (const [ball, trail] of arcTrails) {
      const { points } = trail;
      for (const point of points) point.age += realDt;
      while (points.length > 0 && points[0].age >= ARC_TRAIL.LIFE) points.shift();
      trail.isLaying = ball.spin !== 0 && balls.includes(ball);
      if (trail.isLaying) points.push({ x: ball.drawX, y: ball.drawY, age: 0 });
      else if (points.length === 0) arcTrails.delete(ball);
    }
  };

  // The HUD; the final score takes its place at the end of a match
  const drawHud = (c: CanvasRenderingContext2D, frame: RenderFrame, state: SceneState) => {
    const { court, hud: view, isRotated } = frame;
    if (court.isDemo || state.finalSign) return;
    hud.render(
      c,
      state.realDt,
      court.paddles,
      court.scores,
      court.serveTime,
      view.readyText,
      court.time,
      isRotated,
      view.condition,
      view.sideLabels,
      view.isConditionOnCourt,
    );
  };

  // In the dark, a ball flashes wherever it bounces (it turns around, up or down or across)
  const flashes: Flash[] = [];
  const headings = new Map<Ball, { vx: number; vy: number }>();
  const followFlashes = (balls: readonly Ball[], realDt: number) => {
    for (const flash of flashes) flash.age += realDt;
    while (flashes.length > 0 && flashes[0].age >= DARKNESS.FLASH_LIFE) flashes.shift();
    for (const ball of balls) {
      const before = headings.get(ball);
      const turned =
        before &&
        (Math.sign(before.vx) !== Math.sign(ball.vx) ||
          Math.sign(before.vy) !== Math.sign(ball.vy));
      if (turned) flashes.push({ x: ball.drawX, y: ball.drawY, age: 0 });
      headings.set(ball, { vx: ball.vx, vy: ball.vy });
    }
  };

  // The slowed world (Reflex): its screen eases in and out, and the paddle that slowed it leaves
  // afterimages, which fade on after it ends. Followed once a frame by the first of its layers
  const warpEdges = SkillRenderer.warpEdges(ctx);
  const warp = { level: 0, sinceAfterimage: Infinity, color: 0 };
  const afterimages: Afterimage[] = [];
  const followWarp = ({ court }: RenderFrame, { realDt }: SceneState) => {
    const { timeWarp } = court;
    warp.level = approach(warp.level, timeWarp ? 1 : 0, TIME_WARP_FADE, realDt);
    for (const image of afterimages) image.age += realDt;
    while (afterimages.length > 0 && afterimages[0].age >= AFTERIMAGES.LIFE) afterimages.shift();

    warp.sinceAfterimage += realDt;
    const paddle = timeWarp && court.paddles[timeWarp.paddleIndex];
    if (!paddle || warp.sinceAfterimage < AFTERIMAGES.INTERVAL) return;
    warp.sinceAfterimage = 0;
    warp.color = (warp.color + 1) % AFTERIMAGES.COLORS.length;
    const { width, height } = paddle.spec;
    afterimages.push({
      x: paddle.x,
      y: paddle.drawY,
      width,
      height,
      color: AFTERIMAGES.COLORS[warp.color],
      age: 0,
      back: paddle.side === 0 ? -1 : 1,
    });
  };

  return [
    {
      id: 'backdrop',
      space: 'backdrop',
      render: (c, frame, state) =>
        background.render(
          c,
          frame.analyser,
          frame.court.time,
          state.shake,
          frame.isRotated,
          state.mood,
        ),
    },
    { id: 'court', space: 'court', render: (c) => CourtRenderer.render(c) },
    {
      id: 'wind',
      space: 'court',
      render: (c, { court }) => {
        const { wind, windTurnsIn } = court.conditions;
        if (wind === 0) return;
        ModifierRenderer.renderWind(c, wind, windTurnsIn, court.time, isMotionReduced());
      },
    },
    {
      // The frozen court, under everything that moves on it
      id: 'ice',
      space: 'court',
      render: (c, { court }) => {
        if (court.modifiers.includes('ice')) {
          ModifierRenderer.renderIce(c, court.time, isMotionReduced());
        }
      },
    },
    {
      id: 'invisibleBand',
      space: 'court',
      render: (c, { court }) => {
        if (court.modifiers.includes('invisibleBand')) ModifierRenderer.renderBand(c);
      },
    },
    {
      id: 'bumpers',
      space: 'court',
      render: (c, { court }) => ModifierRenderer.renderBumpers(c, court.conditions.bumpers),
    },
    {
      id: 'bricks',
      space: 'court',
      render: (c, { court }) => ModifierRenderer.renderBricks(c, court.conditions.bricks),
    },
    {
      id: 'hud',
      space: 'court',
      render: (c, frame, state) => {
        // In the dark it is written over the dark instead, so it glows in it
        if (!frame.court.modifiers.includes('darkness')) drawHud(c, frame, state);
      },
    },
    {
      // The paddle that slowed the world leaves afterimages (not for a player who asked for less
      // motion, who keeps the screen's glow)
      id: 'afterimages',
      space: 'court',
      render: (c, frame, state) => {
        followWarp(frame, state);
        if (!isMotionReduced()) SkillRenderer.renderAfterimages(c, afterimages);
      },
    },
    {
      // Each person's paddle carries their Overdrive meter (only in a match that has Overdrive)
      id: 'paddles',
      space: 'court',
      render: (c, { court, hud: view, drama }, state) => {
        court.paddles.forEach((paddle, i) => {
          const charge = court.isDemo ? null : (view.overdriveCharges[i] ?? null);
          const streak = view.overdriveStreaks[i] ?? charge ?? 0;
          const pulse = charge === null ? 0 : EntityRenderer.overdrivePulse(streak, court.time);
          // A whipped paddle stays upright for a player who asked for less motion: the ball's
          // spin streaks still tell the curve
          const tilt = isMotionReduced() ? 0 : (drama.paddleTilt[i] ?? 0);
          EntityRenderer.renderPaddle(c, paddle, drama.paddleGlow[i], pulse, tilt);
          if (charge !== null && !state.finalSign) {
            EntityRenderer.renderOverdriveMeter(
              c,
              paddle,
              charge,
              court.time,
              streak,
              drama.meterSpent[i] ?? 0,
            );
          }
        });
      },
    },
    {
      // The curve a spinning ball (Arc) flies, laid out behind it
      id: 'arcTrail',
      space: 'court',
      render: (c, { court }, { realDt }) => {
        followArcTrails(court.serveTime > 0 ? [] : court.balls, realDt);
        for (const { points } of arcTrails.values()) SkillRenderer.renderArcTrail(c, points);
      },
    },
    {
      // The shots read ahead for their paddles (Analyzer)
      id: 'shotReads',
      space: 'court',
      render: (c, { court }) => {
        for (const read of court.shotReads) {
          const paddle = court.paddles[read.paddleIndex];
          SkillRenderer.renderShotRead(c, read, paddle, isMotionReduced());
        }
      },
    },
    {
      // A power shot burns as hot as the full rally climax
      id: 'balls',
      space: 'court',
      render: (c, { court, drama }) => {
        const isBanded = court.modifiers.includes('invisibleBand');
        const isTurbo = court.conditions.turbo !== 0;
        for (const ball of court.balls) {
          // The invisible band hides a ball crossing it
          if (isBanded && ModifierRenderer.isInBand(ball.drawX)) continue;
          // A turbo ball glows hotter the faster it has got
          const turbo = isTurbo ? clamp((ball.speed - TURBO_HEAT.FROM) / TURBO_HEAT.SPAN, 0, 1) : 0;
          const heat = Math.max(drama.climax, ball.isPowerShot ? 1 : 0, turbo);
          EntityRenderer.renderBall(c, ball, court.rally, court.time, court.serveTime, heat);
        }
      },
    },
    {
      // A spinning ball (Arc) shows its spin from the first frames of the curve
      id: 'ballSpin',
      space: 'court',
      render: (c, { court }) => {
        if (court.serveTime > 0) return;
        const isBanded = court.modifiers.includes('invisibleBand');
        for (const ball of court.balls) {
          if (isBanded && ModifierRenderer.isInBand(ball.drawX)) continue;
          SkillRenderer.renderSpin(c, ball, court.time);
        }
      },
    },
    {
      id: 'particles',
      space: 'court',
      render: (c, { particles }) => {
        EntityRenderer.renderParticles(c, particles.particles);
        EntityRenderer.renderShockwaves(c, particles.rings);
      },
    },
    {
      // Over the balls, so one in the dark middle is unseen; the paddles' lanes stay lit
      id: 'darkness',
      space: 'court',
      render: (c, frame, state) => {
        const { court } = frame;
        followFlashes(court.balls, state.realDt);
        if (!court.modifiers.includes('darkness')) return;
        // A ball waiting for the serve is lit, so the point is seen to start from it
        const waiting =
          court.serveTime > 0
            ? court.balls.map((ball) => ({ x: ball.drawX, y: ball.drawY, age: 0 }))
            : [];
        ModifierRenderer.renderDarkness(c, court.paddles, [...flashes, ...waiting]);
        drawHud(c, frame, state);
      },
    },
    {
      id: 'finalScore',
      space: 'court',
      render: (c, { isRotated }, state) => {
        if (state.finalSign) {
          FinalScoreRenderer.render(c, state.finalSign, state.finalSignAge, isRotated);
        }
      },
    },
    {
      id: 'timeWarp',
      space: 'screen',
      render: (c) => {
        if (warp.level >= 0.01) SkillRenderer.renderTint(c, warp.level, warpEdges);
      },
    },
    {
      // No canvas filters, extra buffers or blur passes: a plain fill
      id: 'menuDim',
      space: 'screen',
      render: (c, _frame, { menuDim }) => {
        if (menuDim <= 0.003) return;
        c.fillStyle = `rgba(${MENU_DIM_RGB}, ${menuDim})`;
        fillScreen(c);
      },
    },
    {
      id: 'vignette',
      space: 'screen',
      render: (c, { drama }) => {
        if (drama.vignette <= 0.01) return;
        // Canvas ignores a globalAlpha above 1 instead of clamping it
        c.globalAlpha = Math.min(1, drama.vignette * VIGNETTE.MAX_ALPHA);
        c.fillStyle = vignette;
        fillScreen(c);
        c.globalAlpha = 1;
      },
    },
    {
      id: 'flash',
      space: 'screen',
      render: (c, _frame, { flash }) => {
        if (flash <= 0) return;
        c.fillStyle = `rgba(255, 255, 255, ${flash * FLASH_ALPHA})`;
        fillScreen(c);
      },
    },
  ];
}
