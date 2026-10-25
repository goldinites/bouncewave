import { describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '@/audio/AudioEngine';
import { EffectsDirector } from '@/fx/EffectsDirector';
import { ParticleSystem } from '@/fx/ParticleSystem';
import { Ball } from '@/match/Ball';
import { BALL, COURT, PADDLE } from '@/match/config';
import { DifficultyLevel } from '@/match/difficulty';
import { FINALE, MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';
import { PaddleController } from '@/match/PaddleController';
import { MatchRules, STANDARD_RULES } from '@/match/rules';
import { Renderer } from '@/render/Renderer';

const TWO_BALLS: MatchRules = { ...STANDARD_RULES, balls: 2 };

const setup = () => {
  const paddles = [
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
  return { flow, paddles, ball, events, finishServe };
};

/** A controller that only records the ball it is asked to play. */
const steering = () => ({
  steer: vi.fn<PaddleController['steer']>(),
  onServe: vi.fn(),
  onIncomingShot: vi.fn(),
  onPoint: vi.fn(),
  reset: vi.fn(),
  topSpeed: () => 500,
});

/** Places a ball at `x` flying at `vx`, level with the middle of the court. */
const place = (ball: Ball, x: number, vx: number) => {
  ball.x = x;
  ball.y = COURT.HEIGHT / 2;
  ball.vx = vx;
  ball.vy = 0;
};

describe('the balls on court', () => {
  it('plays a standard match, and the demo, with the one ball it was given', () => {
    const { flow, ball } = setup();

    flow.startAttract();
    expect(flow.balls).toEqual([ball]);
    flow.startMatch();
    expect(flow.balls).toEqual([ball]);
  });

  it('puts as many balls on court as the rules ask, served one each way', () => {
    const { flow, ball } = setup();
    flow.startMatch(TWO_BALLS);

    expect(flow.balls).toHaveLength(2);
    expect(flow.balls[0]).toBe(ball);
    const [first, second] = flow.balls;
    expect(Math.sign(first.vx)).toBe(-Math.sign(second.vx));
    expect([second.x, second.y]).toEqual([COURT.WIDTH / 2, COURT.HEIGHT / 2]);
  });

  it('goes back to the one ball for the demo, after a match or from its pause', () => {
    const { flow, finishServe } = setup();

    flow.startMatch(TWO_BALLS);
    finishServe();
    flow.returnToMenu();
    expect(flow.balls).toHaveLength(1);

    flow.startMatch({ ...TWO_BALLS, winningScores: [1, 1] });
    finishServe();
    place(flow.balls[0], -BALL.OUT_OF_BOUNDS_OFFSET - 1, -10);
    flow.update(0.001);
    flow.update(FINALE.LOSS_DURATION + 0.1);
    expect(flow.phase).toBe('attract');
    expect(flow.balls).toHaveLength(1);
  });

  it('ends the point with the first ball out, and serves every ball again', () => {
    const { flow, events, finishServe } = setup();
    flow.startMatch(TWO_BALLS);
    finishServe();
    const [first, second] = flow.balls;
    place(first, COURT.WIDTH / 2, 300);
    place(second, -BALL.OUT_OF_BOUNDS_OFFSET - 1, -10);
    events.length = 0;

    flow.update(0.001);

    expect(flow.scores).toEqual([0, 1]);
    expect(events.filter((e) => e.type === 'score')).toHaveLength(1);
    expect(flow.phase).toBe('serving');
    for (const ball of flow.balls) expect(ball.x).toBe(COURT.WIDTH / 2);
  });

  it('lets a paddle return the second ball like the first', () => {
    const { flow, paddles, events, finishServe } = setup();
    flow.startMatch(TWO_BALLS);
    finishServe();
    const [first, second] = flow.balls;
    const [left] = paddles;
    place(first, COURT.WIDTH / 2, 300);
    place(second, left.x + PADDLE.WIDTH + 2, -400);
    left.y = left.targetY = second.y;
    events.length = 0;

    flow.update(0.001);

    expect(second.vx).toBeGreaterThan(0);
    expect(first.vx).toBe(300);
    expect(events.find((e) => e.type === 'paddleHit')).toMatchObject({ paddleIndex: 0, rally: 1 });
  });

  it('has each paddle play the ball that reaches it first, or the nearest when none is coming', () => {
    const { flow, finishServe } = setup();
    const controllers = [steering(), steering()];
    flow.startMatch(
      TWO_BALLS,
      controllers.map((controller) => ({ controller, overdrive: false })),
    );
    finishServe();
    const [slowFar, fastNear] = flow.balls;
    // Both fly right: the near, fast one arrives first; nothing flies left
    place(slowFar, 200, 100);
    place(fastNear, 500, 600);
    controllers.forEach((c) => c.steer.mockClear());

    flow.update(0.001);

    expect(controllers[1].steer.mock.calls[0][1]).toBe(fastNear);
    expect(controllers[0].steer.mock.calls[0][1]).toBe(slowFar);
  });

  it('follows the ball nearest to deciding the point', () => {
    const { flow, finishServe } = setup();
    flow.startMatch(TWO_BALLS);
    finishServe();
    const [first, second] = flow.balls;
    place(first, 300, -100); // 3 s from the left goal line
    place(second, 600, 400); // half a second from the right one

    expect(flow.leadBall).toBe(second);
  });

  it('sheds embers from every burning ball', () => {
    const particles = new ParticleSystem();
    const effects = new EffectsDirector({
      renderer: { addFlash: vi.fn(), addShake: vi.fn() } as unknown as Renderer,
      audio: { sfx: { setBallAir: vi.fn(), setSkateGlide: vi.fn() } } as unknown as AudioEngine,
      particles,
      paddles: setup().paddles,
      translate: () => '',
    });
    const left = new Ball();
    const right = new Ball();
    place(left, 100, -400);
    place(right, 700, 400);
    left.isPowerShot = right.isPowerShot = true;

    const flow = {
      phase: 'rally',
      rally: 0,
      isBallLive: true,
      balls: [left, right],
      overdriveCharges: [null, null],
      implantCores: [false, false],
      serveTime: 0,
      timeLeft: null,
      activeModifiers: [],
    };
    effects.afterSimulation(0.1, flow as unknown as MatchFlow);

    const near = (ball: Ball) =>
      particles.particles.some((p) => Math.abs(p.x - ball.x) < 40 && Math.abs(p.y - ball.y) < 40);
    expect(near(left)).toBe(true);
    expect(near(right)).toBe(true);
  });
});
