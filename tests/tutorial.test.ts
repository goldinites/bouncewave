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
      rally: 1,
      isPowerShot: false,
      chargedOverdrive: false,
      ...more,
    });
  const miss = () => events.emit({ type: 'score', scoringPlayerIndex: 1, y: 0, isDemo: false });
  /** Lets the praise between two steps (or a try's verdict) run out. */
  const wait = () => coach.update(TUTORIAL.PRAISE);
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
  it('starts by moving the paddle, far enough either way, told as the device moves it', () => {
    const { coach, move, hit } = setup();
    expect(coach.progress?.step).toBe('move');
    expect(line(coach)).toBe('MOVE: W/S, ↑/↓ OR THE MOUSE');
    expect(line(coach, true)).toBe('MOVE: SLIDE A FINGER');
    hit(); // a return is no move
    move(100);
    move(-100);
    expect(coach.progress?.done).toBeCloseTo(200 / TUTORIAL.MOVE_DISTANCE);
    move(TUTORIAL.MOVE_DISTANCE);
    expect(coach.isPraising).toBe(true);
    expect(line(coach)).toBe('NICE!');
    expect(coach.progress?.step).toBe('hit');
  });

  it('says after every try whether it counted, and why not, the count always in sight', () => {
    const { coach, move, hit, wait, paddle } = setup();
    move(TUTORIAL.MOVE_DISTANCE);
    wait();

    expect(line(coach)).toBe('RETURN THE BALL · 0 / 2');
    hit();
    expect(line(coach)).toBe('YES! · 1 / 2');
    wait();
    expect(line(coach)).toBe('RETURN THE BALL · 1 / 2');
    hit();
    expect(coach.progress?.step).toBe('perfect');
    hit({ isPerfect: true }); // nothing counts while the praise shows
    expect(coach.progress?.done).toBe(0);
    wait();

    hit();
    expect(line(coach)).toBe('OFF THE CENTER · 0 / 2');
    hit({ isPerfect: true });
    hit({ isPerfect: true });
    wait();

    // A return struck on the move, fast enough to steer it
    paddle.velocity = TUTORIAL.STEER_SPEED / 2;
    hit();
    expect(line(coach)).toBe('THE PADDLE STOOD STILL: MOVE · 0 / 2');
    paddle.velocity = -TUTORIAL.STEER_SPEED;
    hit();
    expect(coach.progress).toMatchObject({ step: 'steer', done: 1 });
    hit();
    expect(coach.progress?.step).toBe('overdrive');
  });

  it('teaches Overdrive by its meter: charged by perfect hits in a row, fired by the next', () => {
    const { coach, meter, hit, wait } = setup();
    coach.reset('overdrive');
    expect(line(coach)).toBe('CHARGE: YELLOW 3 TIMES IN A ROW · 0 / 3');

    meter.streak = 1;
    hit({ isPerfect: true });
    expect(line(coach)).toBe('YES! · 1 / 3');
    // A plain hit empties the meter: it says so
    meter.streak = 0;
    hit();
    expect(line(coach)).toBe('OFF CENTER: CHARGE LOST · 0 / 3');
    wait();

    meter.streak = 3;
    hit({ isPerfect: true, chargedOverdrive: true });
    expect(coach.progress).toMatchObject({ isCharged: true, done: 3 });
    expect(line(coach)).toBe('CHARGED! NEXT HIT IS OVERDRIVE');
    meter.streak = 0;
    hit({ isPowerShot: true });
    expect(coach.progress).toBeNull();
    expect(coach.isFinished).toBe(false);
    wait();
    expect(coach.isFinished).toBe(true);
  });

  it('shows a step’s hint after a few tries without it, still counting, and forgets them next', () => {
    const { coach, move, hit, miss, wait } = setup();
    move(TUTORIAL.MOVE_DISTANCE);
    wait();
    hit();
    hit();
    wait();
    for (let i = 0; i < TUTORIAL.HINT_AFTER - 1; i++) hit();
    expect(coach.progress?.isHinted).toBe(false);
    miss();
    expect(line(coach)).toBe('MISSED: AGAIN · 0 / 2');
    wait();
    expect(coach.progress?.isHinted).toBe(true);
    expect(line(coach)).toBe('THE BALL MUST TOUCH THE YELLOW · 0 / 2');
    hit({ isPerfect: true });
    hit({ isPerfect: true });
    wait();
    expect(coach.progress).toMatchObject({ step: 'steer', isHinted: false });
  });

  it('ignores the trainer’s returns and the points it loses', () => {
    const { coach, move, hit, wait } = setup();
    move(TUTORIAL.MOVE_DISTANCE);
    wait();
    hit({ paddleIndex: 1 });
    expect(coach.progress?.done).toBe(0);
    expect(coach.feedback).toBeNull();
  });

  it('starts over when reset, or at the step asked', () => {
    const { coach, move } = setup();
    move(TUTORIAL.MOVE_DISTANCE);
    coach.reset();
    expect(coach.progress).toMatchObject({ step: 'move', done: 0 });
    expect(coach.isPraising).toBe(false);
    coach.reset('steer');
    expect(coach.progress?.step).toBe('steer');
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
