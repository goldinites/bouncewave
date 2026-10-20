import { describe, expect, it } from 'vitest';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { DifficultyLevel } from '@/match/difficulty';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';
import { HumanController } from '@/match/PaddleController';
import { TrainerController, TUTORIAL, TUTORIAL_RULES, TutorialCoach } from '@/match/tutorial';
import { EventBus } from '@/shared/EventBus';
import { seeded } from './helpers/simulation';

const setup = () => {
  const paddle = new Paddle(0, PADDLE.OFFSET_X, '#19f0ff');
  const events = new EventBus<MatchEvent>();
  const coach = new TutorialCoach({ player: () => ({ paddle, index: 0, side: 0 }) });
  coach.listenTo(events);
  const hit = (more: Partial<Extract<MatchEvent, { type: 'paddleHit' }>> = {}) =>
    events.emit({
      type: 'paddleHit',
      paddleIndex: 0,
      isPerfect: false,
      x: 0,
      y: 0,
      speed: 400,
      rally: 1,
      isPowerShot: false,
      chargedOverdrive: false,
      ...more,
    });
  const miss = () => events.emit({ type: 'score', scoringPlayerIndex: 1, y: 0, isDemo: false });
  /** Lets the praise between two steps run out. */
  const praise = () => coach.update(TUTORIAL.PRAISE);
  const move = (distance: number) => {
    coach.update(0);
    paddle.y += distance;
    coach.update(0);
  };
  return { paddle, coach, hit, miss, praise, move };
};

describe('the tutorial', () => {
  it('starts by moving the paddle, far enough either way', () => {
    const { coach, move, hit } = setup();
    expect(coach.progress?.step).toBe('move');
    hit(); // a return is no move
    move(100);
    move(-100);
    expect(coach.progress?.done).toBeCloseTo(200 / TUTORIAL.MOVE_DISTANCE);
    move(TUTORIAL.MOVE_DISTANCE);
    expect(coach.isPraising).toBe(true);
    expect(coach.progress?.step).toBe('hit');
  });

  it('counts only what each step asks for, and praises every step done', () => {
    const { coach, move, hit, praise, paddle } = setup();
    move(TUTORIAL.MOVE_DISTANCE);
    praise();

    // Two returns of any kind; nothing counts while the praise shows
    hit();
    expect(coach.progress).toMatchObject({ step: 'hit', done: 1, target: 2 });
    hit();
    expect(coach.progress?.step).toBe('perfect');
    hit({ isPerfect: true });
    expect(coach.progress?.done).toBe(0);
    praise();

    // Perfect hits only
    hit();
    hit({ isPerfect: true });
    hit({ isPerfect: true });
    praise();

    // A return struck on the move, fast enough to steer it
    paddle.velocity = TUTORIAL.STEER_SPEED / 2;
    hit();
    expect(coach.progress).toMatchObject({ step: 'steer', done: 0 });
    paddle.velocity = -TUTORIAL.STEER_SPEED;
    hit();
    hit();
    praise();

    // Overdrive: the perfect hits that charge it are no misses, the power shot passes it
    expect(coach.progress?.step).toBe('overdrive');
    hit({ isPerfect: true });
    hit({ isPerfect: true });
    hit({ isPerfect: true });
    expect(coach.progress?.isHinted).toBe(false);
    expect(coach.isFinished).toBe(false);
    hit({ isPowerShot: true });
    expect(coach.progress).toBeNull();
    expect(coach.isFinished).toBe(false);
    praise();
    expect(coach.isFinished).toBe(true);
  });

  it('shows a step’s hint after a few tries without it, and forgets them with the next', () => {
    const { coach, move, hit, miss, praise } = setup();
    move(TUTORIAL.MOVE_DISTANCE);
    praise();
    hit();
    hit();
    praise();
    for (let i = 0; i < TUTORIAL.HINT_AFTER - 1; i++) hit();
    expect(coach.progress?.isHinted).toBe(false);
    miss();
    expect(coach.progress?.isHinted).toBe(true);
    hit({ isPerfect: true });
    hit({ isPerfect: true });
    praise();
    expect(coach.progress).toMatchObject({ step: 'steer', isHinted: false });
  });

  it('ignores the trainer’s returns and the points it loses', () => {
    const { coach, move, hit, praise } = setup();
    move(TUTORIAL.MOVE_DISTANCE);
    praise();
    hit({ paddleIndex: 1 });
    expect(coach.progress?.done).toBe(0);
  });

  it('starts over when reset', () => {
    const { coach, move } = setup();
    move(TUTORIAL.MOVE_DISTANCE);
    coach.reset();
    expect(coach.progress).toMatchObject({ step: 'move', done: 0 });
    expect(coach.isPraising).toBe(false);
  });

  it('plays a match that points never end, with a slow ball and a trainer that returns it', () => {
    const paddles = [
      new Paddle(0, PADDLE.OFFSET_X, '#19f0ff'),
      new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6'),
    ];
    let hits = 0;
    const flow = new MatchFlow({
      paddles,
      ball: new Ball(),
      input: { pollPlayerMovement: () => {} },
      getDifficulty: () => DifficultyLevel.EASY,
      onEvent: (event) => {
        if (event.type === 'paddleHit' && event.paddleIndex === 1) hits++;
      },
      random: seeded(7),
    });
    // The learner never moves: the trainer still returns every ball that reaches it
    flow.startMatch(
      TUTORIAL_RULES,
      [
        { controller: new HumanController({ pollPlayerMovement: () => {} }), overdrive: true },
        { controller: new TrainerController(seeded(8)), overdrive: false },
      ],
      DifficultyLevel.EASY,
    );
    let fastest = 0;
    for (let t = 0; t < 120; t += 1 / 240) {
      flow.update(1 / 240);
      fastest = Math.max(fastest, flow.leadBall.speed);
    }
    expect(flow.phase).not.toBe('finale');
    expect(flow.scores[1]).toBeGreaterThan(3);
    expect(hits).toBeGreaterThan(5);
    // The trainer never misses
    expect(flow.scores[0]).toBe(0);
    expect(fastest).toBeLessThanOrEqual(TUTORIAL_RULES.pace!.maxSpeed);
  });
});
