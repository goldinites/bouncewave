import { STEPS_PER_BAR } from '@/audio/music/score';

/**
 * Processes that write lines in the score's notation (sixteenths, `.` a rest), for tracks built
 * on a process rather than a tune (5.6): a short cell turning over a beat of a different length,
 * so it lands somewhere new every time; a cell that grows and shrinks; rhythms spread as evenly
 * as they can be. A process gives a line that keeps changing from few notes, which a melody
 * written note by note does not.
 */

/** One stretch of a line: a cell of notes played for some bars over one chord. */
export interface Stretch {
  cell: readonly string[];
  bars: number;
}

/**
 * A cell turning over and over in sixteenths, through stretches of bars — each with its own
 * cell, as the chords change — never restarting at a bar line: a five-note cell over four
 * beats lands its first note somewhere new every bar.
 * @param rhythm which sixteenths of a bar sound (true) and which rest; all of them if left out
 */
export function cycle(stretches: readonly Stretch[], rhythm?: readonly boolean[]): string {
  let turn = 0;
  const bars: string[] = [];
  for (const { cell, bars: count } of stretches) {
    for (let bar = 0; bar < count; bar++) {
      const tokens: string[] = [];
      for (let s = 0; s < STEPS_PER_BAR; s++) {
        if (rhythm && !rhythm[s % rhythm.length]) {
          tokens.push('.');
          continue;
        }
        tokens.push(cell[turn % cell.length]);
        turn++;
      }
      bars.push(tokens.join(' '));
    }
  }
  return bars.join(' | ');
}

/**
 * Additive process, after Philip Glass: each bar the cell plays one note longer — the first
 * `sizes[i]` notes of `notes` — so the phrase keeps reshaping itself as it grows and shrinks.
 */
export function additive(notes: readonly string[], sizes: readonly number[]): string {
  return sizes
    .map((size) => {
      const cell = notes.slice(0, size);
      return Array.from({ length: STEPS_PER_BAR }, (_, s) => cell[s % cell.length]).join(' ');
    })
    .join(' | ');
}

/**
 * The Euclidean rhythm: `pulses` hits spread as evenly as they can be over `steps`, turned by
 * `rotate` — the rhythm under much of West African music, son clave and techno alike.
 */
export function euclid(pulses: number, steps: number, rotate = 0): boolean[] {
  return Array.from(
    { length: steps },
    (_, i) => (((i + rotate) % steps) * pulses) % steps < pulses,
  );
}
