import { describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '@/audio/AudioEngine';
import { EffectsDirector } from '@/fx/EffectsDirector';
import { MatchPointDrama } from '@/fx/MatchPointDrama';
import { ParticleSystem } from '@/fx/ParticleSystem';
import { Ball } from '@/match/Ball';
import { BALL, COURT, PADDLE } from '@/match/config';
import { DIFFICULTY_CONFIGS, DifficultyLevel } from '@/match/difficulty';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';
import { PaddleController } from '@/match/PaddleController';
import { Physics } from '@/match/Physics';
import { STANDARD_RULES } from '@/match/rules';
import { Renderer } from '@/render/Renderer';

const RIGHT_X = COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH;

/** One paddle on the left, two on the right: one high, one low. */
const oneVersusTwo = (): Paddle[] => {
  const left = new Paddle(0, PADDLE.OFFSET_X, '#19f0ff');
  const high = new Paddle(1, RIGHT_X, '#ff2bd6');
  const low = new Paddle(1, RIGHT_X - 120, '#ffe53b');
  high.y = high.targetY = 120;
  low.y = low.targetY = 380;
  return [left, high, low];
};

/** A controller that only records what the match told it. */
const spyController = () => ({
  steer: vi.fn<PaddleController['steer']>(),
  onServe: vi.fn<PaddleController['onServe']>(),
  onIncomingShot: vi.fn<PaddleController['onIncomingShot']>(),
  onPoint: vi.fn<PaddleController['onPoint']>(),
  reset: vi.fn<PaddleController['reset']>(),
});

const setup = (paddles: Paddle[]) => {
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
  return { flow, ball, events, finishServe };
};

describe('a side with more than one paddle', () => {
  it('lets whichever paddle the ball meets hit it, back toward the other side', () => {
    const paddles = oneVersusTwo();
    const ball = new Ball();
    const low = paddles[2];
    ball.x = low.x - 2;
    ball.y = low.y;
    ball.vx = 400;
    ball.vy = 0;

    const events = Physics.step(ball, paddles, DIFFICULTY_CONFIGS[DifficultyLevel.NORMAL], 0.001);

    expect(events).toEqual([expect.objectContaining({ type: 'paddleHit', paddleIndex: 2 })]);
    expect(ball.vx).toBeLessThan(0);
  });

  it('needs a paddle on each side, and a participant for every paddle', () => {
    const lefts = [new Paddle(0, 34, '#fff'), new Paddle(0, 80, '#fff')];
    expect(() => setup(lefts)).toThrow();

    const { flow } = setup(oneVersusTwo());
    expect(() =>
      flow.startMatch(STANDARD_RULES, [{ controller: spyController(), overdrive: false }]),
    ).toThrow();
  });

  it('puts the player at the left and the CPU at every other paddle by default', () => {
    const paddles = oneVersusTwo();
    const { flow } = setup(paddles);
    const lineup = flow.playerVsCpu();

    expect(lineup.map((p) => p.overdrive)).toEqual([true, false, false]);
    expect(lineup[1].controller).not.toBe(lineup[2].controller);
  });

  it('steers every paddle, and warns the whole side a shot is coming its way', () => {
    const paddles = oneVersusTwo();
    const { flow, ball, finishServe } = setup(paddles);
    const controllers = paddles.map(() => spyController());
    flow.startMatch(
      STANDARD_RULES,
      controllers.map((controller) => ({ controller, overdrive: false })),
    );
    finishServe();
    controllers.forEach((c) => c.onIncomingShot.mockClear());

    // The left paddle returns the ball: both right paddles must read it, the left one not
    const [left] = paddles;
    left.y = left.targetY = ball.y;
    ball.x = left.x + PADDLE.WIDTH + 2;
    ball.vx = -400;
    ball.vy = 0;
    flow.update(0.001);

    controllers.forEach((c) => expect(c.steer).toHaveBeenCalled());
    expect(controllers[0].onIncomingShot).not.toHaveBeenCalled();
    expect(controllers[1].onIncomingShot).toHaveBeenCalledWith(paddles[1], expect.anything());
    expect(controllers[2].onIncomingShot).toHaveBeenCalledWith(paddles[2], expect.anything());
  });

  it('scores a point for the side, whichever of its paddles it was', () => {
    const { flow, ball, events, finishServe } = setup(oneVersusTwo());
    flow.startMatch();
    finishServe();

    ball.x = -BALL.OUT_OF_BOUNDS_OFFSET - 1;
    ball.vx = -10;
    flow.update(0.001);

    expect(flow.scores).toEqual([0, 1]);
    expect(events.at(-2)).toMatchObject({ type: 'score', scoringPlayerIndex: 1 });
  });

  it('only counts the deciding ball as past once it is behind the side’s last paddle', () => {
    const front = new Paddle(0, 140, '#fff');
    const back = new Paddle(0, PADDLE.OFFSET_X, '#fff');
    const paddles = [front, back, new Paddle(1, RIGHT_X, '#fff')];
    const ball = new Ball();
    ball.vx = -400;

    ball.x = front.x - ball.radius - 1;
    expect(MatchPointDrama.isBallPastPaddle(ball, paddles)).toBe(false);
    ball.x = back.x - ball.radius - 1;
    expect(MatchPointDrama.isBallPastPaddle(ball, paddles)).toBe(true);
  });

  it('lights the paddle that hit and plays the hit in its side’s voice', () => {
    const playPaddleHit = vi.fn();
    const audio = { sfx: { playPaddleHit, playOverdriveReady: vi.fn() } };
    const renderer = { addShake: vi.fn(), addFlash: vi.fn() };
    const effects = new EffectsDirector({
      renderer: renderer as unknown as Renderer,
      audio: audio as unknown as AudioEngine,
      particles: new ParticleSystem(),
      paddles: oneVersusTwo(),
      ball: new Ball(),
      translate: () => '',
    });

    effects.handle({
      type: 'paddleHit',
      paddleIndex: 2,
      isPerfect: false,
      x: RIGHT_X,
      y: 380,
      speed: BALL.INITIAL_SPEED,
      rally: 1,
      isPowerShot: false,
      chargedOverdrive: false,
    });

    expect(effects.paddleGlow).toEqual([0, 0, 1]);
    expect(playPaddleHit).toHaveBeenCalledWith(1, false, 1);
  });
});
