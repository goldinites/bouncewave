import { describe, expect, it, vi } from 'vitest';
import { skillAt } from '@/match/AiForm';
import { Ball } from '@/match/Ball';
import { COURT, HIT_STOP, PADDLE } from '@/match/config';
import { DEMO_AI_SKILL, DIFFICULTY_LEVELS, DifficultyLevel } from '@/match/difficulty';
import { Lineup, MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { OVERDRIVE } from '@/match/Overdrive';
import { Paddle } from '@/match/Paddle';
import { AiPaddleController, HumanController, PlayerInput } from '@/match/PaddleController';
import { STANDARD_RULES } from '@/match/rules';

const makePaddles = (): [Paddle, Paddle] => [
  new Paddle(0, PADDLE.OFFSET_X, '#19f0ff'),
  new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6'),
];

/** Input that records being asked to move a paddle. */
const input = () => ({ pollPlayerMovement: vi.fn<PlayerInput['pollPlayerMovement']>() });

describe('HumanController', () => {
  it('moves the paddle with the input, and nothing else', () => {
    const keys = input();
    const [left, right] = makePaddles();
    const human = new HumanController(keys);

    human.steer(left, new Ball(), right, 0.01);
    expect(keys.pollPlayerMovement).toHaveBeenCalledWith(left, 0.01);
  });
});

describe('AiPaddleController', () => {
  const NORMAL_SKILL = skillAt(DIFFICULTY_LEVELS.indexOf(DifficultyLevel.NORMAL));

  it('plays the demo at its own level', () => {
    const [left] = makePaddles();
    const demo = new AiPaddleController(() => 0.5);

    demo.onServe(left, [0, 6], STANDARD_RULES);
    expect(demo.skill).toEqual(DEMO_AI_SKILL);
  });

  it('plays a match at the chosen level, in the form the score puts it in', () => {
    const [, right] = makePaddles();
    const cpu = new AiPaddleController(
      () => 0.5,
      () => DifficultyLevel.NORMAL,
    );

    cpu.onServe(right, [0, 0], STANDARD_RULES);
    expect(cpu.skill).toEqual(NORMAL_SKILL);

    // Six points down, it tightens up
    cpu.onServe(right, [6, 0], STANDARD_RULES);
    expect(cpu.skill.speed).toBeGreaterThan(NORMAL_SKILL.speed);
  });

  it('reads the score from its own side, on the left as on the right', () => {
    const [left, right] = makePaddles();
    const cpuOnRight = new AiPaddleController(
      () => 0.5,
      () => DifficultyLevel.NORMAL,
    );
    const cpuOnLeft = new AiPaddleController(
      () => 0.5,
      () => DifficultyLevel.NORMAL,
    );

    // The same story seen from either side: its opponent wins two points in a row, 2–0 up
    for (let i = 0; i < 2; i++) {
      cpuOnRight.onPoint(right, 0);
      cpuOnLeft.onPoint(left, 1);
    }
    cpuOnRight.onServe(right, [2, 0], STANDARD_RULES);
    cpuOnLeft.onServe(left, [0, 2], STANDARD_RULES);

    expect(cpuOnLeft.skill).toEqual(cpuOnRight.skill);
    expect(cpuOnRight.skill.speed).toBeGreaterThan(NORMAL_SKILL.speed);
  });
});

describe('a match played by its lineup', () => {
  const setup = () => {
    const paddles = makePaddles();
    const ball = new Ball();
    const events: MatchEvent[] = [];
    const keys = input();
    const flow = new MatchFlow({
      paddles,
      ball,
      input: keys,
      getDifficulty: () => DifficultyLevel.NORMAL,
      onEvent: (event) => events.push(event),
      random: () => 0.25,
    });
    const finishServe = () => {
      while (flow.serveTime > 0) flow.update(0.05);
    };
    /** Side `side` hits the ball dead center: a perfect hit. */
    const perfectHit = (side: 0 | 1) => {
      finishServe();
      const paddle = paddles[side];
      paddle.y = paddle.targetY = ball.y;
      ball.x = side === 0 ? paddle.x + PADDLE.WIDTH + 2 : paddle.x - 2;
      ball.vx = side === 0 ? -400 : 400;
      ball.vy = 0;
      flow.update(0.001);
      // A hit square in the middle is perfect: the match holds still a moment before it flies on
      flow.update(HIT_STOP.POWER_SHOT);
    };
    return { flow, keys, events, perfectHit };
  };

  it('plays the player against the CPU by default, and the demo on its own', () => {
    const { flow, keys } = setup();

    flow.startAttract();
    flow.update(0.01);
    expect(keys.pollPlayerMovement).not.toHaveBeenCalled();

    flow.startMatch();
    flow.update(0.01);
    expect(keys.pollPlayerMovement).toHaveBeenCalledTimes(1);

    flow.returnToMenu();
    flow.update(0.01);
    expect(keys.pollPlayerMovement).toHaveBeenCalledTimes(1);
  });

  it('lets anyone play either side', () => {
    const { flow, keys } = setup();
    const right = input();
    const lineup: Lineup = [
      { controller: new HumanController(keys), overdrive: true },
      { controller: new HumanController(right), overdrive: true },
    ];

    flow.startMatch(STANDARD_RULES, lineup);
    flow.update(0.01);
    expect(keys.pollPlayerMovement).toHaveBeenCalledTimes(1);
    expect(right.pollPlayerMovement).toHaveBeenCalledTimes(1);
  });

  it('charges Overdrive only for a side whose participant has it', () => {
    const { flow, keys, events, perfectHit } = setup();
    const lineup: Lineup = [
      { controller: new HumanController(keys), overdrive: false },
      { controller: new HumanController(input()), overdrive: true },
    ];
    flow.startMatch(STANDARD_RULES, lineup);

    for (let i = 0; i < OVERDRIVE.CHARGE; i++) perfectHit(0);
    expect(flow.overdriveCharges).toEqual([null, 0]); // the left one has no meter

    for (let i = 0; i < OVERDRIVE.CHARGE; i++) perfectHit(1);
    const charged = events.filter((e) => e.type === 'paddleHit' && e.chargedOverdrive);
    expect(charged).toEqual([expect.objectContaining({ paddleIndex: 1 })]);
  });

  it('plays two people, each with their own controls and their own Overdrive', () => {
    const { flow, keys, events, perfectHit } = setup();
    const [left, right] = [input(), input()];

    flow.startMatch(STANDARD_RULES, flow.twoPlayers([left, right]));
    flow.update(0.01);
    expect(keys.pollPlayerMovement).not.toHaveBeenCalled();
    expect(left.pollPlayerMovement).toHaveBeenCalledTimes(1);
    expect(right.pollPlayerMovement).toHaveBeenCalledTimes(1);
    expect(flow.isTwoPlayer).toBe(true);
    expect(flow.overdriveCharges).toEqual([0, 0]);

    for (let i = 0; i < OVERDRIVE.CHARGE; i++) perfectHit(1);
    expect(flow.overdriveCharges).toEqual([0, OVERDRIVE.CHARGE]);
    expect(events.some((e) => e.type === 'paddleHit' && e.chargedOverdrive)).toBe(true);

    // Against the CPU there is one person, and one meter
    flow.startMatch();
    expect(flow.isTwoPlayer).toBe(false);
    expect(flow.overdriveCharges).toEqual([0, null]);
  });
});
