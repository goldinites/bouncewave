import { describe, expect, it } from 'vitest';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { DifficultyLevel } from '@/match/difficulty';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';
import { HumanController } from '@/match/PaddleController';
import { TrainerController, TUTORIAL, TUTORIAL_RULES, TutorialCoach } from '@/match/tutorial';
import { EventBus } from '@/shared/EventBus';
import { I18nManager } from '@/i18n/I18nManager';
import { describeTutorial } from '@/ui/tutorialTexts';
import { seeded } from './helpers/simulation';

const setup = () => {
  const paddle = new Paddle(0, PADDLE.OFFSET_X, '#19f0ff');
  const events = new EventBus<MatchEvent>();
  // The learner's Overdrive meter, as the match keeps it
  const meter = { streak: 0 };
  const coach = new TutorialCoach({
    player: () => ({ paddle, index: 0, side: 0 }),
    overdriveStreak: () => meter.streak,
  });
  coach.listenTo(events);
  const hit = (more: Partial<Extract<MatchEvent, { type: 'paddleHit' }>> = {}) =>
    events.emit({
      type: 'paddleHit',
      paddleIndex: 0,
      isPerfect: false,
      x: 0,
      y: 0,
      speed: 400,
      angle: 0,
      rally: 1,
      isPowerShot: false,
      chargedOverdrive: false,
      ...more,
    });
  const miss = () => events.emit({ type: 'score', scoringPlayerIndex: 1, y: 0, isDemo: false });
  /** Lets the pause between two steps (or a try's verdict) run out. */
  const wait = () => coach.update(Math.max(TUTORIAL.BETWEEN, TUTORIAL.FEEDBACK));
  const move = (distance: number) => {
    coach.update(0);
    paddle.y += distance;
    coach.update(0);
  };
  return { paddle, coach, meter, hit, miss, wait, move };
};

const line = (coach: TutorialCoach, isTouch = false) =>
  describeTutorial(new I18nManager('en'), coach, isTouch)?.text;

describe('the tutorial', () => {
  it('starts with moving, no card, and opens the moves that need one on a card', () => {
    const { coach, move, hit, wait } = setup();
    expect(coach.card).toBeNull();
    hit(); // a return is no move
    move(100);
    move(-100);
    expect(coach.progress?.done).toBeCloseTo(200 / TUTORIAL.MOVE_DISTANCE);
    move(TUTORIAL.MOVE_DISTANCE);
    // A step done is seen, not praised: the next one is told at once
    expect(coach.isBetweenSteps).toBe(true);
    expect(line(coach)).toBe('RETURN THE BALL · 0 / 2');
    expect(coach.progress?.step).toBe('hit');
    wait();
    expect(coach.card).toBeNull();
    hit();
    hit();
    wait();

    // The edge: it waits for its card to be read
    expect(coach.card).toBe('angle');
    expect(line(coach)).toBeUndefined();
    hit({ angle: 1 });
    expect(coach.progress?.done).toBe(0);
    coach.acknowledge();
    expect(coach.card).toBeNull();
    hit({ angle: 1 });
    expect(coach.progress?.done).toBe(1);
  });

  it('tells moving as the device moves the paddle', () => {
    const { coach } = setup();
    expect(line(coach)).toBe('MOVE: W/S, ↑/↓ OR THE MOUSE');
    expect(line(coach, true)).toBe('MOVE: SLIDE A FINGER');
  });

  it('waits a moment before the next card, and a resume with none due reads none', () => {
    const { coach, hit, wait } = setup();
    coach.reset('hit');
    hit();
    hit();
    expect(coach.progress?.step).toBe('angle');
    expect(coach.card).toBeNull(); // the moment between steps first
    coach.acknowledge(); // a pause left in that moment
    wait();
    expect(coach.card).toBe('angle');
  });

  it("says why a try didn't count, and nothing when it did, the count always in sight", () => {
    const { coach, hit, wait } = setup();
    coach.reset('hit');
    expect(line(coach)).toBe('RETURN THE BALL · 0 / 2');
    hit();
    expect(line(coach)).toBe('RETURN THE BALL · 1 / 2');
    hit();
    wait();

    // The edge: a steep return, not a flat one
    coach.acknowledge();
    hit({ angle: TUTORIAL.STEEP_ANGLE / 2 });
    expect(line(coach)).toBe('TOO FLAT · 0 / 2');
    hit({ angle: TUTORIAL.STEEP_ANGLE });
    hit({ angle: 1 });
    wait();

    coach.acknowledge();
    hit();
    expect(line(coach)).toBe('OFF CENTER · 0 / 2');
    hit({ isPerfect: true });
    hit({ isPerfect: true });
    expect(coach.progress?.step).toBe('overdrive');
  });

  it('keeps a try’s verdict up long enough to read', () => {
    const { coach, hit } = setup();
    coach.reset('perfect');
    coach.acknowledge();
    hit();
    coach.update(TUTORIAL.FEEDBACK - 0.1);
    expect(coach.feedback).toBe('offCenter');
    coach.update(0.2);
    expect(coach.feedback).toBeNull();
  });

  it('teaches Overdrive by its meter: charged by perfect hits in a row, fired by the next', () => {
    const { coach, meter, hit, wait } = setup();
    coach.reset('overdrive');
    expect(coach.card).toBe('overdrive');
    coach.acknowledge();
    expect(line(coach)).toBe('PERFECT HITS IN A ROW · 0 / 3');

    meter.streak = 1;
    hit({ isPerfect: true });
    expect(line(coach)).toBe('PERFECT HITS IN A ROW · 1 / 3');
    // A plain hit empties the meter: it says so
    meter.streak = 0;
    hit();
    expect(line(coach)).toBe('OFF CENTER: METER EMPTIED · 0 / 3');
    wait();

    meter.streak = 3;
    hit({ isPerfect: true, chargedOverdrive: true });
    expect(coach.progress).toMatchObject({ isCharged: true, done: 3 });
    expect(line(coach)).toBe('CHARGED: THE NEXT HIT IS A POWER SHOT');
    meter.streak = 0;
    hit({ isPowerShot: true });
    expect(coach.progress).toBeNull();
    expect(coach.isFinished).toBe(false);
    wait();
    expect(coach.isFinished).toBe(true);
  });

  it('shows a step’s hint after a few tries without it, still counting, and forgets them next', () => {
    const { coach, hit, miss, wait } = setup();
    coach.reset('perfect');
    coach.acknowledge();
    for (let i = 0; i < TUTORIAL.HINT_AFTER - 1; i++) hit();
    expect(coach.progress?.isHinted).toBe(false);
    miss();
    expect(line(coach)).toBe('MISSED · 0 / 2');
    wait();
    expect(coach.progress?.isHinted).toBe(true);
    expect(line(coach)).toBe('TAKE IT ON THE LIT MIDDLE · 0 / 2');
    hit({ isPerfect: true });
    hit({ isPerfect: true });
    wait();
    expect(coach.progress).toMatchObject({ step: 'overdrive', isHinted: false });
  });

  it('ignores the trainer’s returns and the points it loses', () => {
    const { coach, hit } = setup();
    coach.reset('hit');
    hit({ paddleIndex: 1 });
    expect(coach.progress?.done).toBe(0);
    expect(coach.feedback).toBeNull();
  });

  it('starts over when reset, or at the step asked', () => {
    const { coach, move } = setup();
    move(TUTORIAL.MOVE_DISTANCE);
    coach.reset();
    expect(coach.progress).toMatchObject({ step: 'move', done: 0 });
    expect(coach.isBetweenSteps).toBe(false);
    coach.reset('overdrive');
    expect(coach.progress?.step).toBe('overdrive');
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
