import { COURT } from '@/match/config';
export const FINAL_SIGN = {
  DELAY: 0.3, // s before the tubes start to ignite
  IGNITE: 0.55, // s of ignition flicker before it burns steadily
  UNLIT_ALPHA: 0.1, // dark tubes stay faintly visible
} as const;

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
   * @param classic plain white text, shown at once with no delay, flicker or hum — the
   *   original hardware had no ignition cutscene, it just printed the final score
   */
  public static render(
    ctx: CanvasRenderingContext2D,
    sign: FinalScoreSign,
    age: number,
    isRotated: boolean,
    classic = false,
  ): void {
    const brightness = classic ? 1 : this.getBrightness(age, sign.isWin);
    const scoreText = `${sign.scores[0]} : ${sign.scores[1]}`;
    const color = classic ? '#ffffff' : sign.color;

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
      classic ? "700 26px 'Courier New', monospace" : "700 30px 'Russo One', Orbitron, sans-serif",
      -62,
      color,
      brightness,
      classic,
    );
    this.renderTube(
      ctx,
      scoreText,
      classic ? "700 96px 'Courier New', monospace" : "700 104px Orbitron, 'Russo One', sans-serif",
      22,
      color,
      brightness,
      classic,
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
    classic: boolean,
  ): void {
    ctx.font = font;
    ctx.shadowBlur = 0;

    if (classic) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillText(text, 0, y);
      return;
    }

    // Unlit glass is always faintly visible
    ctx.globalAlpha = FINAL_SIGN.UNLIT_ALPHA;
    ctx.fillStyle = color;
    ctx.fillText(text, 0, y);

    if (brightness <= 0) return;

    ctx.globalAlpha = brightness;
    ctx.shadowColor = color;
    ctx.shadowBlur = 34 * brightness;
    ctx.fillText(text, 0, y);

    ctx.globalAlpha = brightness * 0.7;
    ctx.shadowBlur = 8 * brightness;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 0, y);
  }
}
