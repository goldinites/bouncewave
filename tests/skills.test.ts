import { describe, expect, it, vi } from 'vitest';
import { predictArrival } from '@/match/AiController';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { DIFFICULTY_CONFIGS, DifficultyLevel } from '@/match/difficulty';
import { forecastArrival } from '@/match/forecast';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { Overdrive } from '@/match/Overdrive';
import { Paddle } from '@/match/Paddle';
import { AiPaddleController } from '@/match/PaddleController';
import { Physics } from '@/match/Physics';
import { firstTo, STANDARD_RULES } from '@/match/rules';
import { Analyzer } from '@/match/skills/Analyzer';
import { Arc, ARC } from '@/match/skills/Arc';
import { Reflex, REFLEX } from '@/match/skills/Reflex';
import { SkillHost, SkillId } from '@/match/skills/Skill';

const STEP = 1 / 240;
const CONFIG = DIFFICULTY_CONFIGS[DifficultyLevel.NORMAL];

/** A seeded source of randomness (mulberry32), the same sequence on every run. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const court = () => [
  new Paddle(0, PADDLE.OFFSET_X, '#19f0ff'),
  new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6'),
];

/** A ball at (x, y) flying at (vx, vy). */
const ballAt = (x: number, y: number, vx: number, vy = 0) => {
  const ball = new Ball();
  Object.assign(ball, { x, y, vx, vy, speed: Math.hypot(vx, vy) });
  return ball;
};

/** What a skill of the left paddle sees, with `charges` on its meter (null: it has none). */
const hostFor = (paddles: Paddle[], balls: Ball[], charges: number | null = 1) => {
  const meter = charges === null ? null : new Overdrive();
  for (let i = 0; i < (charges ?? 0); i++) meter?.onHit(true);
  const report = vi.fn();
  const host: SkillHost = {
    owner: 0,
    paddles,
    balls,
    meter: () => meter,
    physics: () => CONFIG,
    topSpeed: () => PADDLE.KEYBOARD_SPEED,
    report,
  };
  return { host, report };
};

describe('Overdrive with an implants core', () => {
  it('keeps every charge but one on a hit that is not perfect, and breaks the streak', () => {
    const meter = new Overdrive();
    meter.useCore(true);
    meter.onHit(true);
    meter.onHit(true);
    meter.onHit(false);

    expect(meter.charge).toBe(1);
    expect(meter.streak).toBe(0);
    expect(meter.isCharged).toBe(false);
  });

  it('still takes three perfect hits in a row for the power shot', () => {
    const meter = new Overdrive();
    meter.useCore(true);
    // P P N P P: three charges, a streak of two
    [true, true, false, true, true].forEach((isPerfect) => meter.onHit(isPerfect));
    expect(meter.charge).toBe(3);
    expect(meter.isCharged).toBe(false);

    meter.onHit(true);
    expect(meter.isCharged).toBe(true);
    expect(meter.onHit(false)).toBe(true);
    expect(meter.charge).toBe(0);
  });

  it('empties on a hit that is not perfect without a core, as it always has', () => {
    const meter = new Overdrive();
    meter.onHit(true);
    meter.onHit(true);
    meter.onHit(false);
    expect([meter.charge, meter.streak]).toEqual([0, 0]);
  });

  it('gives back charges, up to a full meter, leaving the streak', () => {
    const meter = new Overdrive();
    meter.useCore(true);
    [true, true, false].forEach((isPerfect) => meter.onHit(isPerfect));
    meter.restore(5);
    expect([meter.charge, meter.streak]).toEqual([3, 0]);
  });

  it('spends charges it holds; spending from a full meter costs the power shot', () => {
    const meter = new Overdrive();
    [true, true, true].forEach((isPerfect) => meter.onHit(isPerfect));

    expect(meter.spend(4)).toBe(false);
    expect(meter.spend(1)).toBe(true);
    expect([meter.charge, meter.streak]).toEqual([2, 2]);
    expect(meter.isCharged).toBe(false);
  });
});

describe('Spin', () => {
  it('turns the flight and keeps the speed', () => {
    const ball = ballAt(200, 250, 400);
    ball.spin = -0.5;
    for (let i = 0; i < 60; i++) Physics.step(ball, [], CONFIG, STEP);

    expect(ball.vy).toBeLessThan(0);
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(400, 6);
  });

  it('comes off at a wall', () => {
    const ball = ballAt(200, COURT.TOP_WALL + 10, 300, -300);
    ball.spin = 0.4;
    for (let i = 0; i < 20; i++) Physics.step(ball, [], CONFIG, STEP);
    expect(ball.spin).toBe(0);
  });

  it('never turns the ball back toward its hitter', () => {
    const ball = ballAt(100, 250, 400);
    ball.spin = 30; // far beyond any skill's
    for (let i = 0; i < 240; i++) Physics.step(ball, [], CONFIG, STEP);
    expect(ball.vx).toBeGreaterThan(0);
  });
});

describe('forecastArrival', () => {
  it('agrees with the straight-line prediction for a ball with no spin', () => {
    const ball = ballAt(400, 200, -420, 310);
    const forecast = forecastArrival(ball, 60, CONFIG)!;
    const straight = predictArrival(60, ball.x, ball.y, ball.vx, ball.vy, ball.radius);

    expect(forecast.y).toBeCloseTo(straight.y, 0);
    expect(forecast.bounces).toBe(straight.bounces);
  });

  it('reads a curving ball where it really arrives, and leaves it as it was', () => {
    const ball = ballAt(100, 250, 450, 60);
    ball.spin = -0.5;
    ball.spinDecay = ARC.DECAY;
    const forecast = forecastArrival(ball, 700, CONFIG)!;
    expect(ball.x).toBe(100);

    let time = 0;
    while (ball.x < 700) {
      Physics.step(ball, [], CONFIG, STEP);
      time += STEP;
    }
    expect(Math.abs(forecast.y - ball.y)).toBeLessThan(4);
    expect(forecast.time).toBeCloseTo(time, 1);
  });

  it('has nothing to say about a ball flying away from the line', () => {
    expect(forecastArrival(ballAt(400, 250, 300), 60, CONFIG)).toBeNull();
  });
});

describe('Arc', () => {
  it('puts no spin on from a paddle that is only tracking the ball', () => {
    expect(Arc.spinFor(ARC.THRESHOLD - 1, 400, 400, true)).toBe(0);
  });

  it('bends the ball back against the paddle’s motion, twice as hard off a perfect hit', () => {
    // Left paddle moving down sends the ball right: it curves up
    const normal = Arc.spinFor(700, 400, 400, false);
    expect(normal).toBeLessThan(0);
    expect(Arc.spinFor(700, 400, 400, true)).toBeCloseTo(normal * ARC.PERFECT_FACTOR);
    // Right paddle moving down sends the ball left: it curves up too
    const fromRight = ballAt(400, 250, -400);
    fromRight.spin = Arc.spinFor(700, -400, 400, false);
    Physics.step(fromRight, [], CONFIG, 0.1);
    expect(fromRight.vy).toBeLessThan(0);
  });

  /**
   * How far off the straight line a flat shot at `speed` lands across the court. It leaves low
   * and bends up (the paddle moving down), so no wall cuts the bend short.
   */
  const bendOf = (speed: number, paddleVelocity: number, isPerfect: boolean) =>
    flyArc(speed, paddleVelocity, isPerfect).bend;

  /**
   * A flat shot at `speed` spun by Arc off a paddle moving down at `paddleVelocity`: how far off
   * the straight line it lands across the court, and how far it was at 40% of the way.
   */
  const flyArc = (speed: number, paddleVelocity: number, isPerfect: boolean) => {
    const paddles = court();
    const faceX = PADDLE.OFFSET_X + PADDLE.WIDTH;
    const startY = COURT.HEIGHT - COURT.BOTTOM_WALL - 20;
    const ball = ballAt(faceX, startY, speed);
    paddles[0].velocity = Math.abs(paddleVelocity);
    new Arc(hostFor(paddles, [ball]).host).afterHit({
      paddleIndex: 0,
      ball,
      isPerfect,
      isPowerShot: false,
    });
    const endX = COURT.WIDTH - faceX;
    let early = 0;
    while (ball.x < endX) {
      Physics.step(ball, [], CONFIG, STEP);
      if (ball.x < faceX + (endX - faceX) * 0.4) early = Math.abs(ball.y - startY);
    }
    expect(ball.spin).not.toBe(0); // no wall took it off
    return { bend: Math.abs(ball.y - startY), early };
  };

  it('breaks late off a hard spin on a fast ball: as far, but later', () => {
    expect(Arc.lateShare(1e6, 450)).toBe(0);
    expect(Arc.lateShare(260, 1000)).toBe(0);
    expect(Arc.lateShare(1e6, 1000)).toBe(ARC.LATE_BREAK.MAX_SHARE);

    // The same spin's share on a fast ball, from a paddle that just reaches the late break or not
    const soft = flyArc(1000, 360, true);
    const hard = flyArc(1000, 1e6, true);
    expect(hard.early).toBeLessThan(soft.early * 0.6);
    expect(hard.bend).toBeGreaterThan(soft.bend);
  });

  it('bends a perfect hit no more than half the court, at any speed', () => {
    for (const speed of [380, 600, 840, 1080]) {
      expect(bendOf(speed, 1e6, true)).toBeLessThanOrEqual(COURT.HEIGHT / 2);
    }
  });

  it('bends a hit from a paddle at the keyboard’s speed far enough to see, fast or slow', () => {
    for (const speed of [380, 1080]) {
      expect(bendOf(speed, PADDLE.KEYBOARD_SPEED, false)).toBeGreaterThan(100);
      expect(bendOf(speed, PADDLE.KEYBOARD_SPEED, true)).toBeGreaterThan(180);
    }
  });

  /** A paddle steered like a held key, at the keyboard's speed, for `seconds` after standing. */
  const movedFor = (seconds: number) => {
    const paddle = court()[0];
    paddle.y = paddle.targetY = 100;
    for (let t = 0; t < seconds; t += STEP) {
      paddle.setTargetY(paddle.targetY + PADDLE.KEYBOARD_SPEED * STEP);
      paddle.update(STEP);
    }
    return paddle;
  };

  it('times a paddle’s motion: anew from standing still or turning around', () => {
    expect(movedFor(0.2).motionTime).toBeLessThan(0.2);
    expect(movedFor(0.6).motionTime).toBeGreaterThan(0.5);

    const turned = movedFor(0.6);
    for (let t = 0; t < 0.1; t += STEP) {
      turned.setTargetY(turned.targetY - PADDLE.KEYBOARD_SPEED * STEP);
      turned.update(STEP);
    }
    expect(turned.motionTime).toBeLessThan(0.1);
  });

  it('spins a swing at the ball, not a chase after it', () => {
    const spinOff = (paddle: Paddle) => {
      const paddles = [paddle, court()[1]];
      const ball = ballAt(60, 250, 400);
      new Arc(hostFor(paddles, [ball]).host).afterHit({
        paddleIndex: 0,
        ball,
        isPerfect: false,
        isPowerShot: false,
      });
      return ball.spin;
    };
    expect(spinOff(movedFor(0.15))).not.toBe(0);
    expect(spinOff(movedFor(0.6))).toBe(0);
  });

  it('spins its owner’s hits on the move and reports them', () => {
    const paddles = court();
    const ball = ballAt(60, 250, 400);
    const { host, report } = hostFor(paddles, [ball]);
    const arc = new Arc(host);
    paddles[0].velocity = 700;
    paddles[1].velocity = 700;

    arc.afterHit({ paddleIndex: 1, ball, isPerfect: false, isPowerShot: false });
    expect(ball.spin).toBe(0);

    arc.afterHit({ paddleIndex: 0, ball, isPerfect: false, isPowerShot: false });
    expect(ball.spin).toBeLessThan(0);
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ skill: 'arc' }));
  });
});

describe('Analyzer', () => {
  /** The opponent (right) has just hit `ball` at the left paddle, which has an Analyzer. */
  const shotAt = (ball: Ball, charges: number | null = 1) => {
    const paddles = court();
    const { host, report } = hostFor(paddles, [ball], charges);
    const analyzer = new Analyzer(host);
    analyzer.afterHit({ paddleIndex: 1, ball, isPerfect: false, isPowerShot: ball.isPowerShot });
    analyzer.beforeStep(STEP);
    return { analyzer, report, meter: host.meter(), paddles };
  };
  // Two walls or more on the way: hard; flat across: easy
  const zigzag = () => ballAt(700, 250, -450, 700);
  const flat = () => ballAt(700, 250, -450, 20);

  it('reads a hard shot for a charge: its flight, ending where it meets the paddle', () => {
    const ball = zigzag();
    const { analyzer, report, meter } = shotAt(ball);

    expect(report).toHaveBeenCalledWith(expect.objectContaining({ skill: 'analyzer' }));
    expect(meter!.charge).toBe(0);
    const read = analyzer.read!;
    expect(read.paddleIndex).toBe(0);
    expect(read.path.at(-1)!.x).toBeCloseTo(PADDLE.OFFSET_X + PADDLE.WIDTH + ball.radius);
    expect(read.path.at(-1)!.y).toBeCloseTo(forecastArrival(ball, read.path.at(-1)!.x, CONFIG)!.y);

    analyzer.beforeStep(0.1);
    expect(analyzer.read!.age).toBeCloseTo(STEP + 0.1);
  });

  it('reads a curve or a power shot however flat, and leaves an easy shot alone', () => {
    expect(shotAt(flat()).report).not.toHaveBeenCalled();

    const curve = flat();
    curve.spin = -0.3;
    expect(shotAt(curve).report).toHaveBeenCalled();
    const power = flat();
    power.isPowerShot = true;
    expect(shotAt(power).report).toHaveBeenCalled();
  });

  it('needs a charge, and never takes one from a full meter', () => {
    expect(shotAt(zigzag(), 0).report).not.toHaveBeenCalled();
    expect(shotAt(zigzag(), null).report).not.toHaveBeenCalled();
    expect(shotAt(zigzag(), 3).report).not.toHaveBeenCalled();
  });

  it('gives the charge back for a perfect return of the ball it read', () => {
    const ball = zigzag();
    const { analyzer, meter } = shotAt(ball, 2);
    analyzer.afterHit({ paddleIndex: 0, ball, isPerfect: true, isPowerShot: false });
    expect(meter!.charge).toBe(2);
    expect(analyzer.read).toBeNull();

    const missed = zigzag();
    const other = shotAt(missed, 2);
    other.analyzer.afterHit({ paddleIndex: 0, ball: missed, isPerfect: false, isPowerShot: false });
    expect(other.meter!.charge).toBe(1);
  });

  it('reads once a rally', () => {
    const ball = zigzag();
    const { analyzer, report } = shotAt(ball, 2);
    analyzer.afterHit({ paddleIndex: 0, ball, isPerfect: false, isPowerShot: false });
    Object.assign(ball, { x: 700, vx: -450, vy: 700 });
    analyzer.afterHit({ paddleIndex: 1, ball, isPerfect: false, isPowerShot: false });
    analyzer.beforeStep(STEP);
    expect(report).toHaveBeenCalledOnce();

    analyzer.onServe();
    analyzer.afterHit({ paddleIndex: 1, ball, isPerfect: false, isPowerShot: false });
    analyzer.beforeStep(STEP);
    expect(report).toHaveBeenCalledTimes(2);
  });
});

describe('Reflex', () => {
  // Ball low on the left, flying flat at the left paddle; the paddle somewhere above it
  const flyAt = (paddleY: number, ballY = 420, charges: number | null = 1) => {
    const paddles = court();
    paddles[0].y = paddleY;
    const ball = ballAt(320, ballY, -500);
    const { host, report } = hostFor(paddles, [ball], charges);
    const reflex = new Reflex(host);
    // How fast the balls, the owner and the opponent went at each step
    const scales: [number, number, number][] = [];
    // Until the ball reaches the paddle's face
    while (ball.x > PADDLE.OFFSET_X + PADDLE.WIDTH + ball.radius) {
      reflex.beforeStep(STEP);
      scales.push([reflex.timeScale('balls'), reflex.timeScale(0), reflex.timeScale(1)]);
      Physics.step(ball, [], CONFIG, STEP * reflex.timeScale('balls'));
    }
    return { paddles, ball, reflex, report, scales, meter: host.meter() };
  };

  it('slows the ball and the opponent, not its owner, when the ball is about to get past', () => {
    // 240 px beyond reach: too far at the keyboard's speed, close enough with the world slowed
    const { paddles, reflex, report, scales, meter } = flyAt(420 - 52.4 - 240);

    expect(report).toHaveBeenCalledOnce();
    expect(meter!.charge).toBe(0);
    const slowed = scales.filter(([balls]) => balls < 1);
    expect(slowed.length).toBeGreaterThan(0);
    for (const step of slowed) expect(step).toEqual([REFLEX.SLOW, 1, REFLEX.SLOW]);
    // No longer than its longest, and the wider zone is there when the ball arrives
    expect(slowed.length * STEP).toBeLessThanOrEqual(REFLEX.MAX_DURATION + STEP);
    expect(paddles[0].perfectZoneScale).toBe(REFLEX.ZONE_BOOST);
    expect(reflex.timeScale('balls')).toBe(1);
  });

  it('lets go once its owner returns the ball', () => {
    const { paddles, ball, reflex } = flyAt(420 - 52.4 - 240);
    reflex.afterHit({ paddleIndex: 0, ball, isPerfect: true, isPowerShot: false });
    expect(paddles[0].perfectZoneScale).toBe(1);
  });

  it('spends nothing on a ball its owner covers, would reach anyway, or could never reach', () => {
    expect(flyAt(420).report).not.toHaveBeenCalled();
    expect(flyAt(420 - 52.4 - 100).report).not.toHaveBeenCalled();
    expect(flyAt(PADDLE.TOP_MARGIN + PADDLE.HEIGHT / 2, 470).report).not.toHaveBeenCalled();
  });

  it('needs a charge on a meter', () => {
    expect(flyAt(420 - 52.4 - 240, 420, 0).report).not.toHaveBeenCalled();
    expect(flyAt(420 - 52.4 - 240, 420, null).report).not.toHaveBeenCalled();
  });

  it('goes off once a rally', () => {
    const { ball, reflex, report } = flyAt(420 - 52.4 - 240);
    reflex.afterHit({ paddleIndex: 0, ball, isPerfect: true, isPowerShot: false });
    // The same shot again in the same rally, a charge to spare
    Object.assign(ball, { x: 320, y: 420, vx: -500, vy: 0 });
    for (let i = 0; i < 240; i++) reflex.beforeStep(STEP);
    expect(report).toHaveBeenCalledOnce();

    reflex.onServe();
    expect(reflex.timeScale('balls')).toBe(1);
  });
});

describe('A match with skills', () => {
  /** An AI-vs-AI match with skills on both sides, from a seed; what happened, step by step. */
  const play = (seed: number, skills: readonly SkillId[]) => {
    const paddles = court();
    const events: MatchEvent[] = [];
    const random = seeded(seed);
    const flow = new MatchFlow({
      paddles,
      ball: new Ball(),
      input: { pollPlayerMovement: () => {} },
      getDifficulty: () => DifficultyLevel.HARD,
      onEvent: (event) => events.push(event),
      random,
    });
    const lineup = paddles.map(() => ({
      controller: new AiPaddleController(random, () => DifficultyLevel.HARD),
      overdrive: true,
      skills,
    }));
    flow.startMatch({ ...STANDARD_RULES, winningScores: firstTo(99), balls: 2 }, lineup);
    const trace: number[] = [];
    for (let i = 0; i < 240 * 90; i++) {
      flow.update(STEP);
      trace.push(flow.balls[0].x, flow.balls[0].y, paddles[0].y);
    }
    return { events, trace };
  };

  it('replays the same from the same seed', () => {
    const first = play(2, ['arc', 'analyzer', 'reflex']);
    const second = play(2, ['arc', 'analyzer', 'reflex']);
    expect(second.trace).toEqual(first.trace);
    expect(second.events).toEqual(first.events);
  });

  it('plays every skill in matches of AIs that have them', () => {
    // The implants go off in some matches only: a few seeds between them see every skill
    const used = new Set(
      [1, 2, 3, 4]
        .flatMap((seed) => play(seed, ['arc', 'analyzer', 'reflex']).events)
        .map((event) => event.type === 'skill' && event.skill),
    );
    expect(used).toEqual(new Set([false, 'arc', 'analyzer', 'reflex']));
  });

  it('gives a paddle other skills in the middle of a match, never in the demo', () => {
    const paddles = court();
    const flow = new MatchFlow({
      paddles,
      ball: new Ball(),
      input: { pollPlayerMovement: () => {} },
      getDifficulty: () => DifficultyLevel.NORMAL,
      onEvent: () => {},
      random: seeded(1),
    });
    flow.startAttract();
    flow.giveSkills(0, ['reflex']);
    expect(flow.overdriveCharges).toEqual([null, null]);

    flow.startMatch();
    paddles[0].perfectZoneScale = 1.5; // as a Reflex in the middle of a save leaves it
    flow.giveSkills(0, ['arc']);
    expect(paddles[0].perfectZoneScale).toBe(1);
    expect(flow.overdriveCharges).toEqual([0, null]);
  });

  it('reports no skill when no one has one', () => {
    expect(play(7, []).events.some((event) => event.type === 'skill')).toBe(false);
  });
});
