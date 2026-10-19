import { COURT } from '@/match/config';
import { measureText, paintText, sprites } from '@/render/SpriteCache';
import { gameFont } from '@/shared/fonts';

// Neon tube glow in canvas pixels: wide colored halo, tight white core
const TUBE_GLOW = 34;
const CORE_GLOW = 8;
export const FINAL_SIGN = {
  DELAY: 0.3, // s before the tubes start to ignite
  IGNITE: 0.55, // s of ignition flicker before it burns steadily
  UNLIT_ALPHA: 0.1, // dark tubes stay faintly visible
} as const;

/** Where the sign's two lines stand, px from the court's center, whatever the look. */
export const FINAL_SIGN_LAYOUT = { LABEL_Y: -62, SCORE_Y: 22 } as const;

/** "7 : 4", the final score as the sign writes it. */
export const finalScoreText = (sign: FinalScoreSign): string =>
  `${sign.scores[0]} : ${sign.scores[1]}`;

export interface FinalScoreSign {
  scores: [number, number];
  label: string;
  color: string;
  isWin: boolean;
}

// Ignition flicker as [start, end, brightness] in fractions of FINAL_SIGN.IGNITE;
// gaps between segments are dark, the last segment ramps up to full
const IGNITION_PATTERN: [number, number, number][] = [
  [0.0, 0.09, 1],
  [0.22, 0.29, 0.8],
  [0.49, 0.62, 0.6],
  [0.73, 1.0, -1], // ramp
];

/** Neon sign with the final score that "switches on" like a real tube. */
export class FinalScoreRenderer {
  /** Tube brightness in [0, 1] for a sign that appeared `age` seconds ago. */
  public static getBrightness(age: number, isWin: boolean): number {
    const t = age - FINAL_SIGN.DELAY;
    if (t < 0) return 0;

    if (t < FINAL_SIGN.IGNITE) {
      const p = t / FINAL_SIGN.IGNITE;
      for (const [start, end, level] of IGNITION_PATTERN) {
        if (p >= start && p < end) {
          return level < 0 ? (p - start) / (end - start) : level;
        }
      }
      return 0;
    }

    // Steady burn with a faint mains hum; a lost match keeps sputtering like a failing tube
    const hum = 0.94 + 0.06 * Math.sin(age * 47);
    if (!isWin && (age * 1.7) % 1 < 0.07) {
      return 0.35;
    }
    return hum;
  }

  /**
   * @param ctx
   * @param sign
   * @param age
   * @param isRotated
   */
  public static render(
    ctx: CanvasRenderingContext2D,
    sign: FinalScoreSign,
    age: number,
    isRotated: boolean,
  ): void {
    const brightness = this.getBrightness(age, sign.isWin);
    const scoreText = finalScoreText(sign);
    const color = sign.color;

    ctx.save();
    ctx.translate(COURT.WIDTH / 2, COURT.HEIGHT / 2);
    if (isRotated) {
      ctx.rotate(Math.PI / 2);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    this.renderTube(
      ctx,
      sign.label,
      gameFont(700, 30),
      FINAL_SIGN_LAYOUT.LABEL_Y,
      color,
      brightness,
    );
    this.renderTube(
      ctx,
      scoreText,
      gameFont(700, 104),
      FINAL_SIGN_LAYOUT.SCORE_Y,
      color,
      brightness,
    );

    ctx.restore();
  }

  /** Draws text as a neon tube: colored glow plus a hot white core, dim when unlit. */
  private static renderTube(
    ctx: CanvasRenderingContext2D,
    text: string,
    font: string,
    y: number,
    color: string,
    brightness: number,
  ): void {
    ctx.font = font;
    ctx.shadowBlur = 0;

    // Unlit glass is always faintly visible
    ctx.globalAlpha = FINAL_SIGN.UNLIT_ALPHA;
    ctx.fillStyle = color;
    ctx.fillText(text, 0, y);

    if (brightness <= 0) return;

    // Both glowing layers are pre-rendered at full strength and faded with alpha
    ctx.globalAlpha = brightness;
    this.drawGlowingText(ctx, text, font, y, color, color, TUBE_GLOW);

    ctx.globalAlpha = brightness * 0.7;
    this.drawGlowingText(ctx, text, font, y, '#ffffff', color, CORE_GLOW);
  }

  private static drawGlowingText(
    ctx: CanvasRenderingContext2D,
    text: string,
    font: string,
    y: number,
    color: string,
    glowColor: string,
    glow: number,
  ): void {
    sprites.draw(
      ctx,
      `final|${font}|${color}|${glowColor}|${glow}|${text}`,
      0,
      y,
      (measureCtx, scale) => measureText(measureCtx, scale, text, font, glow),
      (spriteCtx) => paintText(spriteCtx, text, font, color, glow, glowColor),
    );
  }
}
