import { describe, expect, it } from 'vitest';
import { Ball } from '@/match/Ball';
import { BALL, COURT, PADDLE } from '@/match/config';
import { CourtConditions } from '@/match/court';
import { DIFFICULTY_CONFIGS, DifficultyLevel } from '@/match/difficulty';
import { forecastArrival } from '@/match/forecast';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { MODIFIER_IDS, ModifierHost, ModifierId, ModifierMoment } from '@/match/modifiers/Modifier';
import {
  BRICK_WALL,
  BRICKS,
  BUMPERS,
  HALVES,
  ICE,
  MODIFIERS,
  SHRINK,
  TURBO,
  WIND,
} from '@/match/modifiers/modifiers';
import { quickMatchRules } from '@/match/modes';
import { Paddle } from '@/match/Paddle';
import { Physics, PhysicsEvent } from '@/match/Physics';
import { MatchRules } from '@/match/rules';

const STEP = 1 / 240;
const CONFIG = DIFFICULTY_CONFIGS[DifficultyLevel.NORMAL];

const court = () => [
  new Paddle(0, PADDLE.OFFSET_X, '#19f0ff'),
  new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6'),
];

/** A ball at (x, y) flying at (vx, vy) over `conditions`. */
const ballOver = (conditions: CourtConditions, x: number, y: number, vx: number, vy = 0) => {
  const ball = new Ball();
  Object.assign(ball, { x, y, vx, vy, speed: Math.hypot(vx, vy) });
  ball.court = conditions;
  return ball;
};

/** A modifier made for a court of two paddles, the left one the player's. */
const make = (id: ModifierId, balls: Ball[] = []) => {
  const paddles = court();
  const conditions = new CourtConditions();
  const moments: ModifierMoment[] = [];
  let seed = 0.13;
  const host: ModifierHost = {
    paddles,
    balls,
    court: conditions,
    isPlayerPaddle: (index) => index === 0,
    // A spread of values, so the wind's gusts differ
    random: () => (seed = (seed * 9301 + 0.4927) % 1),
    report: (moment) => void moments.push(moment),
  };
  return { modifier: MODIFIERS[id](host), paddles, conditions, moments };
};

describe('The court’s conditions in the physics', () => {
  it('lets the wind push the ball up or down, its speed across the court kept', () => {
    const conditions = new CourtConditions();
    conditions.wind = WIND.MAX;
    const ball = ballOver(conditions, 200, 250, 400);
    for (let i = 0; i < 120; i++) Physics.step(ball, [], CONFIG, STEP);

    expect(ball.vy).toBeGreaterThan(0);
    expect(ball.vx).toBeCloseTo(400, 6);
  });

  it('makes a shot into the wind hard: sent down against it, it barely gets down', () => {
    /** How far down a shot sent down at 25° from the top third gets across the court. */
    const depth = (wind: number) => {
      const conditions = new CourtConditions();
      conditions.wind = wind;
      const ball = ballOver(conditions, 60, 150, 600 * Math.cos(0.45), 600 * Math.sin(0.45));
      let lowest = ball.y;
      while (ball.x < COURT.WIDTH - 60) {
        Physics.step(ball, [], CONFIG, STEP);
        lowest = Math.max(lowest, ball.y);
      }
      return lowest - 150;
    };
    const calm = depth(0);
    expect(depth(-WIND.MIN)).toBeLessThan(calm * 0.75);
    expect(depth(-WIND.MAX)).toBeLessThan(calm * 0.6);
  });

  it('speeds a turbo ball up in flight, to the level’s top speed', () => {
    const conditions = new CourtConditions();
    conditions.turbo = TURBO.GAIN;
    const ball = ballOver(conditions, 100, 250, 400);
    Physics.step(ball, [], CONFIG, 0.5);
    expect(ball.speed).toBeCloseTo(400 + TURBO.GAIN * 0.5, 0);

    for (let i = 0; i < 40; i++) {
      ball.x = 100;
      Physics.step(ball, [], CONFIG, 0.5);
    }
    expect(ball.speed).toBe(CONFIG.maxSpeed);
  });

  it('bounces the ball off a post as off a wall', () => {
    const conditions = new CourtConditions();
    conditions.bumpers = [{ x: 400, y: 250, radius: 16 }];
    const ball = ballOver(conditions, 300, 250, 400);
    const events = [];
    for (let i = 0; i < 120 && ball.vx > 0; i++) {
      events.push(...Physics.step(ball, [], CONFIG, STEP));
    }
    expect(ball.vx).toBeLessThan(0);
    // A post's bounce, told from a wall's, for its own sound
    expect(events).toContainEqual(expect.objectContaining({ type: 'wallBounce', isPost: true }));
  });

  it('bounces the ball off a brick, leaving the breaking of it to the match', () => {
    const conditions = new CourtConditions();
    const brick = { x: 400, y: 230, width: 14, height: 40 };
    conditions.bricks = [brick];
    const ball = ballOver(conditions, 300, 250, 400, 60);
    const events: PhysicsEvent[] = [];
    for (let i = 0; i < 120 && ball.vx > 0; i++) {
      events.push(...Physics.step(ball, [], CONFIG, STEP));
    }
    expect(ball.vx).toBeLessThan(0);
    expect(ball.vy).toBeGreaterThan(0); // off the face: only its way across turns back
    expect(events).toContainEqual(expect.objectContaining({ type: 'brickHit', brick }));
    expect(conditions.bricks).toEqual([brick]);

    // A forecast sees it sent back, and breaks nothing
    const next = ballOver(conditions, 300, 250, 400);
    expect(forecastArrival(next, 700, CONFIG)).toBeNull();
    expect(conditions.bricks).toEqual([brick]);
  });

  it('flies a forecast through the wind as the ball will fly', () => {
    const conditions = new CourtConditions();
    conditions.wind = -WIND.MAX;
    const ball = ballOver(conditions, 100, 300, 420);
    const forecast = forecastArrival(ball, 700, CONFIG)!;
    while (ball.x < 700) Physics.step(ball, [], CONFIG, STEP);
    expect(Math.abs(forecast.y - ball.y)).toBeLessThan(3);
  });
});

describe('The modifiers', () => {
  it('turns the wind around every period, warning of it as it comes', () => {
    const { modifier, conditions, moments } = make('wind');
    modifier.start!();
    const before = Math.sign(conditions.wind);
    for (let t = 0; t < WIND.PERIOD - 0.5; t += 0.1) modifier.beforeStep!(0.1);
    expect(conditions.windTurnsIn).toBeLessThan(WIND.WARNING);
    expect(Math.sign(conditions.wind)).toBe(before);
    expect(moments).toEqual([]);
    for (let t = 0; t < 1; t += 0.1) modifier.beforeStep!(0.1);
    expect(Math.sign(conditions.wind)).toBe(-before);
    expect(moments).toEqual([{ moment: 'windTurn', direction: -before }]);

    modifier.end!();
    expect(conditions.wind).toBe(0);
  });

  it('blows in gusts, from a moderate wind to a strong one', () => {
    const { modifier, conditions } = make('wind');
    modifier.start!();
    const strengths: number[] = [];
    for (let t = 0; t < 30; t += 0.1) {
      modifier.beforeStep!(0.1);
      strengths.push(Math.abs(conditions.wind));
    }
    expect(Math.min(...strengths)).toBeGreaterThanOrEqual(WIND.MIN);
    expect(Math.max(...strengths)).toBeLessThanOrEqual(WIND.MAX);
    expect(Math.max(...strengths) - Math.min(...strengths)).toBeGreaterThan(30);
  });

  it('lets a turbo ball past the top speed as the rally grows, never too far', () => {
    const { modifier, conditions } = make('turbo');
    modifier.start!();
    const fly = () => {
      const ball = ballOver(conditions, 100, 250, 400);
      for (let i = 0; i < 40; i++) {
        ball.x = 100;
        Physics.step(ball, [], CONFIG, 0.5);
      }
      return ball.speed;
    };
    expect(fly()).toBe(CONFIG.maxSpeed);

    const hit = () =>
      modifier.afterHit!({
        paddleIndex: 0,
        ball: new Ball(),
        isPerfect: false,
        isPowerShot: false,
      });
    for (let i = 0; i < 4; i++) hit();
    expect(fly()).toBeCloseTo(CONFIG.maxSpeed * (1 + 4 * TURBO.OVER_PER_HIT));
    for (let i = 0; i < 40; i++) hit();
    expect(fly()).toBeCloseTo(CONFIG.maxSpeed * (1 + TURBO.MAX_OVER));

    modifier.onServe!();
    expect(fly()).toBe(CONFIG.maxSpeed);
  });

  it('raises the middle post only into an empty middle, never at the serve', () => {
    const ball = ballOver(new CourtConditions(), COURT.WIDTH / 2, COURT.HEIGHT / 2, 0);
    const { modifier, conditions, moments } = make('bumpers', [ball]);
    modifier.start!();
    const middle = () => conditions.bumpers.find((post) => post.y === COURT.HEIGHT / 2);
    expect(conditions.bumpers).toHaveLength(2);

    // Its time comes with the ball in the middle: it waits
    for (let t = 0; t < BUMPERS.DOWN + 1; t += 0.05) modifier.beforeStep!(0.05);
    expect(middle()).toBeUndefined();
    expect(moments).toEqual([]);

    ball.x = 100;
    modifier.beforeStep!(0.05);
    expect(moments).toEqual([{ moment: 'postRise' }]);
    modifier.beforeStep!(BUMPERS.RISE / 2);
    expect(middle()!.growth).toBeGreaterThan(0);
    expect(middle()!.growth).toBeLessThan(1);
    modifier.beforeStep!(BUMPERS.RISE);
    expect(middle()!.radius).toBe(BUMPERS.RADIUS);

    modifier.onServe!();
    expect(middle()).toBeUndefined();
  });

  it('shrinks the player’s paddle with each of their hits, whole again at the serve', () => {
    const { modifier, paddles, moments } = make('shrinkingPaddle');
    modifier.start!();
    const hit = (paddleIndex: number) =>
      modifier.afterHit!({ paddleIndex, ball: new Ball(), isPerfect: false, isPowerShot: false });

    hit(0);
    hit(0);
    hit(1);
    expect(paddles[0].spec.height).toBeCloseTo(PADDLE.HEIGHT * (1 - 2 * SHRINK.PER_HIT));
    expect(paddles[1].spec.height).toBe(PADDLE.HEIGHT);
    expect(moments).toEqual([
      { moment: 'paddleShrink', paddleIndex: 0, share: 1 - SHRINK.PER_HIT },
      { moment: 'paddleShrink', paddleIndex: 0, share: 1 - 2 * SHRINK.PER_HIT },
    ]);
    for (let i = 0; i < 20; i++) hit(0);
    expect(paddles[0].spec.height).toBeCloseTo(PADDLE.HEIGHT * SHRINK.FLOOR);
    // Once at its floor it shrinks no more, and says nothing
    const shrinks = moments.length;
    hit(0);
    expect(moments).toHaveLength(shrinks);

    modifier.onServe!();
    expect(paddles[0].spec.height).toBe(PADDLE.HEIGHT);
  });

  it('builds a wall of bricks with an opening for the serve, whole again at every serve', () => {
    const { modifier, conditions } = make('bricks');
    modifier.start!();
    expect(conditions.bricks).toBe(BRICK_WALL);
    expect(BRICK_WALL).toHaveLength(BRICKS.COLUMNS.length * BRICKS.ROWS * 2);
    for (const { y, height } of BRICK_WALL) {
      // Clear of the opening a serve flies through, and within the walls
      const isClear =
        y + height <= COURT.HEIGHT / 2 - BRICKS.OPENING / 2 ||
        y >= COURT.HEIGHT / 2 + BRICKS.OPENING / 2;
      expect(isClear).toBe(true);
      expect(y).toBeGreaterThanOrEqual(COURT.TOP_WALL);
      expect(y + height).toBeLessThanOrEqual(COURT.HEIGHT - COURT.BOTTOM_WALL);
    }

    conditions.bricks = BRICK_WALL.slice(3);
    modifier.onServe!();
    expect(conditions.bricks).toBe(BRICK_WALL);
    modifier.end!();
    expect(conditions.bricks).toEqual([]);
  });

  it('makes every paddle slide on the ice: it lags its aim, then runs past it', () => {
    const { modifier, paddles } = make('ice');
    modifier.start!();
    const paddle = paddles[0];
    expect(paddle.grip).toBe(ICE.GRIP);

    paddle.setTargetY(350);
    const trail: number[] = [];
    for (let t = 0; t < 1; t += STEP) {
      paddle.update(STEP);
      trail.push(paddle.y);
    }
    // In 0.05 s a dry paddle covers three quarters of the way (to ~325); a wet one a third
    expect(trail[11]).toBeLessThan(290);
    expect(Math.max(...trail)).toBeGreaterThan(350);

    // Stopped on its way, it rolls on a while
    paddle.setTargetY(100);
    for (let t = 0; t < 0.15; t += STEP) paddle.update(STEP);
    paddle.setTargetY(paddle.y);
    const stoppedAt = paddle.y;
    for (let t = 0; t < 0.3; t += STEP) paddle.update(STEP);
    expect(Math.abs(paddle.y - stoppedAt)).toBeGreaterThan(5);

    modifier.end!();
    expect(paddle.grip).toBe(Infinity);
  });
});

describe('Two opponents', () => {
  const flowWith = (modifiers: ModifierId[]) => {
    const paddles = court();
    const flow = new MatchFlow({
      paddles,
      ball: new Ball(),
      input: { pollPlayerMovement: () => {} },
      getDifficulty: () => DifficultyLevel.NORMAL,
      onEvent: () => {},
      random: () => 0.4,
    });
    flow.startMatch({ ...quickMatchRules(5), modifiers });
    return { flow, paddles };
  };

  it('gives the opponent a second paddle for the match, each guarding a half', () => {
    const { flow, paddles } = flowWith(['twoOpponents']);
    expect(paddles).toHaveLength(3);
    expect(paddles.slice(1).map((paddle) => paddle.side)).toEqual([1, 1]);
    // Each stands in its half, and can't leave it
    expect(paddles[1].y).toBeLessThan(COURT.HEIGHT / 2);
    expect(paddles[2].y).toBeGreaterThan(COURT.HEIGHT / 2);
    paddles[1].setTargetY(COURT.HEIGHT);
    expect(paddles[1].targetY).toBeLessThanOrEqual(HALVES[0].bottom - PADDLE.HEIGHT / 2);
    expect(flow.isPlayerPaddle(2)).toBe(false);

    for (let i = 0; i < 240 * 3; i++) flow.update(STEP);
    flow.returnToMenu();
    expect(paddles).toHaveLength(2);
    paddles[1].setTargetY(COURT.HEIGHT);
    expect(paddles[1].targetY).toBeGreaterThan(COURT.HEIGHT / 2);
  });

  it('puts the court back as it was once the match is left', () => {
    const { flow } = flowWith(['wind', 'turbo', 'bumpers']);
    expect(flow.court.wind).not.toBe(0);
    expect(flow.court.turbo).toBe(TURBO.GAIN);
    expect(flow.court.bumpers).toHaveLength(2);
    expect(flow.activeModifiers).toEqual(['wind', 'turbo', 'bumpers']);

    flow.returnToMenu();
    expect([flow.court.wind, flow.court.turbo, flow.court.bumpers.length]).toEqual([0, 0, 0]);
    expect(flow.activeModifiers).toEqual([]);
  });
});

describe('Bricks in a match', () => {
  it('breaks a brick the ball bounces off, and says so', () => {
    const events: MatchEvent[] = [];
    const ball = new Ball();
    const flow = new MatchFlow({
      paddles: court(),
      ball,
      input: { pollPlayerMovement: () => {} },
      getDifficulty: () => DifficultyLevel.NORMAL,
      onEvent: (event) => events.push(event),
      random: () => 0.4,
    });
    flow.startMatch({ ...quickMatchRules(5), modifiers: ['bricks'] });
    while (flow.serveTime > 0) flow.update(STEP);

    // Straight at the first brick of the left column
    const brick = BRICK_WALL[0];
    Object.assign(ball, { x: brick.x - 60, y: brick.y + brick.height / 2, vx: 400, vy: 0 });
    for (let i = 0; i < 60 && ball.vx > 0; i++) flow.update(STEP);

    expect(ball.vx).toBeLessThan(0);
    expect(flow.court.bricks).toHaveLength(BRICK_WALL.length - 1);
    expect(flow.court.bricks).not.toContain(brick);
    expect(events).toContainEqual(expect.objectContaining({ type: 'brickBreak', brick }));
  });
});

describe('Modifiers taking turns (Chaos)', () => {
  const ALL_BUT_TWO = MODIFIER_IDS.filter((id) => id !== 'twoOpponents');
  const rotating = (points = 2): MatchRules => ({
    ...quickMatchRules(7),
    rotation: { modifiers: ALL_BUT_TWO, points },
  });

  const setup = (seed = 7) => {
    const ball = new Ball();
    let state = seed;
    const flow = new MatchFlow({
      paddles: court(),
      ball,
      input: { pollPlayerMovement: () => {} },
      getDifficulty: () => DifficultyLevel.NORMAL,
      onEvent: () => {},
      random: () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646,
    });
    /** Puts the ball past a goal line so the next update scores it. */
    const scoreFor = (scorer: 0 | 1) => {
      while (flow.serveTime > 0) flow.update(STEP);
      ball.x =
        scorer === 0 ? COURT.WIDTH + BALL.OUT_OF_BOUNDS_OFFSET + 1 : -BALL.OUT_OF_BOUNDS_OFFSET - 1;
      ball.vx = scorer === 0 ? 10 : -10;
      flow.update(0.001);
    };
    return { flow, scoreFor };
  };

  it('plays one at a time, the next shown ahead, and hands over after its points', () => {
    const { flow, scoreFor } = setup();
    flow.startMatch(rotating());
    const [first] = flow.activeModifiers;
    const { id: second } = flow.upcomingModifier!;
    expect(flow.activeModifiers).toHaveLength(1);
    expect(second).not.toBe(first);
    expect(flow.upcomingModifier).toEqual({ id: second, inPoints: 2 });

    scoreFor(0);
    expect(flow.activeModifiers).toEqual([first]);
    expect(flow.upcomingModifier).toEqual({ id: second, inPoints: 1 });

    scoreFor(1);
    expect(flow.activeModifiers).toEqual([second]);
    expect(flow.upcomingModifier?.inPoints).toBe(2);
  });

  it('puts the court back between turns: what one changed leaves with it', () => {
    const { flow, scoreFor } = setup();
    flow.startMatch(rotating(1));
    // A point each: every modifier in turn, and the court as each one has it
    for (let point = 0; point < ALL_BUT_TWO.length; point++) {
      const [now] = flow.activeModifiers;
      expect(flow.court.wind !== 0, now).toBe(now === 'wind');
      expect(flow.court.turbo !== 0, now).toBe(now === 'turbo');
      expect(flow.court.bricks.length > 0, now).toBe(now === 'bricks');
      scoreFor((point % 2) as 0 | 1);
    }
  });

  it('deals the order afresh for every match, each of them in it once', () => {
    const order = (seed: number) => {
      const { flow, scoreFor } = setup(seed);
      flow.startMatch(rotating(1));
      const dealt: ModifierId[] = [];
      for (let point = 0; point < ALL_BUT_TWO.length; point++) {
        dealt.push(...flow.activeModifiers);
        scoreFor((point % 2) as 0 | 1);
      }
      return dealt;
    };
    expect([...order(7)].sort()).toEqual([...ALL_BUT_TWO].sort());
    expect(order(7)).toEqual(order(7));
    expect(order(7)).not.toEqual(order(11));
  });

  it('has nothing to show without a rotation, and refuses Two opponents in one', () => {
    const { flow } = setup();
    expect(flow.upcomingModifier).toBeNull();
    flow.startMatch(quickMatchRules(5));
    expect(flow.upcomingModifier).toBeNull();
    expect(() =>
      flow.startMatch({
        ...quickMatchRules(5),
        rotation: { modifiers: ['wind', 'twoOpponents'], points: 2 },
      }),
    ).toThrow();
  });
});
