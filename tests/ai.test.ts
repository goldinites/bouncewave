import { describe, expect, it } from 'vitest';
import { AiController, predictArrival, SHOT_THREAT } from '@/match/AiController';
import { Ball } from '@/match/Ball';
import { BALL, COURT, PADDLE } from '@/match/config';
import {
  AiSkill,
  DifficultyLevel,
  DIFFICULTY_CONFIGS,
  DIFFICULTY_LEVELS,
} from '@/match/difficulty';
import { forecastArrival } from '@/match/forecast';
import { Paddle } from '@/match/Paddle';
import { Physics } from '@/match/Physics';

const RADIUS = 8;
const TOP = COURT.TOP_WALL + RADIUS;
const BOTTOM = COURT.HEIGHT - COURT.BOTTOM_WALL - RADIUS;
const SPAN = BOTTOM - TOP;

/** A skill with no reaction time and no misjudgment, unless overridden. */
const skill = (overrides: Partial<AiSkill> = {}): AiSkill => ({
  speed: 10000,
  reaction: 0,
  error: 0,
  errorPerBounce: 0,
  angleShots: 0,
  nerves: 0,
  perfectAim: 0,
  curveRead: 0,
  overdrive: false,
  fatigue: 0,
  ...overrides,
});

const playerPaddle = () => new Paddle(0, PADDLE.OFFSET_X, '#19f0ff');
const cpuPaddle = () => new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6');
const cpuFaceX = (cpu: Paddle) => cpu.x - RADIUS;

/** A ball at (x, y) flying with velocity (vx, vy). */
const ballAt = (x: number, y: number, vx: number, vy: number): Ball => {
  const ball = new Ball();
  Object.assign(ball, { x, y, vx, vy, radius: RADIUS, speed: Math.hypot(vx, vy) });
  return ball;
};

/** Deterministic stand-in for Math.random. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe('predictArrival', () => {
  it('follows a straight path when no wall is in the way', () => {
    expect(predictArrival(500, 100, 200, 400, 100, RADIUS)).toEqual({ y: 300, bounces: 0 });
  });

  it('folds the path back off each wall it hits', () => {
    // Travels 100 px past the bottom wall: comes back up by 100
    const once = predictArrival(500, 100, BOTTOM - 50, 400, 150, RADIUS);
    expect(once.bounces).toBe(1);
    expect(once.y).toBeCloseTo(BOTTOM - 100);

    // Up past the top wall, all the way down and back up by 30
    const twice = predictArrival(500, 100, TOP + 20, 400, -(20 + SPAN + 30), RADIUS);
    expect(twice.bounces).toBe(2);
    expect(twice.y).toBeCloseTo(BOTTOM - 30);
  });

  it('matches where Physics actually takes the ball', () => {
    const player = playerPaddle();
    const cpu = cpuPaddle();
    cpu.y = -1000; // out of the way, so the ball flies through to its face
    const ball = ballAt(100, 120, 300, -700);
    const predicted = predictArrival(cpuFaceX(cpu), ball.x, ball.y, ball.vx, ball.vy, RADIUS);

    const config = DIFFICULTY_CONFIGS[DifficultyLevel.NORMAL];
    while (ball.x < cpuFaceX(cpu)) Physics.step(ball, [player, cpu], config, 1 / 240);

    expect(predicted.bounces).toBeGreaterThanOrEqual(2);
    expect(ball.y).toBeCloseTo(predicted.y, -1);
  });

  it('has a ball heading away arrive where it is', () => {
    expect(predictArrival(500, 600, 200, 400, 100, RADIUS)).toEqual({ y: 200, bounces: 0 });
  });
});

describe('AiController', () => {
  it('heads for where the ball will arrive, not where it is', () => {
    const cpu = cpuPaddle();
    const ball = ballAt(200, 300, 400, 200); // arrives near the bottom
    const ai = new AiController(() => 0.5);
    ai.readShot(cpu, skill());

    // Flown ahead by the physics, as the ball will really fly
    const arrival = forecastArrival(ball, cpuFaceX(cpu))!;
    ai.update(cpu, ball, skill(), 1, playerPaddle());

    expect(cpu.targetY).toBeCloseTo(Math.min(arrival.y, COURT.HEIGHT - 66));
    expect(cpu.targetY).toBeGreaterThan(ball.y);
  });

  it('holds still until it has reacted to a new shot', () => {
    const cpu = cpuPaddle();
    cpu.targetY = 100;
    const ball = ballAt(200, 400, 400, 0);
    const ai = new AiController(() => 0.5);
    const slow = skill({ reaction: 0.2 });
    ai.readShot(cpu, slow);

    ai.update(cpu, ball, slow, 0.1, playerPaddle());
    expect(cpu.targetY).toBe(100);

    ai.update(cpu, ball, slow, 0.15, playerPaddle());
    ai.update(cpu, ball, slow, 0.1, playerPaddle());
    expect(cpu.targetY).toBeCloseTo(400);
  });

  it('reacts later to a power shot and misjudges a perfect one more', () => {
    const cpu = cpuPaddle();
    cpu.targetY = 100;
    const ball = ballAt(200, 400, 400, 0);
    const ai = new AiController(() => 0.5);
    const quick = skill({ reaction: 0.1 });

    ai.readShot(cpu, quick, SHOT_THREAT.POWER);
    for (let t = 0; t < 0.25; t += 0.05) ai.update(cpu, ball, quick, 0.05, playerPaddle());
    expect(cpu.targetY).toBe(100);

    const misreadOf = (threat: (typeof SHOT_THREAT)[keyof typeof SHOT_THREAT]) => {
      const paddle = cpuPaddle();
      const reader = new AiController(() => 1);
      const sloppy = skill({ error: 40 });
      reader.readShot(paddle, sloppy, threat);
      // So fast it gives no time to correct the read
      const ball = ballAt(400, 250, 1e6, 0);
      // Two frames: a threat's extra reaction time may take up the first
      reader.update(paddle, ball, sloppy, 1, playerPaddle());
      reader.update(paddle, ball, sloppy, 1, playerPaddle());
      return paddle.targetY - 250;
    };
    expect(misreadOf(SHOT_THREAT.PERFECT)).toBeCloseTo(misreadOf(SHOT_THREAT.NORMAL) * 1.5);
  });

  it('returns toward the center when the ball heads away', () => {
    const cpu = cpuPaddle();
    cpu.targetY = 100;
    const ai = new AiController();

    ai.update(cpu, ballAt(400, 400, -300, 0), skill({ speed: 440 }), 0.1, playerPaddle());

    expect(cpu.targetY).toBeGreaterThan(100);
    expect(cpu.targetY).toBeLessThanOrEqual(COURT.HEIGHT / 2);
  });

  it('moves no faster than its skill allows', () => {
    const cpu = cpuPaddle();
    cpu.targetY = 100;
    const ai = new AiController(() => 0.5);
    const capped = skill({ speed: 400 });
    ai.readShot(cpu, capped);

    ai.update(cpu, ballAt(200, 420, 300, 0), capped, 0.1, playerPaddle());

    expect(cpu.targetY).toBeCloseTo(100 + 400 * 0.1);
  });

  it('misjudges shots that bounce off more walls by more', () => {
    // random() = 1 → the largest misjudgment, +0.5 of the spread
    const misreadOf = (ball: Ball) => {
      const cpu = cpuPaddle();
      const ai = new AiController(() => 1);
      const sloppy = skill({ error: 20, errorPerBounce: 40 });
      ai.readShot(cpu, sloppy);
      const arrival = forecastArrival(ball, cpuFaceX(cpu))!;
      ai.update(cpu, ball, sloppy, 1, playerPaddle());
      return { misread: cpu.targetY - arrival.y, bounces: arrival.bounces };
    };

    const flat = misreadOf(ballAt(400, 200, 400, 0));
    expect(flat.bounces).toBe(0);
    expect(flat.misread).toBeCloseTo(10);

    // Two bounces, arriving mid-court where the paddle can follow its misread
    const steep = misreadOf(ballAt(100, 150, 300, 471));
    expect(steep.bounces).toBe(2);
    expect(steep.misread).toBeCloseTo(0.5 * (20 + 40 * 2));
  });

  it('angles its return to land away from the opponent', () => {
    /** Where a return hit at `offset` off the CPU paddle's center reaches the player's paddle. */
    const landing = (cpu: Paddle, player: Paddle, contactY: number, offset: number) => {
      const angle = Physics.getBounceAngle(offset);
      return predictArrival(
        player.x + PADDLE.WIDTH,
        cpu.x,
        contactY,
        -Math.cos(angle),
        Math.sin(angle),
        0,
      ).y;
    };

    for (const opponentY of [80, 180, 320, 420]) {
      const cpu = cpuPaddle();
      const player = playerPaddle();
      player.y = opponentY;
      const ball = ballAt(400, 250, 400, 0);
      const ai = new AiController(() => 0.5);
      const angler = skill({ angleShots: 1 });
      ai.readShot(cpu, angler);
      ai.update(cpu, ball, angler, 1, player);

      // The ball meets the paddle this many half-heights below its center
      const offset = (ball.y - cpu.targetY) / (PADDLE.HEIGHT / 2);
      expect(Math.abs(offset)).toBeGreaterThan(0.5);
      expect(Math.abs(offset)).toBeLessThan(0.9);

      const chosen = Math.abs(landing(cpu, player, 250, offset) - opponentY);
      const mirrored = Math.abs(landing(cpu, player, 250, -offset) - opponentY);
      expect(chosen).toBeGreaterThanOrEqual(mirrored);
    }
  });

  it('plays flat returns when it does not angle them', () => {
    const cpu = cpuPaddle();
    const ball = ballAt(400, 250, 400, 0);
    const ai = new AiController(() => 0.5);
    ai.readShot(cpu, skill());
    ai.update(cpu, ball, skill(), 1, playerPaddle());
    expect(cpu.targetY).toBeCloseTo(250);
  });

  it('with nerves, first leans toward the ball and settles on the trajectory over a few glances', () => {
    const cpu = cpuPaddle();
    const ball = ballAt(200, 150, 400, 150); // arrives well below where it is now
    const arrival = predictArrival(cpuFaceX(cpu), ball.x, ball.y, ball.vx, ball.vy, RADIUS);
    // random() = 0.5: glances halfway through their interval range, and no twitches
    const ai = new AiController(() => 0.5);
    const human = skill({ nerves: 1 });
    ai.readShot(cpu, human);

    ai.update(cpu, ball, human, 0.01, playerPaddle());
    const firstLook = cpu.targetY;
    expect(firstLook).toBeGreaterThan(ball.y);
    expect(firstLook).toBeLessThan(arrival.y - 20);

    for (let t = 0; t < 2; t += 0.01) ai.update(cpu, ball, human, 0.01, playerPaddle());
    expect(cpu.targetY).toBeCloseTo(arrival.y);
  });

  it('twitches now and then, but never just before the ball arrives', () => {
    const settledTarget = (ball: Ball) => {
      const cpu = cpuPaddle();
      // random() = 0 → a twitch on every glance, as large as it gets, upward
      const ai = new AiController(() => 0);
      const human = skill({ nerves: 1 });
      ai.readShot(cpu, human);
      for (let t = 0; t < 2; t += 0.01) ai.update(cpu, ball, human, 0.01, playerPaddle());
      const arrival = predictArrival(cpuFaceX(cpu), ball.x, ball.y, ball.vx, ball.vy, RADIUS);
      return cpu.targetY - arrival.y;
    };

    expect(settledTarget(ballAt(100, 250, 300, 0))).toBeLessThan(-10);
    expect(settledTarget(ballAt(700, 250, 300, 0))).toBeCloseTo(0);
  });

  it('forgets its reads on reset', () => {
    const cpu = cpuPaddle();
    cpu.targetY = 100;
    const ai = new AiController(() => 0.5);
    ai.readShot(cpu, skill({ reaction: 10 }));
    ai.reset();

    ai.update(cpu, ballAt(400, 300, 400, 0), skill(), 1, playerPaddle());
    expect(cpu.targetY).toBeCloseTo(300);
  });
});

// Thousands of shots played out step by step: about a second each, several times that under
// coverage's instrumentation (npm run coverage)
describe('AI balance', { timeout: 20_000 }, () => {
  /** Share of edge-of-paddle shots at `speed` (top speed by default) the CPU returns. */
  const edgeShotReturnRate = (
    level: DifficultyLevel,
    trials = 400,
    speed = DIFFICULTY_CONFIGS[level].maxSpeed,
  ): number => {
    const random = seeded(level + 1);
    const config = DIFFICULTY_CONFIGS[level];
    let returned = 0;

    for (let i = 0; i < trials; i++) {
      const player = playerPaddle();
      const cpu = cpuPaddle();
      cpu.y = cpu.targetY = COURT.HEIGHT / 2 + (random() - 0.5) * 160;
      const angle = Physics.getBounceAngle(1) * (random() < 0.5 ? -1 : 1);
      const ball = ballAt(
        PADDLE.OFFSET_X + PADDLE.WIDTH + RADIUS,
        60 + random() * 380,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
      );
      const ai = new AiController(random);
      ai.readShot(cpu, config);

      for (let t = 0; t < 8; t += 1 / 60) {
        ai.update(cpu, ball, config, 1 / 60, player);
        cpu.update(1 / 60);
        const events = Physics.step(ball, [player, cpu], config, 1 / 60);
        if (events.some((e) => e.type === 'paddleHit')) returned++;
        if (events.some((e) => e.type === 'paddleHit' || e.type === 'score')) break;
      }
    }
    return returned / trials;
  };

  it('counters the fast edge shot more the higher the level, and mostly on Insane', () => {
    const rates = DIFFICULTY_LEVELS.map((level) => edgeShotReturnRate(level));

    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeGreaterThan(rates[i - 1]);
    }
    expect(rates[0]).toBeLessThan(0.78); // still a good shot on Normal
    expect(rates[rates.length - 1]).toBeGreaterThan(0.82);
  });

  it('never lets a slow ball past, however steep: it has all the time it needs to read it', () => {
    for (const level of DIFFICULTY_LEVELS) {
      expect(edgeShotReturnRate(level, 300, BALL.INITIAL_SPEED)).toBeGreaterThan(0.97);
    }
  });
});
