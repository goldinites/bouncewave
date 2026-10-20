import {
  AiSkill,
  DIFFICULTY_CONFIGS,
  DIFFICULTY_LEVELS,
  DifficultyLevel,
} from '@/match/difficulty';
import { clamp, lerp } from '@/shared/math';

// Pressure on the CPU: its lead in points, plus this much per point of the current streak
// (counted from the second point in a row)
const STREAK_WEIGHT = 0.5;
// Pressure at which the CPU's form reaches the level's full adaptivity
const FULL_PRESSURE = 4;
// Share of the way to its new form the CPU moves on each serve, so it drifts rather than jumps
const EASING = 0.5;
// Lowest rank the CPU's form can sink to: the easiest level may weaken past itself by this much
const MIN_RANK = -1;

/**
 * The CPU's form: a hidden handicap that eases off when the CPU runs away with a match and
 * tightens up when the player does, so matches stay close. How far it may swing is the level's
 * `adaptivity`, in levels (Insane has none).
 *
 * It only changes between points, never during a rally, and is frozen on the deciding point so
 * the finish is played straight. The form is a fractional level: the CPU plays a blend of the two
 * neighbouring levels' AI settings, so it never does anything a real level wouldn't.
 */
export class AiForm {
  /** Levels added to the chosen one: negative = weaker. */
  private _shift = 0;
  /** Points in a row: positive for the CPU, negative for the player. */
  private streak = 0;

  public get shift(): number {
    return this._shift;
  }

  /** Call when a point is scored in a real match. */
  public onPoint(scorer: 0 | 1): void {
    const direction = scorer === 1 ? 1 : -1;
    this.streak = Math.sign(this.streak) === direction ? this.streak + direction : direction;
  }

  /**
   * Call on every serve of a real match, after the score has changed.
   * @param scores [player, CPU]
   * @param isDecidingPoint the next point decides the match, by the match's rules
   */
  public update(
    scores: readonly [number, number],
    adaptivity: number,
    isDecidingPoint = false,
  ): void {
    if (isDecidingPoint) return;

    const lead = scores[1] - scores[0];
    const streakPressure = Math.sign(this.streak) * Math.max(0, Math.abs(this.streak) - 1);
    const pressure = lead + STREAK_WEIGHT * streakPressure;

    // Ahead, the CPU eases off (a negative shift); behind, it tightens up
    const target = -clamp(pressure / FULL_PRESSURE, -1, 1) * adaptivity;
    this._shift += (target - this._shift) * EASING;
  }

  /** Back to the level as chosen (a new match). */
  public reset(): void {
    this._shift = 0;
    this.streak = 0;
  }

  /** The AI settings for `level` with the current form applied. */
  public skillFor(level: DifficultyLevel): AiSkill {
    return skillAt(DIFFICULTY_LEVELS.indexOf(level) + this._shift);
  }
}

/**
 * AI settings at a fractional rank (0 = the easiest level in DIFFICULTY_LEVELS, 1 = the next),
 * blended between the two levels around it. Below the easiest it carries on along the line
 * through the two easiest, down to MIN_RANK; it never goes past the hardest.
 */
export function skillAt(rank: number): AiSkill {
  const top = DIFFICULTY_LEVELS.length - 1;
  const position = clamp(rank, MIN_RANK, top);
  const lower = clamp(Math.floor(position), 0, top - 1);
  const t = position - lower;
  const from = DIFFICULTY_CONFIGS[DIFFICULTY_LEVELS[lower]];
  const to = DIFFICULTY_CONFIGS[DIFFICULTY_LEVELS[lower + 1]];

  return {
    speed: lerp(from.speed, to.speed, t),
    reaction: Math.max(0, lerp(from.reaction, to.reaction, t)),
    error: Math.max(0, lerp(from.error, to.error, t)),
    errorPerBounce: Math.max(0, lerp(from.errorPerBounce, to.errorPerBounce, t)),
    angleShots: clamp(lerp(from.angleShots, to.angleShots, t), 0, 1),
    nerves: clamp(lerp(from.nerves, to.nerves, t), 0, 1),
    perfectAim: clamp(lerp(from.perfectAim, to.perfectAim, t), 0, 1),
    curveRead: Math.max(0, lerp(from.curveRead, to.curveRead, t)),
    // A switch, not a blend: the nearer level's
    overdrive: t < 0.5 ? from.overdrive : to.overdrive,
  };
}
