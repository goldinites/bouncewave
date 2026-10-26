import { Ball } from '@/match/Ball';
import { COURT } from '@/match/config';
import { Paddle } from '@/match/Paddle';
import { Side } from '@/match/side';
import { COURT_LINES } from '@/render/CourtRenderer';
import { EntityRenderer } from '@/render/EntityRenderer';
import { FINAL_SIGN_LAYOUT, FinalScoreSign } from '@/render/FinalScoreRenderer';
import { drawConditionLine, HUD_LAYOUT, overtimeSignY } from '@/render/HudRenderer';
import { CourtView, HudView, RenderFrame, Scene, SceneState } from '@/render/scene';
import { COLORS } from '@/shared/palette';

// Everything in the 1972 monitor's one colour on black, in a plain monospace
const INK = COLORS.WHITE;
const PAPER = '#000000';
const MONO = (size: number) => `700 ${size}px 'Courier New', monospace`;
const CLASSIC = {
  SCORE: 56, // px
  SIDE_LABEL: 16, // px
  CONDITION_SHRINK: 4, // px smaller than the neon condition line, Courier being wider
  CONDITION_ALPHA: 0.8,
  FINAL_LABEL: 26, // px
  FINAL_SCORE: 96, // px
  METER_UNLIT_ALPHA: 0.18,
} as const;

/**
 * The classic look's whole scene: flat white on black, the way the original hardware drew
 * Pong. No backdrop, glow, particles, shake, zoom, vignette or "get ready" prompt; scores and
 * the final score printed at once, without pop or ignition. Everything the match shows is still
 * here: both scores (or a challenge's line in their place), the side labels of two players, the
 * Overdrive meters, every ball.
 */
export class ClassicScene implements Scene {
  /** The final score and the menus' darkening come from `state`; nothing else of it shows. */
  public render(ctx: CanvasRenderingContext2D, frame: RenderFrame, state: SceneState): void {
    const { court, hud, isRotated } = frame;
    const { isDemo, paddles } = court;
    const { finalSign, menuDim } = state;

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;

    this.renderCourt(ctx);
    const isMatchOn = !isDemo && !finalSign;
    if (isMatchOn) this.renderHud(ctx, court, hud, isRotated);

    paddles.forEach((paddle, i) => {
      this.renderPaddle(ctx, paddle);
      const charge = hud.overdriveCharges[i] ?? null;
      if (isMatchOn && charge !== null) {
        this.renderMeter(ctx, paddle, charge, hud.overdriveCapacities?.[i]);
      }
    });
    court.balls.forEach((ball) => this.renderBall(ctx, ball));

    if (finalSign) this.renderFinalScore(ctx, finalSign, isRotated);

    if (menuDim > 0.003) {
      ctx.fillStyle = `rgba(0, 0, 0, ${menuDim})`;
      ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);
    }
  }

  /** Flat white rails and net. */
  private renderCourt(ctx: CanvasRenderingContext2D): void {
    const { RAIL_THICKNESS, NET_WIDTH, NET_DASH } = COURT_LINES;
    ctx.save();
    ctx.fillRect(0, COURT.TOP_WALL - RAIL_THICKNESS, COURT.WIDTH, RAIL_THICKNESS);
    ctx.fillRect(0, COURT.HEIGHT - COURT.BOTTOM_WALL, COURT.WIDTH, RAIL_THICKNESS);
    ctx.setLineDash([...NET_DASH]);
    ctx.lineWidth = NET_WIDTH;
    ctx.beginPath();
    ctx.moveTo(COURT.WIDTH / 2, COURT.TOP_WALL + RAIL_THICKNESS);
    ctx.lineTo(COURT.WIDTH / 2, COURT.HEIGHT - COURT.BOTTOM_WALL - RAIL_THICKNESS);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Both scores as blocky digits, with each side's label under it when two play, turned with the
   * court on a phone held upright; a challenge's line under them or in their place.
   */
  private renderHud(
    ctx: CanvasRenderingContext2D,
    court: CourtView,
    hud: HudView,
    isRotated: boolean,
  ): void {
    const { condition, sideLabels } = hud;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const scores = condition?.replacesScore ? [] : court.scores;
    scores.forEach((score, index) => {
      ctx.save();
      ctx.translate(COURT.WIDTH / 2 + (index ? 1 : -1) * HUD_LAYOUT.SCORE_X, HUD_LAYOUT.SCORE_Y);
      if (isRotated) ctx.rotate(Math.PI / 2);
      ctx.font = MONO(CLASSIC.SCORE);
      ctx.fillText(String(score), 0, 0);
      const label = sideLabels?.[index as Side];
      if (label) {
        ctx.font = MONO(CLASSIC.SIDE_LABEL);
        ctx.globalAlpha = HUD_LAYOUT.LABEL_ALPHA;
        ctx.fillText(label, 0, HUD_LAYOUT.LABEL_OFFSET);
      }
      ctx.restore();
    });
    ctx.restore();

    // OVERTIME where the neon look writes it, plain
    if (hud.overtimeText) {
      ctx.save();
      ctx.translate(COURT.WIDTH / 2, overtimeSignY(isRotated));
      if (isRotated) ctx.rotate(Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = MONO(CLASSIC.SIDE_LABEL);
      ctx.fillText(hud.overtimeText, 0, 0);
      ctx.restore();
    }

    // As in the neon look: on the court only where there is no strip above it, never across a
    // turned court
    if (condition && hud.isConditionOnCourt && !isRotated) {
      drawConditionLine(ctx, condition, {
        font: (size) => MONO(size - CLASSIC.CONDITION_SHRINK),
        color: INK,
        hearts: INK,
        alpha: CLASSIC.CONDITION_ALPHA,
      });
    }
  }

  /** A flat white block, no glow or rounded corners. */
  private renderPaddle(ctx: CanvasRenderingContext2D, paddle: Paddle): void {
    const { width, height } = paddle.spec;
    ctx.fillRect(paddle.x, paddle.drawY - height / 2, width, height);
  }

  /** The Overdrive meter as plain white blocks, the unlit ones faint, no glow or pulse. */
  private renderMeter(
    ctx: CanvasRenderingContext2D,
    paddle: Paddle,
    charge: number,
    capacity?: number,
  ): void {
    const { WIDTH, HEIGHT } = EntityRenderer.METER_SEGMENT;
    ctx.save();
    EntityRenderer.meterSegments(paddle, capacity).forEach(({ x, y }, i) => {
      ctx.globalAlpha = i < charge ? 1 : CLASSIC.METER_UNLIT_ALPHA;
      ctx.fillRect(x, y, WIDTH, HEIGHT);
    });
    ctx.restore();
  }

  /** The ball as a plain white square. */
  private renderBall(ctx: CanvasRenderingContext2D, ball: Ball): void {
    const size = ball.radius * 2;
    ctx.fillRect(ball.drawX - ball.radius, ball.drawY - ball.radius, size, size);
  }

  /** The final score printed at once: the original had no ignition, it just showed it. */
  private renderFinalScore(
    ctx: CanvasRenderingContext2D,
    sign: FinalScoreSign,
    isRotated: boolean,
  ): void {
    ctx.save();
    ctx.translate(COURT.WIDTH / 2, COURT.HEIGHT / 2);
    if (isRotated) ctx.rotate(Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = MONO(CLASSIC.FINAL_LABEL);
    ctx.fillText(sign.label, 0, FINAL_SIGN_LAYOUT.LABEL_Y);
    ctx.font = MONO(CLASSIC.FINAL_SCORE);
    ctx.fillText(sign.text, 0, FINAL_SIGN_LAYOUT.SCORE_Y);
    ctx.restore();
  }
}
