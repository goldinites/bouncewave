import { describe, expect, it } from 'vitest';
import { FixedStep, SIMULATION_RATE } from '@/app/FixedStep';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { DifficultyLevel } from '@/match/difficulty';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';

const STEP = 1 / SIMULATION_RATE;

/** A seeded source of randomness (mulberry32), the same sequence on every run. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe('FixedStep', () => {
  it('runs whole steps and carries the rest over to the next frame', () => {
    const clock = new FixedStep();
    const steps: number[] = [];

    expect(clock.advance(2.4 * STEP, (step) => steps.push(step))).toBe(2);
    expect(steps).toEqual([STEP, STEP]);
    expect(clock.alpha).toBeCloseTo(0.4);
    expect(clock.lag).toBeCloseTo(0.6 * STEP);

    expect(clock.advance(0.6 * STEP, () => {})).toBe(1);
    expect(clock.alpha).toBeCloseTo(0);
  });

  it('runs no step in a frame shorter than one, and draws further between steps', () => {
    const clock = new FixedStep();

    expect(clock.advance(0.3 * STEP, () => {})).toBe(0);
    expect(clock.alpha).toBeCloseTo(0.3);
    expect(clock.advance(0.3 * STEP, () => {})).toBe(0);
    expect(clock.alpha).toBeCloseTo(0.6);
  });

  it('runs exactly four steps every frame at 60 Hz, though frame times never add up exactly', () => {
    const clock = new FixedStep();
    const perFrame = new Set<number>();

    for (let frame = 0; frame < 600; frame++) {
      perFrame.add(clock.advance(1 / 60, () => {}));
    }
    expect([...perFrame]).toEqual([4]);
  });

  it('gives up on a backlog it cannot catch up with instead of spiralling', () => {
    const clock = new FixedStep();

    const steps = clock.advance(1, () => {});
    expect(steps).toBeLessThan(SIMULATION_RATE);
    expect(clock.alpha).toBeLessThanOrEqual(1);
    // The next ordinary frame runs an ordinary number of steps
    expect(clock.advance(1 / 60, () => {})).toBeLessThanOrEqual(5);
  });
});

describe('a match on the fixed step', () => {
  /**
   * Ten seconds of the AI-vs-AI demo, its time handed over in frames cut by `nextFrame`.
   * @returns everything that could differ: the events, and where the ball and paddles ended up
   */
  const play = (nextFrame: (elapsed: number) => number) => {
    const paddles: [Paddle, Paddle] = [
      new Paddle(0, PADDLE.OFFSET_X, '#19f0ff'),
      new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6'),
    ];
    const ball = new Ball();
    const events: MatchEvent[] = [];
    const flow = new MatchFlow({
      paddles,
      ball,
      input: { pollPlayerMovement: () => {} },
      getDifficulty: () => DifficultyLevel.NORMAL,
      onEvent: (event) => events.push(event),
      random: seeded(42),
    });
    flow.startAttract();

    // Half a step past a whole number of them, so every cut runs the same steps
    const total = 10 + STEP / 2;
    const clock = new FixedStep();
    let elapsed = 0;
    while (elapsed < total) {
      const dt = Math.min(nextFrame(elapsed), total - elapsed);
      clock.advance(dt, (step) => flow.update(step));
      elapsed += dt;
    }

    return {
      events,
      ball: [ball.x, ball.y, ball.vx, ball.vy],
      paddles: paddles.map((p) => [p.y, p.velocity]),
    };
  };

  it('plays out the same however the time is cut into frames', () => {
    const at60Hz = play(() => 1 / 60);
    const at144Hz = play(() => 1 / 144);
    // An uneven frame rate, with the odd hitch
    const jitter = seeded(7);
    const uneven = play(() => (jitter() < 0.05 ? 0.033 : 0.004 + jitter() * 0.02));

    // A real rally with hits to compare, not a ball waiting to be served
    expect(at60Hz.events.filter((event) => event.type === 'paddleHit').length).toBeGreaterThan(2);
    expect(at144Hz).toEqual(at60Hz);
    expect(uneven).toEqual(at60Hz);
  });
});
