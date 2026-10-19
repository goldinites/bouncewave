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
// Each side's label under its score with two players, which says whose score is whose
const SIDE_LABEL = {
  FONT: gameFont(700, 18),
  CLASSIC_FONT: "700 16px 'Courier New', monospace",
  OFFSET: 46, // px under the score's center
  ALPHA: 0.75,
} as const;
// A challenge's condition line, under the scores or in their place. Drawn as plain text, not a
// cached sprite: its clock changes every second
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
   * @param classic plain white blocky digits with no pop, color or glow, and no "get ready"
   *   prompt at all — the original scoreboard never had one
   * @param condition a challenge's condition line, under the scores or in their place; urgent, it
   *   turns pink and throbs
   * @param sideLabels each side's label under its score, [left, right], in a match of two players;
   *   null for none. With them, on a portrait phone the right side's score faces the top player
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
    classic = false,
    condition: HudCondition | null = null,
    sideLabels: readonly [string, string] | null = null,
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
    ctx.font = classic ? "700 56px 'Courier New', monospace" : SCORE_FONT;

    // Each side's score, in its color (unless the condition line stands in for them)
    const shownScores = condition?.replacesScore ? [] : scores;
    shownScores.forEach((score, index) => {
      const color = paddles.find((p) => p.side === (index as Side))!.color;
      const pop = classic ? 0 : Math.sin((1 - this.scorePop[index]) * Math.PI);
      const scale = 1 + pop * 0.5;

      ctx.save();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = classic ? 1 : 0.9;

      const posX = COURT.WIDTH / 2 + (index ? 1 : -1) * 90;
      const posY = 82;

      ctx.translate(posX, posY);

      // Turned upright for a phone held portrait; with two players round the phone (on a table
      // between them) the right side's, at the top of the screen, faces its own player
      if (isRotated) {
        ctx.rotate(sideLabels && index === 1 ? -Math.PI / 2 : Math.PI / 2);
      }

      // Under the score as the player reads it, turned with it on a portrait phone; it doesn't pop
      const label = sideLabels?.[index];
      if (label) {
        ctx.save();
        ctx.font = classic ? SIDE_LABEL.CLASSIC_FONT : SIDE_LABEL.FONT;
        ctx.fillStyle = classic ? '#ffffff' : color;
        ctx.globalAlpha = SIDE_LABEL.ALPHA;
        ctx.fillText(label, 0, SIDE_LABEL.OFFSET);
        ctx.restore();
      }

      ctx.scale(scale, scale);

      const text = String(score);
      if (classic) {
        ctx.fillText(text, 0, 0);
      } else {
        sprites.draw(
          ctx,
          `score|${color}|${text}`,
          0,
          0,
          (measureCtx, renderScale) =>
            measureText(measureCtx, renderScale, text, SCORE_FONT, SCORE_GLOW),
          (spriteCtx) => paintText(spriteCtx, text, SCORE_FONT, color, SCORE_GLOW),
        );
      }

      ctx.restore();
    });

    // A phone held upright has it under the court instead (ui/ConditionBar), out of the ball's way
    if (condition && !isRotated) this.renderCondition(ctx, condition, time, classic);

    // "GET READY" indicator — the original had no such prompt, so classic mode stays silent
    if (serveTime > 0 && !classic) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 12);

      this.renderReadyText(ctx, readyText, COURT.WIDTH / 2, COURT.HEIGHT / 2 + 8, isRotated);
    }

    ctx.restore();
  }

  private renderCondition(
    ctx: CanvasRenderingContext2D,
    condition: HudCondition,
    time: number,
    classic: boolean,
  ): void {
    ctx.save();
    const alone = condition.replacesScore;
    const size = alone ? CONDITION.SIZE_ALONE : CONDITION.SIZE;
    ctx.font = classic ? `700 ${size - 4}px 'Courier New', monospace` : gameFont(700, size);
    ctx.textBaseline = 'middle';
    const isUrgent = condition.isUrgent && !classic;
    ctx.fillStyle = isUrgent ? COLORS.PINK : COLORS.WHITE;
    const throb = isUrgent && !this.isMotionReduced();
    ctx.globalAlpha = throb
      ? 0.6 + 0.4 * Math.abs(Math.sin(time * CONDITION.URGENT_PULSE))
      : CONDITION.ALPHA;

    ctx.translate(COURT.WIDTH / 2, alone ? CONDITION.Y_ALONE : CONDITION.Y);

    // Laid out by hand, text then hearts, centered
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
      ctx.fillStyle = ctx.strokeStyle = classic ? COLORS.WHITE : COLORS.RED;
      ctx.lineWidth = 2;
      const alpha = ctx.globalAlpha;
      for (let i = 0; i < lives.total; i++) {
        const isLeft = i < lives.left;
        ctx.globalAlpha = isLeft ? alpha : alpha * CONDITION.LOST_HEART_ALPHA;
        heartPath(ctx, first + i * (heart + heartGap), 0, heart);
        if (isLeft) ctx.fill();
        else ctx.stroke();
      }
    }
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
