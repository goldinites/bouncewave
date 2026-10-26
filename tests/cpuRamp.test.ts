import { describe, expect, it } from 'vitest';
import { skillAt } from '@/match/AiForm';
import { Ball } from '@/match/Ball';
import { BALL, COURT, HIT_STOP, PADDLE } from '@/match/config';
import { CHALLENGES } from '@/match/challenges';
import { DIFFICULTY_CONFIGS, DifficultyLevel } from '@/match/difficulty';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';
import { AiPaddleController } from '@/match/PaddleController';
import { cpuRank, paceAt } from '@/match/ramp';
import { MatchRules, STANDARD_RULES } from '@/match/rules';

const { EASY, NORMAL, HARD, INSANE } = DifficultyLevel;
const RAMP = { perPoint: 0.2, maxRank: 2.8 };
const SURVIVAL: MatchRules = { ...STANDARD_RULES, winningScores: [15, 3], cpuRamp: RAMP };
const RALLY_OF_4: MatchRules = { ...STANDARD_RULES, rallyGoal: 4 };

const setup = () => {
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
    getDifficulty: () => EASY,
    onEvent: (event) => events.push(event),
    random: () => 0.25,
  });

  const finishServe = () => {
    while (flow.serveTime > 0) flow.update(0.05);
  };

  /** Puts the ball past a goal line so the next update scores it. */
  const scoreFor = (scorer: 0 | 1) => {
    finishServe();
    ball.x =
      scorer === 0 ? COURT.WIDTH + BALL.OUT_OF_BOUNDS_OFFSET + 1 : -BALL.OUT_OF_BOUNDS_OFFSET - 1;
    ball.vx = scorer === 0 ? 10 : -10;
    flow.update(0.001);
  };

  /** The paddle at `index` hits the ball, flying at `speed`, square in the middle. */
  const hitWith = (index: 0 | 1, speed = 400) => {
    finishServe();
    const paddle = paddles[index];
    paddle.y = paddle.targetY = ball.y;
    ball.x = index === 0 ? paddle.x + PADDLE.WIDTH + 2 : paddle.x - 2;
    ball.speed = speed;
    ball.vx = index === 0 ? -speed : speed;
    ball.vy = 0;
    flow.update(0.001);
    // A hit square in the middle is perfect: the match holds still a moment before it flies on
    flow.update(HIT_STOP.POWER_SHOT);
  };

  return { flow, ball, events, scoreFor, hitWith };
};

describe('a CPU growing stronger with the score', () => {
  it('ranks from the match’s level up by its opponent’s points, to its ceiling', () => {
    expect(cpuRank(EASY, RAMP, 0)).toBe(0);
    expect(cpuRank(EASY, RAMP, 5)).toBeCloseTo(1);
    expect(cpuRank(EASY, RAMP, 10)).toBeCloseTo(2);
    expect(cpuRank(EASY, RAMP, 14)).toBeCloseTo(2.8);
    expect(cpuRank(EASY, RAMP, 30)).toBe(2.8);
    expect(cpuRank(NORMAL, RAMP, 0)).toBe(1);
  });

  it('plays at that rank on every serve, with no form', () => {
    const cpu = new AiPaddleController(
      () => 0.5,
      () => EASY,
    );
    const paddle = new Paddle(1, 700, '#fff');

    cpu.onServe(paddle, [0, 2], SURVIVAL);
    expect(cpu.skill).toEqual(skillAt(0));
    cpu.onServe(paddle, [5, 0], SURVIVAL);
    expect(cpu.skill).toEqual(skillAt(1));
    // Near its ceiling it plays between Hard and Insane
    cpu.onServe(paddle, [14, 0], SURVIVAL);
    expect(cpu.skill).toEqual(skillAt(2.8));
    expect(cpu.skill.speed).toBeGreaterThan(DIFFICULTY_CONFIGS[HARD].speed);
    expect(cpu.skill.speed).toBeLessThan(DIFFICULTY_CONFIGS[INSANE].speed);
  });

  it('quickens the ball along the levels, and past the hardest', () => {
    for (const [rank, level] of [
      [0, EASY],
      [1, NORMAL],
      [2, HARD],
      [3, INSANE],
    ] as const) {
      expect(paceAt(rank)).toEqual({
        acceleration: DIFFICULTY_CONFIGS[level].acceleration,
        maxSpeed: DIFFICULTY_CONFIGS[level].maxSpeed,
      });
    }
    const beyond = paceAt(3.5);
    expect(beyond.maxSpeed).toBeGreaterThan(DIFFICULTY_CONFIGS[INSANE].maxSpeed);
    expect(beyond.acceleration).toBeGreaterThan(DIFFICULTY_CONFIGS[INSANE].acceleration);
  });

  it('lets the ball get faster in the match as the player scores', () => {
    const { flow, ball, scoreFor, hitWith } = setup();
    flow.startMatch(SURVIVAL);
    hitWith(0, 5000);
    expect(ball.speed).toBeCloseTo(DIFFICULTY_CONFIGS[EASY].maxSpeed);

    for (let i = 0; i < 14; i++) scoreFor(0);
    hitWith(0, 5000);
    expect(ball.speed).toBeCloseTo(paceAt(2.8).maxSpeed);
  });

  it('is the Survival challenge’s CPU', () => {
    expect(CHALLENGES.survival.rules.cpuRamp).toEqual({ perPoint: 0.15, maxRank: 3 });
  });
});

describe('a rally goal', () => {
  it('ends the match at once with the rally that reaches it, won by the player', () => {
    const { flow, events, hitWith } = setup();
    flow.startMatch(RALLY_OF_4);
    hitWith(0);
    hitWith(1);
    hitWith(0);
    expect(flow.phase).toBe('rally');

    hitWith(1);
    expect(flow.phase).toBe('finale');
    expect(events.find((e) => e.type === 'finaleStart')).toMatchObject({ winnerIndex: 0 });
  });

  it('ends the Long Rally challenge', () => {
    expect(CHALLENGES.longRally.rules.rallyGoal).toBe(20);
  });

  it('leaves a match without one to points', () => {
    const { flow, hitWith } = setup();
    flow.startMatch();
    for (let i = 0; i < 6; i++) hitWith(i % 2 === 0 ? 0 : 1);
    expect(flow.phase).toBe('rally');
  });
});
