// Overtime (step 4.7): at the upper levels a long rally squeezes both paddles alike, from FROM
// hits by PER_HIT of their height a hit down to FLOOR, so the rally ends in someone's miss
// without a faster ball or a CPU that tires (one that tired would hand a strong player every long
// rally). The same for both, and shown (OVERTIME over the court); back to full after the point
export const OVERTIME = {
  FROM: 12, // hits in the rally
  PER_HIT: 0.06, // share of the height lost each hit past FROM
  FLOOR: 0.5, // share of the height left at most squeezed: half, still easy to see and to catch with
} as const;

/** Share of their height the paddles have `rally` hits into a rally in overtime, in [FLOOR, 1]. */
export function overtimeAt(rally: number): number {
  return Math.max(OVERTIME.FLOOR, 1 - OVERTIME.PER_HIT * Math.max(0, rally - OVERTIME.FROM));
}
