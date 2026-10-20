import { describe, expect, it } from 'vitest';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { CourtConditions } from '@/match/court';
import { DIFFICULTY_CONFIGS, DifficultyLevel } from '@/match/difficulty';
import { forecastArrival } from '@/match/forecast';
import { MatchFlow } from '@/match/MatchFlow';
import { ModifierHost, ModifierId } from '@/match/modifiers/Modifier';
import { BUMPERS, HALVES, MODIFIERS, RAIN, SHRINK, TURBO, WIND } from '@/match/modifiers/modifiers';
import { quickMatchRules } from '@/match/modes';
import { Paddle } from '@/match/Paddle';
import { Physics } from '@/match/Physics';

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
  let seed = 0.13;
  const host: ModifierHost = {
    paddles,
    balls,
    court: conditions,
    isPlayerPaddle: (index) => index === 0,
    // A spread of values, so the wind's gusts differ
    random: () => (seed = (seed * 9301 + 0.4927) % 1),
  };
  return { modifier: MODIFIERS[id](host), paddles, conditions };
};

describe('The court’s conditions in the physics', () => {
  it('lets the wind push the ball’s path along, its speed kept', () => {
    const conditions = new CourtConditions();
    conditions.wind = WIND.MAX;
    const ball = ballOver(conditions, 200, 250, 400);
    for (let i = 0; i < 120; i++) Physics.step(ball, [], CONFIG, STEP);

    expect(ball.vy).toBeGreaterThan(0);
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(400, 6);
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
    expect(events.some((event) => event.type === 'wallBounce')).toBe(true);
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
    const { modifier, conditions } = make('wind');
    modifier.start!();
    const before = Math.sign(conditions.wind);
    for (let t = 0; t < WIND.PERIOD - 0.5; t += 0.1) modifier.beforeStep!(0.1);
    expect(conditions.windTurnsIn).toBeLessThan(WIND.WARNING);
    expect(Math.sign(conditions.wind)).toBe(before);
    for (let t = 0; t < 1; t += 0.1) modifier.beforeStep!(0.1);
    expect(Math.sign(conditions.wind)).toBe(-before);

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
    const { modifier, conditions } = make('bumpers', [ball]);
    modifier.start!();
    const middle = () => conditions.bumpers.find((post) => post.y === COURT.HEIGHT / 2);
    expect(conditions.bumpers).toHaveLength(2);

    // Its time comes with the ball in the middle: it waits
    for (let t = 0; t < BUMPERS.DOWN + 1; t += 0.05) modifier.beforeStep!(0.05);
    expect(middle()).toBeUndefined();

    ball.x = 100;
    modifier.beforeStep!(0.05);
    modifier.beforeStep!(BUMPERS.RISE / 2);
    expect(middle()!.growth).toBeGreaterThan(0);
    expect(middle()!.growth).toBeLessThan(1);
    modifier.beforeStep!(BUMPERS.RISE);
    expect(middle()!.radius).toBe(BUMPERS.RADIUS);

    modifier.onServe!();
    expect(middle()).toBeUndefined();
  });

  it('shrinks the player’s paddle with each of their hits, whole again at the serve', () => {
    const { modifier, paddles } = make('shrinkingPaddle');
    modifier.start!();
    const hit = (paddleIndex: number) =>
      modifier.afterHit!({ paddleIndex, ball: new Ball(), isPerfect: false, isPowerShot: false });

    hit(0);
    hit(0);
    hit(1);
    expect(paddles[0].spec.height).toBeCloseTo(PADDLE.HEIGHT * (1 - 2 * SHRINK.PER_HIT));
    expect(paddles[1].spec.height).toBe(PADDLE.HEIGHT);
    for (let i = 0; i < 20; i++) hit(0);
    expect(paddles[0].spec.height).toBeCloseTo(PADDLE.HEIGHT * SHRINK.FLOOR);

    modifier.onServe!();
    expect(paddles[0].spec.height).toBe(PADDLE.HEIGHT);
  });

  it('makes every paddle slide in the rain: it lags its aim, then runs past it', () => {
    const { modifier, paddles } = make('slipperyRain');
    modifier.start!();
    const paddle = paddles[0];
    expect(paddle.grip).toBe(RAIN.GRIP);

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
