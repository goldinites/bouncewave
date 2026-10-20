import { describe, expect, it } from 'vitest';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { DifficultyLevel } from '@/match/difficulty';
import { MatchFlow } from '@/match/MatchFlow';
import { quickMatchRules } from '@/match/modes';
import { OVERTIME, overtimeAt } from '@/match/overtime';
import { Paddle } from '@/match/Paddle';
import { STANDARD_PADDLE } from '@/match/PaddleSpec';
import { PhysicsEvent } from '@/match/Physics';

const setup = (level: DifficultyLevel) => {
  const paddles = [
    new Paddle(0, PADDLE.OFFSET_X, '#19f0ff'),
    new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6'),
  ];
  const ball = new Ball();
  const flow = new MatchFlow({
    paddles,
    ball,
    input: { pollPlayerMovement: () => {} },
    getDifficulty: () => level,
    onEvent: () => {},
    random: () => 0.5,
  });
  /** Plays `count` hits into the rally, the paddles taking turns. */
  const hit = (count: number) => {
    const handle = (
      flow as unknown as { handlePhysicsEvent(event: PhysicsEvent, ball: Ball): void }
    ).handlePhysicsEvent.bind(flow);
    for (let i = 0; i < count; i++) {
      handle(
        { type: 'paddleHit', paddleIndex: i % 2, isPerfect: false, x: 0, y: 0, speed: 500 },
        ball,
      );
    }
  };
  /** Serves the next point, as a point scored does. */
  const serve = () =>
    (flow as unknown as { serve(direction: number, delay: number): void }).serve(1, 0);
  return { flow, paddles, hit, serve };
};

describe('overtime', () => {
  it('squeezes the paddles from FROM hits, a little more each hit, down to FLOOR', () => {
    expect(overtimeAt(0)).toBe(1);
    expect(overtimeAt(OVERTIME.FROM)).toBe(1);
    expect(overtimeAt(OVERTIME.FROM + 1)).toBeCloseTo(1 - OVERTIME.PER_HIT);
    expect(overtimeAt(OVERTIME.FROM + 1000)).toBe(OVERTIME.FLOOR);
  });

  it('squeezes a paddle on top of its spec, a shrinking paddle shrinking further', () => {
    const paddle = new Paddle(0, PADDLE.OFFSET_X, '#fff');
    paddle.squeeze(0.5);
    expect(paddle.spec.height).toBe(STANDARD_PADDLE.height * 0.5);
    paddle.useSpec({ ...STANDARD_PADDLE, height: 60 });
    expect(paddle.spec.height).toBe(30);
    paddle.squeeze(1);
    expect(paddle.spec.height).toBe(60);
  });

  it('comes at Hard and Insane, to both paddles alike, and is over with the point', () => {
    for (const level of [DifficultyLevel.HARD, DifficultyLevel.INSANE]) {
      const { flow, paddles, hit, serve } = setup(level);
      flow.startMatch(quickMatchRules(5));
      hit(OVERTIME.FROM);
      expect(flow.isOvertime).toBe(false);
      hit(2);
      expect(flow.isOvertime).toBe(true);
      for (const paddle of paddles) {
        expect(paddle.spec.height).toBeCloseTo(
          STANDARD_PADDLE.height * overtimeAt(OVERTIME.FROM + 2),
        );
      }

      serve();
      expect(flow.isOvertime).toBe(false);
      for (const paddle of paddles) expect(paddle.spec.height).toBe(STANDARD_PADDLE.height);
    }
  });

  it('never comes at the levels that tire instead, nor where the rules say not', () => {
    for (const level of [DifficultyLevel.EASY, DifficultyLevel.NORMAL]) {
      const { flow, paddles, hit } = setup(level);
      flow.startMatch(quickMatchRules(5));
      hit(OVERTIME.FROM + 10);
      expect(flow.isOvertime).toBe(false);
      for (const paddle of paddles) expect(paddle.spec.height).toBe(STANDARD_PADDLE.height);
    }

    const { flow, paddles, hit } = setup(DifficultyLevel.INSANE);
    flow.startMatch({ ...quickMatchRules(5), rallyPressure: false });
    hit(OVERTIME.FROM + 10);
    expect(flow.isOvertime).toBe(false);
    for (const paddle of paddles) expect(paddle.spec.height).toBe(STANDARD_PADDLE.height);
  });
});
