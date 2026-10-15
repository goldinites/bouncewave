import { GAME_HEIGHT, GAME_WIDTH } from '@/constants/game.constants';
import {
  FINAL_SIGN_DELAY,
  FINAL_SIGN_IGNITE,
  FINAL_SIGN_UNLIT_ALPHA,
} from '@/constants/visual.constants';

export interface FinalScoreSign {
  scores: [number, number];
  label: string;
  color: string;
  isWin: boolean;
}

// Ignition flicker as [start, end, brightness] in fractions of FINAL_SIGN_IGNITE;
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
    const t = age - FINAL_SIGN_DELAY;
    if (t < 0) return 0;

    if (t < FINAL_SIGN_IGNITE) {
      const p = t / FINAL_SIGN_IGNITE;
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

  public static render(
    ctx: CanvasRenderingContext2D,
    sign: FinalScoreSign,
    age: number,
    isRotated: boolean,
  ): void {
    const brightness = this.getBrightness(age, sign.isWin);
    const scoreText = `${sign.scores[0]} : ${sign.scores[1]}`;

    ctx.save();
    ctx.translate(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    if (isRotated) {
      ctx.rotate(Math.PI / 2);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    this.renderTube(
      ctx,
      sign.label,
      "700 30px 'Russo One', Orbitron, sans-serif",
      -62,
      sign.color,
      brightness,
    );
    this.renderTube(
      ctx,
      scoreText,
      "700 104px Orbitron, 'Russo One', sans-serif",
      22,
      sign.color,
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

    // Unlit glass is always faintly visible
    ctx.shadowBlur = 0;
    ctx.globalAlpha = FINAL_SIGN_UNLIT_ALPHA;
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
