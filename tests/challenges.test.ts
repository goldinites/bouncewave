import { describe, expect, it } from 'vitest';
import { getTargetIntensity, INITIAL_MUSIC_STATE } from '@/audio/music/intensity';
import { TRANSLATIONS } from '@/i18n/translations';
import { Ball } from '@/match/Ball';
import { BALL, COURT, PADDLE } from '@/match/config';
import { CHALLENGE_IDS, CHALLENGES } from '@/match/challenges';
import { DifficultyLevel } from '@/match/difficulty';
import { FINALE, MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';
import { AiPaddleController } from '@/match/PaddleController';
import { STANDARD_PADDLE } from '@/match/PaddleSpec';
import { isDecidingPoint, MatchRules, STANDARD_RULES } from '@/match/rules';

const SURVIVAL: MatchRules = { ...STANDARD_RULES, winningScores: [15, 3] };
const ONE_MINUTE: MatchRules = { ...STANDARD_RULES, timeLimit: 60 };

/** A seeded stand-in for Math.random, so a match plays the same every run. */
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const setup = () => {
  const paddles: [Paddle, Paddle] = [
    new Paddle(0, PADDLE.OFFSET_X, '#19f0ff'),
    new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6'),
  ];
  const ball = new Ball();
  const events: MatchEvent[] = [];
  const random = seeded(7);
  const flow = new MatchFlow({
    paddles,
    ball,
    input: { pollPlayerMovement: () => {} },
    getDifficulty: () => DifficultyLevel.EASY,
    onEvent: (event) => events.push(event),
    random,
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

  const finale = () => events.find((e) => e.type === 'finaleStart');

  return { flow, paddles, events, random, scoreFor, finale };
};

describe('the finale', () => {
  it('runs as long as the player’s win or loss, wherever the player stands', () => {
    // Seconds of finale until the match is over, the left side winning 1–0
    const finaleLength = (playerOnRight: boolean) => {
      const { flow, events, scoreFor } = setup();
      const [human, cpu] = flow.playerVsCpu();
      flow.startMatch(
        { ...STANDARD_RULES, winningScores: [1, 1] },
        playerOnRight ? [cpu, human] : [human, cpu],
      );
      scoreFor(0);
      let elapsed = 0;
      while (!events.some((e) => e.type === 'gameOver')) {
        flow.update(0.05);
        elapsed += 0.05;
      }
      return elapsed;
    };

    expect(finaleLength(false)).toBeCloseTo(FINALE.WIN_DURATION, 1);
    expect(finaleLength(true)).toBeCloseTo(FINALE.LOSS_DURATION, 1);
  });
});

describe('each side’s own winning score', () => {
  it('ends the match when either side reaches its own', () => {
    const { flow, scoreFor, finale } = setup();
    flow.startMatch(SURVIVAL);
    for (let i = 0; i < 3; i++) scoreFor(1);

    expect(flow.phase).toBe('finale');
    expect(finale()).toMatchObject({ winnerIndex: 1, scores: [0, 3] });
  });

  it('lets the other side play on to its own', () => {
    const { flow, scoreFor, finale } = setup();
    flow.startMatch(SURVIVAL);
    for (let i = 0; i < 14; i++) scoreFor(0);
    scoreFor(1);
    scoreFor(1);
    expect(finale()).toBeUndefined();

    scoreFor(0);
    expect(finale()).toMatchObject({ winnerIndex: 0, scores: [15, 2] });
  });

  it('reads the deciding point side by side', () => {
    expect(isDecidingPoint([14, 2], SURVIVAL)).toBe(true);
    expect(isDecidingPoint([2, 14], SURVIVAL)).toBe(false);
    expect(isDecidingPoint([2, 2], SURVIVAL)).toBe(false);
  });

  it('lifts the music late in the match by each side’s own score', () => {
    const intensity = (scores: [number, number]) =>
      getTargetIntensity(
        { ...INITIAL_MUSIC_STATE, gameState: 'play', scores, winningScores: [15, 3] },
        0,
      );

    expect(intensity([1, 1])).toBeCloseTo(intensity([0, 0]));
    // Two of the CPU's three, or nine of the player's fifteen
    expect(intensity([0, 2])).toBeGreaterThan(intensity([0, 0]));
    expect(intensity([9, 0])).toBeGreaterThan(intensity([0, 0]));
  });
});

describe('the match clock', () => {
  it('is only there when the rules have one', () => {
    const { flow } = setup();
    expect(flow.timeLeft).toBeNull();
    flow.startMatch();
    expect(flow.timeLeft).toBeNull();
    flow.startMatch(ONE_MINUTE);
    expect(flow.timeLeft).toBe(60);
  });

  it('runs through serves and rallies, but not while paused', () => {
    const { flow } = setup();
    flow.startMatch(ONE_MINUTE);
    flow.update(1);
    expect(flow.timeLeft).toBeCloseTo(59);

    flow.pause();
    flow.update(1);
    expect(flow.timeLeft).toBeCloseTo(59);
    flow.resume();
    flow.update(0.5);
    expect(flow.timeLeft).toBeCloseTo(58.5);
  });

  it('ends the match at once when it runs out, won by the side ahead', () => {
    const { flow, scoreFor, finale } = setup();
    flow.startMatch({ ...ONE_MINUTE, timeLimit: 10 });
    scoreFor(1);
    scoreFor(0);
    scoreFor(0);
    while (flow.phase !== 'finale') flow.update(0.1);

    expect(flow.timeLeft).toBe(0);
    expect(finale()).toMatchObject({ winnerIndex: 0, scores: [2, 1], reason: 'time' });
  });

  it('is the player’s loss whatever the score when the rules say so (Blitz)', () => {
    const { flow, scoreFor, finale } = setup();
    flow.startMatch({ ...ONE_MINUTE, timeLimit: 10, timeUp: 'opponent' });
    for (let i = 0; i < 3; i++) scoreFor(0);
    while (flow.phase !== 'finale') flow.update(0.1);

    // Well ahead when the clock runs out, and the match is still the opponent's
    const { winnerIndex, scores } = finale() as { winnerIndex: number; scores: number[] };
    expect(winnerIndex).toBe(1);
    expect(scores[0]).toBeGreaterThan(scores[1]);
    expect(CHALLENGES.blitz.rules).toMatchObject({ timeLimit: 120, timeUp: 'opponent' });
  });

  it('makes a level score the player’s loss', () => {
    const { flow, scoreFor, finale } = setup();
    flow.startMatch({ ...ONE_MINUTE, timeLimit: 10 });
    scoreFor(0);
    scoreFor(1);
    while (flow.phase !== 'finale') flow.update(0.1);

    expect(finale()).toMatchObject({ winnerIndex: 1, scores: [1, 1] });
  });

  it('is gone in the demo', () => {
    const { flow } = setup();
    flow.startMatch(ONE_MINUTE);
    flow.returnToMenu();
    expect(flow.timeLeft).toBeNull();
  });
});

describe('a match’s own difficulty and paddles', () => {
  it('plays at the level it was started at, else at the chosen one', () => {
    const { flow } = setup();
    expect(flow.difficulty).toBe(DifficultyLevel.EASY);
    flow.startMatch(STANDARD_RULES, flow.playerVsCpu(), DifficultyLevel.INSANE);
    expect(flow.difficulty).toBe(DifficultyLevel.INSANE);

    // The CPU plays at it: Insane has no form to drift, so its skill is the level's own
    const cpu = flow.playerVsCpu()[1].controller as AiPaddleController;
    flow.startMatch(
      STANDARD_RULES,
      [flow.playerVsCpu()[0], { controller: cpu, overdrive: false }],
      DifficultyLevel.INSANE,
    );
    expect(cpu.skill.speed).toBe(720);

    flow.returnToMenu();
    flow.startMatch();
    expect(flow.difficulty).toBe(DifficultyLevel.EASY);
  });

  it('gives each paddle the one its player brings, and the standard one back in the demo', () => {
    const { flow, paddles } = setup();
    const long = { ...STANDARD_PADDLE, height: 138, width: 20 };
    const rightEdge = paddles[1].x + paddles[1].spec.width;

    flow.startMatch(STANDARD_RULES, flow.playerVsCpu([STANDARD_PADDLE, long]));
    expect(paddles[0].spec).toBe(STANDARD_PADDLE);
    expect(paddles[1].spec).toBe(long);
    // A wider right paddle grows toward the middle
    expect(paddles[1].x + paddles[1].spec.width).toBe(rightEdge);

    flow.returnToMenu();
    expect(paddles[1].spec).toBe(STANDARD_PADDLE);
    expect(paddles[1].x + paddles[1].spec.width).toBe(rightEdge);
  });

  it('keeps a longer paddle clear of the walls', () => {
    const paddle = new Paddle(1, 700, '#fff');
    paddle.setTargetY(COURT.HEIGHT);
    paddle.useSpec({ ...STANDARD_PADDLE, height: 200 });

    expect(paddle.targetY).toBe(COURT.HEIGHT - PADDLE.BOTTOM_MARGIN - 100);
  });
});

describe('the challenges', () => {
  it('are nine, the first nine of docs/CHALLENGES.md, easiest first', () => {
    expect(CHALLENGE_IDS).toEqual([
      'warmUp',
      'longRally',
      'twoBalls',
      'blitz',
      'shutout',
      'giant',
      'survival',
      'overload',
      'insanity',
    ]);
    expect(CHALLENGES.survival.rules.winningScores).toEqual([10, 3]);
    expect(CHALLENGES.blitz.rules.winningScores).toEqual([3, 3]);
    expect(CHALLENGES.giant.paddles[1].height).toBe(PADDLE.HEIGHT * 1.5);
    expect(CHALLENGES.longRally.rules.timeLimit).toBe(60);
  });

  it('are all lost when their clock runs out, whatever the score', () => {
    // A clock is a limit to pass the challenge within: running out is never a win to celebrate
    for (const id of CHALLENGE_IDS) {
      const { rules } = CHALLENGES[id];
      if (rules.timeLimit !== null) expect(rules.timeUp, id).toBe('opponent');
    }
  });

  it('each have a name and a goal in every language', () => {
    for (const translation of Object.values(TRANSLATIONS)) {
      for (const id of CHALLENGE_IDS) {
        const [name, goal] = translation.challenges[id];
        expect(name).not.toBe('');
        expect(goal).not.toBe('');
      }
    }
  });

  it('each play out to the end, the CPU on both sides', () => {
    for (const id of CHALLENGE_IDS) {
      const { flow, events, random } = setup();
      const { rules, paddles, difficulty } = CHALLENGES[id];
      const lineup = flow.playerVsCpu(paddles).map((participant) => ({
        ...participant,
        controller: new AiPaddleController(random, () => difficulty),
      }));
      flow.startMatch(rules, lineup, difficulty);

      // Ten minutes of play at most: every challenge ends long before
      for (let step = 0; step < 240 * 600 && flow.phase !== 'attract'; step++) {
        flow.update(1 / 240);
      }
      expect(
        events.some((e) => e.type === 'gameOver'),
        id,
      ).toBe(true);
    }
  });
});
