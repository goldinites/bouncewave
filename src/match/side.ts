/** A side of the court: 0 the left, 1 the right. Points and Overdrive belong to a side. */
export type Side = 0 | 1;

/** Points each side has won: [left, right]. */
export type Scores = readonly [left: number, right: number];

export const otherSide = (side: Side): Side => (side === 0 ? 1 : 0);
