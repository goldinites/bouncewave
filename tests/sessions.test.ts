import { describe, expect, it, vi } from 'vitest';
import { ChallengeSession } from '@/app/sessions/ChallengeSession';
import { QuickMatchSession } from '@/app/sessions/QuickMatchSession';
import { SessionContext } from '@/app/sessions/Session';
import { TutorialSession } from '@/app/sessions/TutorialSession';
import { TwoPlayerSession } from '@/app/sessions/TwoPlayerSession';
import { I18nManager } from '@/i18n/I18nManager';
import { InputHandler } from '@/input/InputHandler';
import { Ball } from '@/match/Ball';
import { CHALLENGES } from '@/match/challenges';
import { COURT, PADDLE } from '@/match/config';
import { DifficultyLevel } from '@/match/difficulty';
import { MatchFlow } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';
import { quickMatchRules } from '@/match/modes';
import { MatchRules } from '@/match/rules';
import { TutorialCoach, TutorialStep } from '@/match/tutorial';

const still = { pollPlayerMovement: () => {} };

/** A real match to start, and a context as `Game` gives it. */
const setup = () => {
  const flow = new MatchFlow({
    paddles: [
      new Paddle(0, PADDLE.OFFSET_X, '#19f0ff'),
      new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6'),
    ],
    ball: new Ball(),
    input: still,
    getDifficulty: () => DifficultyLevel.HARD,
    onEvent: () => {},
    random: () => 0.5,
  });
  const quick = quickMatchRules(7);
  const context: SessionContext = {
    flow,
    input: { ...still, players: [still, still] } as unknown as InputHandler,
    i18n: new I18nManager('en'),
    quickRules: () => quick,
    forLook: vi.fn((rules: MatchRules) => rules),
    skillsOf: (owner) => (owner === 'player' ? ['arc'] : []),
  };
  return { flow, context, quick };
};

/** A coach standing at `step`, its card and end as a test sets them. */
const fakeCoach = (step: TutorialStep) => {
  const coach = {
    progress: { step },
    isBetweenSteps: false,
    isFinished: false,
    reset: vi.fn(),
    update: vi.fn(),
    acknowledge: vi.fn(),
  };
  return coach;
};

describe('sessions', () => {
  it('plays a quick match as set up, against the CPU at its level, and counts it', () => {
    const { flow, context, quick } = setup();
    const session = new QuickMatchSession(context);
    session.start();

    expect(flow.rules).toBe(quick);
    expect(flow.difficulty).toBe(DifficultyLevel.HARD);
    expect(flow.isPlayerPaddle(0)).toBe(true);
    expect(flow.isTwoPlayer).toBe(false);
    expect(session).toMatchObject({
      scene: null,
      place: null,
      isTwoPlayers: false,
      challenge: null,
      isCounted: true,
      isReplayed: true,
      perfectZoneMark: null,
    });
  });

  it("plays two people's match on the quick match's rules, out of the record", () => {
    const { flow, context, quick } = setup();
    const session = new TwoPlayerSession(context);
    session.start();

    expect(flow.rules).toBe(quick);
    expect(flow.isTwoPlayer).toBe(true);
    expect(session).toMatchObject({ isTwoPlayers: true, isCounted: false, scene: null });
  });

  it('plays a challenge as set up in advance, on its own backdrop, with its goal over the court', () => {
    const { flow, context } = setup();
    const session = new ChallengeSession(context, 'survival');
    session.start();

    const { rules, difficulty, scene } = CHALLENGES.survival;
    expect(context.forLook).toHaveBeenCalledWith(rules);
    expect(flow.rules).toBe(rules);
    expect(flow.difficulty).toBe(difficulty);
    expect(session).toMatchObject({ challenge: 'survival', scene, isCounted: false });
    expect(session.condition()).not.toBeNull();
  });

  describe('the tutorial', () => {
    const tutorial = (step: TutorialStep) => {
      const { flow, context } = setup();
      const coach = fakeCoach(step);
      const deps = {
        coach: coach as unknown as TutorialCoach,
        firstStep: step,
        showCard: vi.fn(),
        finish: vi.fn(),
      };
      return { flow, coach, deps, session: new TutorialSession(context, deps) };
    };

    it('starts at its first step on the Range, with its own music, out of the record', () => {
      const { flow, coach, session } = tutorial('move');
      session.start();

      expect(coach.reset).toHaveBeenCalledWith('move');
      expect(flow.difficulty).toBe(DifficultyLevel.EASY);
      // Nothing it hasn't taught yet: no Overdrive meter
      expect(flow.overdriveCharges[0]).toBeNull();
      expect(session).toMatchObject({
        scene: 'range',
        place: 'tutorial',
        isCounted: false,
        isReplayed: false,
        perfectZoneMark: null,
      });
    });

    it("marks the learner's perfect zone while a step is about perfect hits", () => {
      const { coach, session } = tutorial('perfect');
      expect(session.perfectZoneMark).toBe(0);
      coach.isBetweenSteps = true;
      expect(session.perfectZoneMark).toBeNull();
    });

    it("follows the coach: a step's card, its read on resume, and the end", () => {
      const { coach, deps, session } = tutorial('perfect');
      session.update(0.016);
      expect(coach.update).toHaveBeenCalledWith(0.016);
      expect(deps.showCard).toHaveBeenCalled();
      expect(deps.finish).not.toHaveBeenCalled();

      session.onResume();
      expect(coach.acknowledge).toHaveBeenCalled();

      coach.isFinished = true;
      session.update(0.016);
      expect(deps.finish).toHaveBeenCalled();
    });
  });
});
