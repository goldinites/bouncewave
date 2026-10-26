import { describe, expect, it } from 'vitest';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { DifficultyLevel } from '@/match/difficulty';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { quickMatchRules } from '@/match/modes';
import { OVERTIME, isOvertimeAt } from '@/match/overtime';
import { Paddle } from '@/match/Paddle';
import { STANDARD_PADDLE } from '@/match/PaddleSpec';
import { PhysicsEvent } from '@/match/Physics';

const setup = (level: DifficultyLevel) => {
  const paddles = [
    new Paddle(0, PADDLE.OFFSET_X, '#19f0ff'),
    new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6'),
  ];
  const ball = new Ball();
  const events: MatchEvent[] = [];
  const flow = new MatchFlow({
    paddles,
    ball,
    input: { pollPlayerMovement: () => {} },
    getDifficulty: () => level,
    onEvent: (event) => events.push(event),
    random: () => 0.5,
  });
  /** Plays `count` hits into the rally, the paddles taking turns, perfect ones if `isPerfect`. */
  const hit = (count: number, isPerfect = false) => {
    const handle = (
      flow as unknown as { handlePhysicsEvent(event: PhysicsEvent, ball: Ball): void }
    ).handlePhysicsEvent.bind(flow);
    for (let i = 0; i < count; i++) {
      handle(
        {
          type: 'paddleHit',
          paddleIndex: i % 2,
          isPerfect,
          x: 0,
          y: 0,
          speed: 500,
          angle: 0,
          heading: 0,
        },
        ball,
      );
    }
  };
  /** Serves the next point, as a point scored does. */
  const serve = () =>
    (flow as unknown as { serve(direction: number, delay: number): void }).serve(1, 0);
  /** Whether each of the last `count` hits was a power shot, in order. */
  const powerShots = (count: number) =>
    events
      .filter((event) => event.type === 'paddleHit')
      .slice(-count)
      .map((event) => event.type === 'paddleHit' && event.isPowerShot);
  return { flow, paddles, ball, hit, serve, powerShots };
};

describe('overtime', () => {
  it('starts past FROM hits', () => {
    expect(isOvertimeAt(0)).toBe(false);
    expect(isOvertimeAt(OVERTIME.FROM)).toBe(false);
    expect(isOvertimeAt(OVERTIME.FROM + 1)).toBe(true);
  });

  it("makes either side's perfect hits power shots at Hard and Insane, until the point", () => {
    for (const level of [DifficultyLevel.HARD, DifficultyLevel.INSANE]) {
      const { flow, paddles, hit, serve, powerShots } = setup(level);
      flow.startMatch(quickMatchRules(5));
      hit(OVERTIME.FROM - 1);
      hit(1, true);
      expect(flow.isOvertime).toBe(false);
      expect(powerShots(1)).toEqual([false]);

      hit(2, true);
      expect(flow.isOvertime).toBe(true);
      expect(powerShots(2)).toEqual([true, true]);
      hit(1);
      expect(powerShots(1)).toEqual([false]);
      // The paddles stay as they are: a player keeps the reach they have learned
      for (const paddle of paddles) expect(paddle.spec.height).toBe(STANDARD_PADDLE.height);

      serve();
      expect(flow.isOvertime).toBe(false);
      hit(1, true);
      expect(powerShots(1)).toEqual([false]);
    }
  });

  it("leaves the Overdrive meters as they were: overtime's shots are its own", () => {
    const { flow, hit } = setup(DifficultyLevel.INSANE);
    flow.startMatch(quickMatchRules(5));
    hit(OVERTIME.FROM);
    const before = flow.overdriveCharges;
    expect(before[0]).not.toBeNull();
    hit(2, true);
    expect(flow.overdriveCharges).toEqual(
      before.map((charge) => (charge === null ? null : charge + 1)),
    );
  });

  it('never comes at the levels that tire instead, nor where the rules say not', () => {
    for (const level of [DifficultyLevel.EASY, DifficultyLevel.NORMAL]) {
      const { flow, hit, powerShots } = setup(level);
      flow.startMatch({ ...quickMatchRules(5), overdrive: false });
      hit(OVERTIME.FROM + 10, true);
      expect(flow.isOvertime).toBe(false);
      expect(powerShots(1)).toEqual([false]);
    }

    const { flow, hit, powerShots } = setup(DifficultyLevel.INSANE);
    flow.startMatch({ ...quickMatchRules(5), overdrive: false, rallyPressure: false });
    hit(OVERTIME.FROM + 10, true);
    expect(flow.isOvertime).toBe(false);
    expect(powerShots(1)).toEqual([false]);
  });
});
