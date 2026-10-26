import { describe, expect, it } from 'vitest';
import { ModifierSchedule } from '@/match/modifiers/ModifierSchedule';
import { Referee } from '@/match/Referee';
import { MatchRules, STANDARD_RULES } from '@/match/rules';

const rules = (overrides: Partial<MatchRules>): MatchRules => ({ ...STANDARD_RULES, ...overrides });

describe('the referee', () => {
  it('gives a side the match at its own winning score', () => {
    const referee = new Referee();
    referee.start(rules({ winningScores: [2, 3] }));
    expect(referee.point(0)).toBeNull();
    expect(referee.point(1)).toBeNull();
    expect(referee.point(1)).toBeNull();
    expect(referee.scores).toEqual([1, 2]);
    expect(referee.played).toBe(3);
    // Each a point from winning: the next point decides it
    expect(referee.isDecidingPoint).toBe(true);
    expect(referee.point(0)).toEqual({ winner: 0, reason: 'points' });
  });

  it('ends a match on time: the side ahead, the opponent on a level score or by the rules', () => {
    const referee = new Referee();
    referee.start(rules({ timeLimit: 10 }));
    expect(referee.tick(9, 0)).toBeNull();
    expect(referee.timeLeft).toBe(1);
    referee.point(0);
    expect(referee.tick(2, 0)).toEqual({ winner: 0, reason: 'time' });
    expect(referee.timeLeft).toBe(0);

    referee.start(rules({ timeLimit: 10 }));
    referee.resetScores();
    // Level: the player loses
    expect(referee.tick(10, 0)).toEqual({ winner: 1, reason: 'time' });

    referee.start(rules({ timeLimit: 10, timeUp: 'opponent' }));
    referee.point(0);
    expect(referee.tick(10, 0)).toEqual({ winner: 1, reason: 'time' });
  });

  it('has no clock without a time limit, nor in the demo', () => {
    const referee = new Referee();
    referee.start(STANDARD_RULES);
    expect(referee.tick(1000, 0)).toBeNull();
    referee.start(rules({ timeLimit: 10 }));
    referee.stop();
    expect(referee.timeLeft).toBeNull();
    expect(referee.tick(1000, 0)).toBeNull();
  });

  it('gives the player the match when a rally reaches its goal', () => {
    const referee = new Referee();
    referee.start(rules({ rallyGoal: 20 }));
    expect(referee.hit(19, 0)).toBeNull();
    expect(referee.hit(20, 0)).toEqual({ winner: 0, reason: 'rally' });
    // With no one playing, the left side stands for the player
    expect(referee.hit(20, null)).toEqual({ winner: 0, reason: 'rally' });
    referee.start(STANDARD_RULES);
    expect(referee.hit(1000, 0)).toBeNull();
  });
});

describe('the modifier schedule', () => {
  const chaos = rules({
    modifiers: ['wind'],
    rotation: { modifiers: ['darkness', 'turbo', 'ice'], points: 2 },
  });

  it("keeps the rules' own modifiers, and nothing before a match", () => {
    const schedule = new ModifierSchedule();
    expect(schedule.at(0)).toEqual([]);
    schedule.start(rules({ modifiers: ['wind'] }), Math.random);
    expect(schedule.at(0)).toEqual(['wind']);
    expect(schedule.at(7)).toEqual(['wind']);
    expect(schedule.upcoming(0)).toBeNull();
  });

  it('takes a rotation in turn, so many points each, in the order dealt', () => {
    const schedule = new ModifierSchedule();
    schedule.start(chaos, () => 0.99);
    const order = [1, 3, 5].map((played) => schedule.at(played)[1]);
    expect(new Set(order)).toEqual(new Set(['darkness', 'turbo', 'ice']));
    expect(schedule.at(0)).toEqual(['wind', order[0]]);
    expect(schedule.at(6)).toEqual(['wind', order[0]]);
    expect(schedule.upcoming(1)).toEqual({ id: order[1], inPoints: 1 });
    expect(schedule.upcoming(2)).toEqual({ id: order[2], inPoints: 2 });
  });

  it('deals the same order from the same randomness', () => {
    const seeded = () => {
      let seed = 7;
      return () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
    };
    const a = new ModifierSchedule();
    const b = new ModifierSchedule();
    a.start(chaos, seeded());
    b.start(chaos, seeded());
    expect([0, 2, 4].map((p) => a.at(p))).toEqual([0, 2, 4].map((p) => b.at(p)));
  });
});
