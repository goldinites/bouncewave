import { describe, expect, it } from 'vitest';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { DifficultyLevel } from '@/match/difficulty';
import { MatchFlow } from '@/match/MatchFlow';
import { OVERDRIVE, Overdrive } from '@/match/Overdrive';
import { Paddle } from '@/match/Paddle';
import { STANDARD_RULES } from '@/match/rules';
import { EntityRenderer } from '@/render/EntityRenderer';

const hits = (overdrive: Overdrive, perfect: boolean[]) =>
  perfect.forEach((p) => overdrive.onHit(p));

describe("a meter's capacity", () => {
  it('holds three charges unless its owner brings more', () => {
    expect(new Overdrive().capacity).toBe(OVERDRIVE.CAPACITY);
    expect(OVERDRIVE.CAPACITY).toBe(3);
  });

  it('lets a grown core hold more energy, but the power shot still takes three in a row', () => {
    const overdrive = new Overdrive();
    overdrive.useCore(true);
    overdrive.useCapacity(5);
    // Two perfect, one not: each round leaves a charge more of energy
    for (let i = 0; i < 4; i++) hits(overdrive, [true, true, false]);
    hits(overdrive, [true, true]);
    expect(overdrive.charge).toBe(5);
    expect(overdrive.isFull).toBe(true);
    expect(overdrive.isCharged).toBe(false);

    hits(overdrive, [true]);
    expect(overdrive.charge).toBe(5);
    expect(overdrive.isCharged).toBe(true);
    expect(overdrive.onHit(false)).toBe(true);
  });

  it('gives back energy only as far as it holds', () => {
    const overdrive = new Overdrive();
    overdrive.useCapacity(4);
    overdrive.restore(10);
    expect(overdrive.charge).toBe(4);
    // Made smaller, it loses what is over
    overdrive.useCapacity(3);
    expect(overdrive.charge).toBe(3);
  });

  it("comes with the match's participant, and back to three without one", () => {
    const paddles = [
      new Paddle(0, PADDLE.OFFSET_X, '#19f0ff'),
      new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6'),
    ];
    const flow = new MatchFlow({
      paddles,
      ball: new Ball(),
      input: { pollPlayerMovement: () => {} },
      getDifficulty: () => DifficultyLevel.EASY,
      onEvent: () => {},
      random: () => 0.5,
    });
    const lineup = flow.playerVsCpu();
    flow.startMatch(STANDARD_RULES, [{ ...lineup[0], meter: 5 }, lineup[1]]);
    expect(flow.overdriveCapacities).toEqual([5, 3]);

    flow.startMatch(STANDARD_RULES, flow.playerVsCpu());
    expect(flow.overdriveCapacities).toEqual([3, 3]);
  });

  it('is drawn with as many segments as it holds', () => {
    const paddle = new Paddle(0, PADDLE.OFFSET_X, '#19f0ff');
    expect(EntityRenderer.meterSegments(paddle)).toHaveLength(3);
    const five = EntityRenderer.meterSegments(paddle, 5);
    expect(five).toHaveLength(5);
    // Still centred on the paddle, filled from the bottom up
    const ys = five.map(({ y }) => y);
    expect(ys[0]).toBeGreaterThan(ys[4]);
    expect((ys[0] + ys[4]) / 2 + EntityRenderer.METER_SEGMENT.HEIGHT / 2).toBeCloseTo(paddle.drawY);
  });
});
