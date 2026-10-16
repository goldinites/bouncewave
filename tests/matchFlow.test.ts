import { describe, expect, it } from 'vitest';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE, BALL, WINNING_SCORE } from '@/match/config';
import { DifficultyLevel } from '@/match/difficulty';
import { FINALE, MatchEvent, MatchFlow, SERVE_DELAY } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';

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
    random: () => 0.25, // player serves first (direction -1 → toward the player)
  });

  const types = () => events.map((e) => e.type);
  const clear = () => events.splice(0);

  /** Runs the clock until the serve countdown is over. */
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

  return { flow, paddles, ball, events, types, clear, finishServe, scoreFor };
};

describe('MatchFlow', () => {
  it('starts in the attract demo behind the menu', () => {
    const { flow, types } = setup();
    flow.startAttract();

    expect(flow.phase).toBe('attract');
    expect(flow.isDemo).toBe(true);
    expect(flow.gameState).toBe('menu');
    expect(types()).toEqual(['serve']);
  });

  it('starts a match: resets scores, serves, then puts the ball in play', () => {
    const { flow, paddles, types, finishServe } = setup();
    paddles[0].score = 4;

    flow.startMatch();
    expect(flow.isDemo).toBe(false);

    expect(types()).toEqual(['matchStart', 'serve']);
    expect(paddles[0].score).toBe(0);
    expect(flow.phase).toBe('serving');
    expect(flow.serveTime).toBeCloseTo(SERVE_DELAY.START);
    expect(flow.isBallLive).toBe(false);

    finishServe();
    expect(flow.phase).toBe('rally');
    expect(flow.isBallLive).toBe(true);
  });

  it('pauses only during a match and resumes to the same phase', () => {
    const { flow, finishServe } = setup();
    flow.startAttract();
    expect(flow.pause()).toBe(false);

    flow.startMatch();
    finishServe();
    expect(flow.pause()).toBe(true);
    expect(flow.gameState).toBe('paused');

    const time = flow.time;
    flow.update(1);
    expect(flow.time).toBe(time); // frozen

    expect(flow.resume()).toBe(true);
    expect(flow.phase).toBe('rally');
  });

  it('counts a point, then serves again', () => {
    const { flow, paddles, events, clear, scoreFor } = setup();
    flow.startMatch();
    clear();

    scoreFor(1);

    expect(paddles[1].score).toBe(1);
    expect(events[0]).toMatchObject({ type: 'score', scoringPlayerIndex: 1, isDemo: false });
    expect(events[1].type).toBe('serve');
    expect(flow.phase).toBe('serving');
    expect(flow.rally).toBe(0);
  });

  it('never changes the score in the demo', () => {
    const { flow, paddles, events, clear, scoreFor } = setup();
    flow.startAttract();
    clear();

    scoreFor(0);

    expect(paddles[0].score).toBe(0);
    expect(events[0]).toMatchObject({ type: 'score', isDemo: true });
    expect(flow.phase).toBe('attract');
  });

  it('counts paddle hits as the rally', () => {
    const { flow, ball, paddles, events, clear, finishServe } = setup();
    flow.startMatch();
    finishServe();
    clear();

    const [left] = paddles;
    left.y = left.targetY = ball.y;
    ball.x = left.x + PADDLE.WIDTH + 2;
    ball.vx = -400;
    ball.vy = 0;
    flow.update(0.001);

    expect(flow.rally).toBe(1);
    expect(events.find((e) => e.type === 'paddleHit')).toMatchObject({ paddleIndex: 0, rally: 1 });
  });

  it('runs the finale after the winning point, then returns to the demo', () => {
    const { flow, paddles, events, clear, scoreFor } = setup();
    flow.startMatch();
    paddles[0].score = WINNING_SCORE - 1;
    clear();

    scoreFor(0);

    expect(flow.phase).toBe('finale');
    expect(events.at(-1)).toMatchObject({
      type: 'finaleStart',
      winnerIndex: 0,
      scores: [WINNING_SCORE, 0],
    });
    expect(flow.pause()).toBe(false);
    expect(flow.gameState).toBe('play');

    clear();
    for (let t = 0; t < FINALE.WIN_DURATION + 0.1; t += 0.05) flow.update(0.05);

    expect(events[0]).toMatchObject({ type: 'gameOver', winnerIndex: 0 });
    expect(flow.phase).toBe('attract');
    expect(paddles[0].score).toBe(WINNING_SCORE); // kept for the game-over menu
  });

  it('lets the finale be skipped only after its key moment', () => {
    const { flow, paddles, types, clear, scoreFor } = setup();
    flow.startMatch();
    paddles[1].score = WINNING_SCORE - 1;
    scoreFor(1);
    clear();

    expect(flow.skipFinale()).toBe(false);

    flow.update(FINALE.SKIP_AFTER);
    expect(flow.skipFinale()).toBe(true);
    expect(types()).toEqual(['gameOver', 'serve']);
    expect(flow.phase).toBe('attract');
  });

  it('uses the shorter finale for a defeat', () => {
    const { flow, paddles, types, clear, scoreFor } = setup();
    flow.startMatch();
    paddles[1].score = WINNING_SCORE - 1;
    scoreFor(1);
    clear();

    flow.update(FINALE.LOSS_DURATION - 0.05);
    expect(flow.phase).toBe('finale');

    flow.update(0.1);
    expect(types()[0]).toBe('gameOver');
  });

  it('returns to the menu from a paused match', () => {
    const { flow, paddles, types, clear, finishServe } = setup();
    flow.startMatch();
    finishServe();
    paddles[0].score = 3;
    flow.pause();
    clear();

    flow.returnToMenu();

    expect(types()).toEqual(['returnToMenu', 'serve']);
    expect(flow.phase).toBe('attract');
    expect(paddles[0].score).toBe(0);
  });
});
