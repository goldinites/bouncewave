import { Ball } from '@/match/Ball';
import { DifficultyConfig } from '@/match/difficulty';
import { Physics } from '@/match/Physics';

// Flying a copy of the ball ahead: steps of this many seconds (Physics sub-steps a fast ball on
// its own), and no further ahead than this
const FORECAST = { STEP: 1 / 120, MAX_TIME: 3 } as const;

/** Where a ball is going to cross a vertical line, flown there by the physics. */
export interface Forecast {
  y: number;
  /** Seconds of the ball's own time until it gets there. */
  time: number;
  bounces: number;
}

/**
 * Where `ball` will cross the line `x`, flown ahead on a copy by the same physics that moves
 * it: walls, boosts and spin included, so a curving ball is read as it will curve. No paddle
 * is in the way. The match's state is left as it was, and the same ball forecasts the same.
 * @returns null when it is heading away from the line, or won't reach it within MAX_TIME
 */
export function forecastArrival(ball: Ball, x: number, config: DifficultyConfig): Forecast | null {
  const direction = Math.sign(x - ball.x);
  if (direction === 0) return { y: ball.y, time: 0, bounces: 0 };
  if (Math.sign(ball.vx) !== direction) return null;

  const copy = ball.flightCopy();
  let bounces = 0;
  let time = 0;
  while (time < FORECAST.MAX_TIME) {
    const { x: fromX, y: fromY } = copy;
    const events = Physics.step(copy, [], config, FORECAST.STEP);
    time += FORECAST.STEP;
    bounces += events.filter((event) => event.type === 'wallBounce').length;

    if (Math.sign(x - copy.x) !== direction) {
      // Between the step's two ends, as far as the line is along it
      const share = (x - fromX) / (copy.x - fromX);
      return {
        y: fromY + (copy.y - fromY) * share,
        time: time - FORECAST.STEP * (1 - share),
        bounces,
      };
    }
  }
  return null;
}
