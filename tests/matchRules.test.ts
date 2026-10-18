import { describe, expect, it } from 'vitest';
import { MatchPointDrama } from '@/fx/MatchPointDrama';
import { AiForm } from '@/match/AiForm';
import { Ball } from '@/match/Ball';
import { BALL, COURT, PADDLE, WINNING_SCORE } from '@/match/config';
import { DifficultyLevel } from '@/match/difficulty';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { OVERDRIVE } from '@/match/Overdrive';
import { Paddle } from '@/match/Paddle';
import { isDecidingPoint, MatchRules, STANDARD_RULES } from '@/match/rules';

const FIRST_TO_3: MatchRules = { winningScore: 3, overdrive: true };
const NO_OVERDRIVE: MatchRules = { ...STANDARD_RULES, overdrive: false };

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
    getDifficulty: () => DifficultyLevel.NORMAL,
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

  /** The player hits the ball dead center: a perfect hit. */
  const perfectHit = () => {
    finishServe();
    const [player] = paddles;
    player.y = player.targetY = ball.y;
    ball.x = player.x + PADDLE.WIDTH + 2;
    ball.vx = -400;
    ball.vy = 0;
    flow.update(0.001);
  };

  return { flow, paddles, events, scoreFor, perfectHit };
};

describe('MatchRules', () => {
  it('makes the standard match first to 10', () => {
    expect(STANDARD_RULES.winningScore).toBe(WINNING_SCORE);
    expect(STANDARD_RULES.overdrive).toBe(true);
  });

  it('puts the deciding point one point short of the winning score, for both sides', () => {
    expect(isDecidingPoint([2, 2], FIRST_TO_3)).toBe(true);
    expect(isDecidingPoint([2, 1], FIRST_TO_3)).toBe(false);
    expect(isDecidingPoint([2, 2], STANDARD_RULES)).toBe(false);
    expect(isDecidingPoint([9, 9], STANDARD_RULES)).toBe(true);
  });
});

describe('a match under its rules', () => {
  it('plays a standard match when started without rules', () => {
    const { flow } = setup();
    flow.startMatch();

    expect(flow.rules).toBe(STANDARD_RULES);
  });

  it('is won at the rules’ winning score, not at 10', () => {
    const { flow, paddles, events, scoreFor } = setup();
    flow.startMatch(FIRST_TO_3);

    scoreFor(0);
    scoreFor(0);
    expect(flow.isDecidingPoint).toBe(false);
    scoreFor(1);
    scoreFor(1);
    expect(flow.isDecidingPoint).toBe(true);
    expect(flow.phase).not.toBe('finale');

    scoreFor(0);
    expect(paddles[0].score).toBe(3);
    expect(flow.phase).toBe('finale');
    expect(events.at(-1)).toMatchObject({ type: 'finaleStart', winnerIndex: 0, scores: [3, 2] });
  });

  it('charges Overdrive with perfect hits only when the rules have it on', () => {
    const withOverdrive = setup();
    withOverdrive.flow.startMatch(STANDARD_RULES);
    for (let i = 0; i < OVERDRIVE.CHARGE; i++) withOverdrive.perfectHit();
    expect(withOverdrive.flow.overdriveCharge).toBe(OVERDRIVE.CHARGE);

    const without = setup();
    without.flow.startMatch(NO_OVERDRIVE);
    for (let i = 0; i <= OVERDRIVE.CHARGE; i++) without.perfectHit();
    expect(without.flow.overdriveCharge).toBe(0);
    expect(
      without.events.some(
        (event) => event.type === 'paddleHit' && (event.isPowerShot || event.chargedOverdrive),
      ),
    ).toBe(false);
  });
});

describe('the deciding point under other rules', () => {
  it('brings on the drama one point short of the rules’ winning score', () => {
    const { paddles } = setup();
    paddles[0].score = 2;
    paddles[1].score = 2;

    expect(MatchPointDrama.isDecidingPoint(paddles, FIRST_TO_3)).toBe(true);
    expect(MatchPointDrama.isDecidingPoint(paddles)).toBe(false);
  });

  it('freezes the CPU’s form on the rules’ deciding point', () => {
    // At two all, on a run of two points: pressure that would move the form
    const formAtTwoAll = (rules?: MatchRules) => {
      const form = new AiForm();
      form.onPoint(1);
      form.onPoint(1);
      form.update([2, 2], 0.4, rules);
      return form.shift;
    };

    expect(formAtTwoAll(FIRST_TO_3)).toBe(0);
    // Two all is no deciding point in a standard match: the form still moves there
    expect(formAtTwoAll()).not.toBe(0);
  });
});
