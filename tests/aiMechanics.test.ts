import { describe, expect, it } from 'vitest';
import { AiController, predictArrival } from '@/match/AiController';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { AiSkill, DIFFICULTY_CONFIGS, DifficultyLevel } from '@/match/difficulty';
import { forecastArrival } from '@/match/forecast';
import { MatchFlow } from '@/match/MatchFlow';
import { quickMatchRules } from '@/match/modes';
import { Paddle } from '@/match/Paddle';
import { AiPaddleController } from '@/match/PaddleController';
import { Physics } from '@/match/Physics';
import { STANDARD_RULES } from '@/match/rules';

const STEP = 1 / 240;

/** A skill with no reaction time and no misjudgment, unless overridden. */
const skill = (overrides: Partial<AiSkill> = {}): AiSkill => ({
  speed: 640,
  reaction: 0,
  error: 0,
  errorPerBounce: 0,
  angleShots: 0,
  nerves: 0,
  perfectAim: 0,
  curveRead: 0,
  overdrive: false,
  ...overrides,
});

const playerPaddle = () => new Paddle(0, PADDLE.OFFSET_X, '#19f0ff');
const cpuPaddle = () => new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6');

const ballAt = (x: number, y: number, vx: number, vy: number): Ball => {
  const ball = new Ball();
  Object.assign(ball, { x, y, vx, vy, speed: Math.hypot(vx, vy) });
  return ball;
};

describe('The AI reads the physics', () => {
  it('heads for where a curving ball will really arrive', () => {
    const cpu = cpuPaddle();
    const ball = ballAt(150, 250, 450, 0);
    ball.spin = 0.4;
    ball.spinDecay = 0.6;
    const faceX = cpu.x - ball.radius;
    const curved = forecastArrival(ball, faceX)!;
    const straight = predictArrival(faceX, ball.x, ball.y, ball.vx, ball.vy, ball.radius);
    expect(Math.abs(curved.y - straight.y)).toBeGreaterThan(60);

    const ai = new AiController(() => 0.9);
    ai.readShot(cpu, skill(), undefined, ball);
    ai.update(cpu, ball, skill({ speed: 1e5 }), 1, playerPaddle());
    expect(cpu.targetY).toBeCloseTo(curved.y, 0);
  });

  /** A ball curving hard up, and where it really arrives at the CPU's face, and straight on. */
  const curving = () => {
    const cpu = cpuPaddle();
    const ball = ballAt(150, 300, 450, 0);
    ball.spin = -0.4;
    ball.spinDecay = 0.6;
    const faceX = cpu.x - ball.radius;
    const curved = forecastArrival(ball, faceX)!.y;
    const straight = predictArrival(faceX, ball.x, ball.y, ball.vx, ball.vy, ball.radius).y;
    return { cpu, ball, curved, straight };
  };

  /** Where a CPU with `curveRead` aims after watching a curving ball for `seconds`. */
  const aimAfter = (curveRead: number, seconds: number, sharpen = false) => {
    const { cpu, ball, curved, straight } = curving();
    const reader = skill({ curveRead, speed: 1e5 });
    const ai = new AiController(() => 0.9);
    ai.readShot(cpu, reader, undefined, ball);
    if (sharpen) ai.sharpen();
    for (let t = 0; t < seconds - 1e-9; t += 0.01)
      ai.update(cpu, ball, reader, 0.01, playerPaddle());
    // 0 aims where it would fly straight on, 1 where the curve takes it
    return (cpu.targetY - straight) / (curved - straight);
  };

  it('expects a curve to fly on straight at first, and sees it as it watches', () => {
    expect(aimAfter(0.4, 0.01)).toBeLessThan(0.1);
    expect(aimAfter(0.4, 0.2)).toBeGreaterThan(0.3);
    expect(aimAfter(0.4, 0.2)).toBeLessThan(0.7);
    // A ball faster than the serve takes longer to see through: 0.4 s at 340 px/s is ~0.53 s here
    expect(aimAfter(0.4, 0.6)).toBeCloseTo(1, 1);
  });

  it('sees a curve sooner the better it plays, and at once with its Analyzer', () => {
    const at = (level: DifficultyLevel) => aimAfter(DIFFICULTY_CONFIGS[level].curveRead, 0.15);
    expect(at(DifficultyLevel.INSANE)).toBeGreaterThan(at(DifficultyLevel.HARD));
    expect(at(DifficultyLevel.HARD)).toBeGreaterThan(at(DifficultyLevel.NORMAL));
    expect(at(DifficultyLevel.NORMAL)).toBeGreaterThan(at(DifficultyLevel.EASY));
    expect(aimAfter(0.6, 0.01, true)).toBeCloseTo(1, 1);
  });

  it('reads each ball’s shot on its own: a second ball does not upset the first', () => {
    const cpu = cpuPaddle();
    cpu.targetY = 100;
    const first = ballAt(300, 400, 400, 0);
    const second = ballAt(300, 150, 400, 0);
    const slow = skill({ reaction: 0.2, speed: 1e5 });
    const ai = new AiController(() => 0.9);

    ai.readShot(cpu, slow, undefined, first);
    ai.update(cpu, first, slow, 0.15, playerPaddle());
    ai.readShot(cpu, slow, undefined, second);
    // The first ball's reaction carries on where it was: over by the next frame, not 0.2 s later
    ai.update(cpu, first, slow, 0.1, playerPaddle());
    ai.update(cpu, first, slow, 0.01, playerPaddle());
    expect(cpu.targetY).toBeCloseTo(400, 0);
  });

  it('sees through a shot its Analyzer read', () => {
    const cpu = cpuPaddle();
    const ball = ballAt(400, 250, 1e6, 0);
    const sloppy = skill({ error: 80, speed: 1e5 });
    const controller = new AiPaddleController(
      () => 1,
      () => DifficultyLevel.NORMAL,
    );
    const ai = (controller as unknown as { ai: AiController }).ai;
    ai.readShot(cpu, sloppy, undefined, ball);
    controller.onSkillUse(cpu, {
      skill: 'analyzer',
      paddleIndex: 1,
      x: ball.x,
      y: ball.y,
      strength: 1,
    });

    ai.update(cpu, ball, sloppy, 1, playerPaddle());
    expect(cpu.targetY).toBeCloseTo(250, 0);
  });
});

describe('The AI hits perfect on purpose', () => {
  /** A CPU that always goes for it, returning a flat ball at `speed`; the hit, and the paddle. */
  const swingAt = (speed: number, ballY: number, opponentY: number) => {
    const player = playerPaddle();
    player.y = opponentY;
    const cpu = cpuPaddle();
    const ball = ballAt(300, ballY, speed, 0);
    const aimer = skill({ perfectAim: 1 });
    const ai = new AiController(() => 0.5);
    ai.readShot(cpu, aimer, undefined, ball);
    const config = DIFFICULTY_CONFIGS[DifficultyLevel.HARD];
    for (let t = 0; t < 3; t += STEP) {
      ai.update(cpu, ball, aimer, STEP, player);
      cpu.update(STEP);
      const events = Physics.step(ball, [player, cpu], config, STEP);
      const hit = events.find((event) => event.type === 'paddleHit');
      if (hit) return { hit, cpu, ball };
    }
    return null;
  };

  it('meets a comfortable ball dead center, swinging it away from the opponent', () => {
    for (const [ballY, opponentY] of [
      [200, 100],
      [300, 400],
      [250, 120],
    ]) {
      const result = swingAt(450, ballY, opponentY)!;
      expect(result.hit).toMatchObject({ isPerfect: true });
      // Opponent high: it swings down, and the ball goes off down
      const away = opponentY < COURT.HEIGHT / 2 ? 1 : -1;
      expect(Math.sign(result.cpu.velocity)).toBe(away);
      expect(Math.sign(result.ball.vy)).toBe(away);
      expect(Math.abs(result.cpu.velocity)).toBeGreaterThan(250);
    }
  });

  it('with Arc, swings its angled returns toward the opponent, off center, for the curve', () => {
    for (const opponentY of [100, 400]) {
      const player = playerPaddle();
      player.y = opponentY;
      const cpu = cpuPaddle();
      const ball = ballAt(300, 250, 450, 0);
      const curver = skill({ angleShots: 1 });
      const ai = new AiController(() => 0.5);
      ai.usesArc = true;
      ai.readShot(cpu, curver, undefined, ball);
      const config = DIFFICULTY_CONFIGS[DifficultyLevel.HARD];
      let hit = null;
      for (let t = 0; t < 3 && !hit; t += STEP) {
        ai.update(cpu, ball, curver, STEP, player);
        cpu.update(STEP);
        hit = Physics.step(ball, [player, cpu], config, STEP).find((e) => e.type === 'paddleHit');
      }
      const toward = opponentY < COURT.HEIGHT / 2 ? -1 : 1;
      expect(hit).toMatchObject({ isPerfect: false });
      expect(Math.sign(cpu.velocity)).toBe(toward);
      // Fast enough for Arc to spin it (ARC.THRESHOLD)
      expect(Math.abs(cpu.velocity)).toBeGreaterThan(250);
      expect(Math.sign(ball.vy)).toBe(toward);
    }
  });

  it('just gets a ball back that is too fast to swing at', () => {
    const result = swingAt(900, 250, 100)!;
    expect(result).not.toBeNull();
    expect(Math.abs(result.cpu.velocity)).toBeLessThan(100);
  });
});

describe('The CPU’s Overdrive', () => {
  const flowAt = (level: DifficultyLevel) => {
    const paddles = [playerPaddle(), cpuPaddle()];
    const flow = new MatchFlow({
      paddles,
      ball: new Ball(),
      input: { pollPlayerMovement: () => {} },
      getDifficulty: () => level,
      onEvent: () => {},
      random: () => 0.3,
    });
    return flow;
  };

  it('charges in a quick match at the levels that use it, its meter shown', () => {
    for (const [level, shown] of [
      [DifficultyLevel.EASY, false],
      [DifficultyLevel.NORMAL, false],
      [DifficultyLevel.HARD, true],
      [DifficultyLevel.INSANE, true],
    ] as const) {
      const flow = flowAt(level);
      flow.startMatch(quickMatchRules(5));
      expect(flow.overdriveCharges[1] !== null).toBe(shown);
      expect(flow.overdriveCharges[0]).toBe(0);
    }
  });

  it('stays off in a challenge and in the demo', () => {
    const flow = flowAt(DifficultyLevel.INSANE);
    flow.startMatch(STANDARD_RULES);
    expect(flow.overdriveCharges[1]).toBeNull();
    flow.startAttract();
    expect(flow.overdriveCharges).toEqual([null, null]);
  });

  it('takes a CPU’s top speed from its level, a person’s from the keyboard', () => {
    const cpu = cpuPaddle();
    const controller = new AiPaddleController(
      () => 0.3,
      () => DifficultyLevel.HARD,
    );
    controller.onServe(cpu, [0, 0], quickMatchRules(5));
    expect(controller.topSpeed(cpu)).toBe(DIFFICULTY_CONFIGS[DifficultyLevel.HARD].speed);
  });
});
