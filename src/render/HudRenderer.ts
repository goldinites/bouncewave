import { COURT } from '@/match/config';
import { Paddle } from '@/match/Paddle';
import { Scores, Side } from '@/match/side';
import { measureText, paintText, sprites } from '@/render/SpriteCache';
import { gameFont } from '@/shared/fonts';
import { COLORS } from '@/shared/palette';

const SCORE_POP_DURATION = 0.22; // s for a changed score to swell and settle
const SCORE_FONT = gameFont(700, 64);
const SCORE_GLOW = 22;
const READY_FONT = gameFont(700, 22);
const READY_GLOW = 6;
/** Where the HUD stands on the court, whatever the look draws it in. */
export const HUD_LAYOUT = {
  SCORE_X: 90, // px either side of the net, each side's score's center
  SCORE_Y: 82, // court px
  LABEL_OFFSET: 46, // px under the score's center, each side's label with two players
  LABEL_ALPHA: 0.75,
} as const;
// OVERTIME while a rally is in it: at the foot of the court, clear of the scores and a challenge's
// line; on a court turned on a portrait phone, between the two scores, across the net, where it
// reads level. It throbs gently (steady with reduced motion)
export const OVERTIME_SIGN = {
  Y: 456, // court px
  Y_ROTATED: 98, // court px: the scores' row, clear of the wall the sign runs toward
  ALPHA: 1,
  PULSE: 5, // rad/s
} as const;
/** Where OVERTIME stands on the court, its center's y. */
export const overtimeSignY = (isRotated: boolean): number =>
  isRotated ? OVERTIME_SIGN.Y_ROTATED : OVERTIME_SIGN.Y;
const OVERTIME_FONT = gameFont(700, 22);
const OVERTIME_GLOW = 10;
// Each side's label under its score with two players, which says whose score is whose
const SIDE_LABEL_FONT = gameFont(700, 18);
// A challenge's condition line, under the scores or in their place
const CONDITION = {
  SIZE: 26, // px
  /** In the scores' place, larger: it is all the HUD shows. */
  SIZE_ALONE: 32, // px
  // Hearts for lives after the text: their size, the gap before them and between them, in ems
  HEART: 0.8,
  HEART_LEAD: 0.6,
  HEART_GAP: 0.25,
  LOST_HEART_ALPHA: 0.35, // a life lost stays as a faint outline
  Y: 142, // court px, the line's center under the scores
  Y_ALONE: 82, // court px, where the scores stand
  // A longer line is set smaller to fit, clear of the court's edges (the tutorial's steps)
  MAX_WIDTH: 720, // court px
  ALPHA: 0.8,
  URGENT_PULSE: 7, // 1/s, the urgent clock's throb
} as const;

/** A challenge's condition line, as `describeCondition` (ui/challengeTexts.ts) words it. */
export interface HudCondition {
  readonly text: string;
  /** Lives drawn as hearts after the text: those left, of them all. */
  readonly lives: { readonly left: number; readonly total: number } | null;
  readonly isUrgent: boolean;
  /** Shown in place of the scores, which it makes useless. */
  readonly replacesScore: boolean;
}

/** How a look writes a challenge's condition line. */
export interface ConditionStyle {
  /** The font at a size in px. */
  font: (size: number) => string;
  color: string;
  hearts: string;
  alpha: number;
}

/**
 * A challenge's condition line, text then hearts for lives, centered under the scores or in
 * their place. Laid out by hand, as plain text rather than a cached sprite: its clock changes
 * every second.
 */
export function drawConditionLine(
  ctx: CanvasRenderingContext2D,
  condition: HudCondition,
  style: ConditionStyle,
): void {
  ctx.save();
  const alone = condition.replacesScore;
  let size: number = alone ? CONDITION.SIZE_ALONE : CONDITION.SIZE;
  ctx.font = style.font(size);
  const fullWidth = ctx.measureText(condition.text).width;
  if (fullWidth > CONDITION.MAX_WIDTH) {
    size = Math.floor((size * CONDITION.MAX_WIDTH) / fullWidth);
    ctx.font = style.font(size);
  }
  ctx.textBaseline = 'middle';
  ctx.fillStyle = style.color;
  ctx.globalAlpha = style.alpha;
  ctx.translate(COURT.WIDTH / 2, alone ? CONDITION.Y_ALONE : CONDITION.Y);

  const { lives } = condition;
  const textWidth = ctx.measureText(condition.text).width;
  const heart = size * CONDITION.HEART;
  const heartGap = size * CONDITION.HEART_GAP;
  const heartsWidth = lives
    ? size * CONDITION.HEART_LEAD + lives.total * heart + (lives.total - 1) * heartGap
    : 0;
  const start = -(textWidth + heartsWidth) / 2;
  ctx.textAlign = 'left';
  ctx.fillText(condition.text, start, 0);

  if (lives) {
    const first = start + textWidth + size * CONDITION.HEART_LEAD + heart / 2;
    ctx.fillStyle = ctx.strokeStyle = style.hearts;
    ctx.lineWidth = 2;
    for (let i = 0; i < lives.total; i++) {
      const isLeft = i < lives.left;
      ctx.globalAlpha = isLeft ? style.alpha : style.alpha * CONDITION.LOST_HEART_ALPHA;
      heartPath(ctx, first + i * (heart + heartGap), 0, heart);
      if (isLeft) ctx.fill();
      else ctx.stroke();
    }
  }
  ctx.restore();
}

/** A heart `size` across, centered on (x, y). */
function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.85);
  ctx.bezierCurveTo(x - s * 1.25, y - s * 0.05, x - s * 0.65, y - s * 1.05, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.65, y - s * 1.05, x + s * 1.25, y - s * 0.05, x, y + s * 0.85);
  ctx.closePath();
}

export class HudRenderer {
  private displayedScores: [number, number] = [-1, -1];
  private scorePop: [number, number] = [0, 0];
  private readonly isMotionReduced: () => boolean;

  /** @param isMotionReduced whether the urgent clock should hold still instead of throbbing */
  constructor(isMotionReduced: () => boolean = () => false) {
    this.isMotionReduced = isMotionReduced;
  }

  /**
   * @param ctx
   * @param dt wall-clock seconds since the last frame (the HUD keeps animating in pause)
   * @param paddles every paddle on the court; each side's score shows in its first paddle's color
   * @param scores
   * @param serveTime
   * @param readyText
   * @param time
   * @param isRotated
   * @param condition a challenge's condition line, under the scores or in their place; urgent, it
   *   turns pink and throbs
   * @param sideLabels each side's label under its score, [left, right] (two players); null for none
   * @param isConditionOnCourt whether the condition's line is drawn here; elsewhere the strip above
   *   the court shows it (ui/ConditionBar), and the court only leaves out the scores it replaces
   * @param overtimeText OVERTIME while the rally is in it; null otherwise
   */
  public render(
    ctx: CanvasRenderingContext2D,
    dt: number,
    paddles: readonly Paddle[],
    scores: Scores,
    serveTime: number,
    readyText: string,
    time: number,
    isRotated: boolean,
    condition: HudCondition | null = null,
    sideLabels: readonly [string, string] | null = null,
    isConditionOnCourt = true,
    overtimeText: string | null = null,
  ): void {
    scores.forEach((score, index) => {
      if (this.displayedScores[index] === -1) {
        this.displayedScores[index] = score;
      } else if (this.displayedScores[index] !== score) {
        this.displayedScores[index] = score;
        this.scorePop[index] = 1;
      }

      this.scorePop[index] = Math.max(0, this.scorePop[index] - dt / SCORE_POP_DURATION);
    });

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = SCORE_FONT;

    // Each side's score, in its color (unless the condition line stands in for them)
    const shownScores = condition?.replacesScore ? [] : scores;
    shownScores.forEach((score, index) => {
      const color = paddles.find((p) => p.side === (index as Side))!.color;
      const pop = Math.sin((1 - this.scorePop[index]) * Math.PI);
      const scale = 1 + pop * 0.5;

      ctx.save();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.9;

      const posX = COURT.WIDTH / 2 + (index ? 1 : -1) * HUD_LAYOUT.SCORE_X;
      const posY = HUD_LAYOUT.SCORE_Y;

      ctx.translate(posX, posY);

      if (isRotated) {
        ctx.rotate(Math.PI / 2);
      }

      // Under the score as the player reads it, turned with it on a portrait phone; it doesn't pop
      const label = sideLabels?.[index];
      if (label) {
        ctx.save();
        ctx.font = SIDE_LABEL_FONT;
        ctx.fillStyle = color;
        ctx.globalAlpha = HUD_LAYOUT.LABEL_ALPHA;
        ctx.fillText(label, 0, HUD_LAYOUT.LABEL_OFFSET);
        ctx.restore();
      }

      ctx.scale(scale, scale);

      const text = String(score);
      sprites.draw(
        ctx,
        `score|${color}|${text}`,
        0,
        0,
        (measureCtx, renderScale) =>
          measureText(measureCtx, renderScale, text, SCORE_FONT, SCORE_GLOW),
        (spriteCtx) => paintText(spriteCtx, text, SCORE_FONT, color, SCORE_GLOW),
      );

      ctx.restore();
    });

    // Only a phone on its side, with no strip above the court, has the line drawn here; across a
    // turned court it would cross the ball's path
    if (condition && isConditionOnCourt && !isRotated) {
      this.renderCondition(ctx, condition, time);
    }

    if (overtimeText) this.renderOvertime(ctx, overtimeText, time, isRotated);

    // "GET READY" indicator
    if (serveTime > 0) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 12);

      this.renderReadyText(ctx, readyText, COURT.WIDTH / 2, COURT.HEIGHT / 2 + 8, isRotated);
    }

    ctx.restore();
  }

  /** The condition line in neon white; urgent, pink and throbbing (still with reduced motion). */
  private renderCondition(
    ctx: CanvasRenderingContext2D,
    condition: HudCondition,
    time: number,
  ): void {
    const throb = condition.isUrgent && !this.isMotionReduced();
    drawConditionLine(ctx, condition, {
      font: (size) => gameFont(700, size),
      color: condition.isUrgent ? COLORS.PINK : COLORS.WHITE,
      hearts: COLORS.RED,
      alpha: throb
        ? 0.6 + 0.4 * Math.abs(Math.sin(time * CONDITION.URGENT_PULSE))
        : CONDITION.ALPHA,
    });
  }

  /** OVERTIME in pink, turned with the court on a phone held upright (see OVERTIME_SIGN). */
  private renderOvertime(
    ctx: CanvasRenderingContext2D,
    text: string,
    time: number,
    isRotated: boolean,
  ): void {
    ctx.save();
    ctx.globalAlpha = this.isMotionReduced()
      ? OVERTIME_SIGN.ALPHA
      : OVERTIME_SIGN.ALPHA * (0.9 + 0.1 * Math.sin(time * OVERTIME_SIGN.PULSE));
    ctx.translate(COURT.WIDTH / 2, overtimeSignY(isRotated));
    if (isRotated) ctx.rotate(Math.PI / 2);
    sprites.draw(
      ctx,
      `overtime|${text}`,
      0,
      0,
      (measureCtx, scale) => measureText(measureCtx, scale, text, OVERTIME_FONT, OVERTIME_GLOW),
      (spriteCtx) => paintText(spriteCtx, text, OVERTIME_FONT, COLORS.PINK, OVERTIME_GLOW),
    );
    ctx.restore();
  }

  private renderReadyText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    isRotated: boolean,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    if (isRotated) {
      ctx.rotate(Math.PI / 2);
    }

    sprites.draw(
      ctx,
      `ready|${text}`,
      0,
      0,
      (measureCtx, scale) => measureText(measureCtx, scale, text, READY_FONT, READY_GLOW),
      (spriteCtx) => paintText(spriteCtx, text, READY_FONT, COLORS.WHITE, READY_GLOW),
    );

    ctx.restore();
  }
}
