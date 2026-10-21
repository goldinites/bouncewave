// Overtime (step 4.7): at the upper levels a long rally turns every perfect hit, either side's,
// into a power shot from FROM hits on, so the rally ends in someone's strong shot without a faster
// ball for everyone or a CPU that tires (one that tired would hand a strong player every long
// rally). The paddles stay as they are: a player who has learned their reach keeps it, where a
// paddle shrinking mid-rally made a catch they knew they had a miss (playtest, 21.10.2026). The
// same for both, and shown (OVERTIME over the court); over with the point
export const OVERTIME = {
  FROM: 12, // hits in the rally
} as const;

/** Whether `rally` hits into a rally is overtime, where the level and the rules have it. */
export function isOvertimeAt(rally: number): boolean {
  return rally > OVERTIME.FROM;
}
