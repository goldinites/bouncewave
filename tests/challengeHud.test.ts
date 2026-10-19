import { beforeEach, describe, expect, it } from 'vitest';
import { I18nManager } from '@/i18n/I18nManager';
import { CHALLENGES } from '@/match/challenges';
import { PADDLE } from '@/match/config';
import { Paddle } from '@/match/Paddle';
import { isDecidingPoint, MatchRules, STANDARD_RULES } from '@/match/rules';
import { Scores } from '@/match/side';
import { HudCondition, HudRenderer } from '@/render/HudRenderer';
import { COLORS } from '@/shared/palette';
import { clockTime, ConditionMatch, describeCondition } from '@/ui/challengeTexts';
import { ConditionBar } from '@/ui/ConditionBar';
import { fakeContext } from './helpers/fakeContext';

const en = new I18nManager('en');
const ru = new I18nManager('ru');

/** A challenge's match at a given moment, the player on the left. */
const match = (
  rules: MatchRules,
  scores: Scores = [0, 0],
  overrides: Partial<ConditionMatch> = {},
): ConditionMatch => ({
  rules,
  scores,
  playerSide: 0,
  timeLeft: rules.timeLimit,
  rally: 0,
  ...overrides,
});

describe('the deciding point by the rules', () => {
  it('needs both sides a point from winning in a standard match', () => {
    const toFive: MatchRules = { ...STANDARD_RULES, winningScores: [5, 5] };
    expect(isDecidingPoint([4, 4], toFive)).toBe(true);
    expect(isDecidingPoint([4, 2], toFive)).toBe(false);
  });

  it('comes on the last life and on the last point to score in Survival', () => {
    const { rules } = CHALLENGES.survival;
    expect(isDecidingPoint([3, 2], rules)).toBe(true); // last life
    expect(isDecidingPoint([9, 0], rules)).toBe(true); // last point to score
    expect(isDecidingPoint([7, 1], rules)).toBe(false);
  });

  it('ends Shutout on the first point lost, its last point the deciding one', () => {
    const { rules } = CHALLENGES.shutout;
    expect(rules.winningScores).toEqual([3, 1]);
    expect(isDecidingPoint([2, 0], rules)).toBe(true);
    expect(isDecidingPoint([1, 0], rules)).toBe(false);
  });
});

describe("a challenge's condition in the HUD", () => {
  it('rounds the clock up, so it reads 0:00 only once time is out', () => {
    expect(clockTime(84.2)).toBe('1:25');
    expect(clockTime(0.4)).toBe('0:01');
    expect(clockTime(0)).toBe('0:00');
  });

  it('shows the rally toward its goal and the clock', () => {
    const { rules, goal } = CHALLENGES.longRally;
    expect(
      describeCondition(ru, match(rules, [0, 0], { rally: 12, timeLeft: 41 }), goal, 0),
    ).toEqual({
      text: 'РОЗЫГРЫШ 12 / 20 · 0:41',
      lives: null,
      isUrgent: false,
      replacesScore: true,
    });
  });

  it('shows the points toward an uneven score, and the lives left as hearts, in the score’s place', () => {
    const { rules, goal } = CHALLENGES.survival;
    expect(describeCondition(ru, match(rules, [7, 1]), goal, 7)).toEqual({
      text: 'ОЧКИ 7 / 10',
      lives: { left: 2, total: 3 },
      isUrgent: false,
      replacesScore: true,
    });
  });

  it('shows Shutout’s points without a lone heart: one life says nothing its goal doesn’t', () => {
    const { rules, goal } = CHALLENGES.shutout;
    expect(describeCondition(en, match(rules, [2, 0]), goal, 2)).toEqual({
      text: 'POINTS 2 / 3',
      lives: null,
      isUrgent: false,
      replacesScore: true,
    });
  });

  it('shows the Overdrive shots toward their goal, under the score that also counts', () => {
    const { rules, goal } = CHALLENGES.overload;
    expect(describeCondition(en, match(rules), goal, 2)).toEqual({
      text: 'OVERDRIVE 2 / 5',
      lives: null,
      isUrgent: false,
      replacesScore: false,
    });
  });

  it('turns the clock urgent for its last ten seconds', () => {
    const { rules, goal } = CHALLENGES.blitz;
    expect(describeCondition(en, match(rules, [3, 1], { timeLeft: 84 }), goal, 3)).toEqual({
      text: '1:24',
      lives: null,
      isUrgent: false,
      replacesScore: false,
    });
    expect(describeCondition(en, match(rules, [3, 1], { timeLeft: 9.5 }), goal, 3)?.isUrgent).toBe(
      true,
    );
  });

  it('shows nothing where the score says it all', () => {
    const { rules, goal } = CHALLENGES.warmUp;
    expect(describeCondition(en, match(rules), goal, 0)).toBeNull();
    expect(describeCondition(en, match(STANDARD_RULES), null, null)).toBeNull();
  });
});

describe('the condition line on the court', () => {
  const paddles = () => [
    new Paddle(0, PADDLE.OFFSET_X, COLORS.CYAN),
    new Paddle(1, 700, COLORS.PINK),
  ];
  const draw = (condition: HudCondition, reduced = false) => {
    const { ctx, spies } = fakeContext();
    spies.measureText.mockReturnValue({ width: 50 });
    const fills: string[] = [];
    spies.fillText.mockImplementation(() => fills.push(String(ctx.fillStyle)));
    new HudRenderer(() => reduced).render(
      ctx,
      0,
      paddles(),
      [0, 0],
      0,
      '',
      0.3,
      false,
      false,
      condition,
    );
    const call = spies.fillText.mock.calls.find(([text]) => text === condition.text);
    // Each score is drawn scaled for its pop; the condition line never is
    return { call, color: fills.at(-1), scores: spies.scale.mock.calls.length };
  };

  it('draws the line under the scores, pink when urgent', () => {
    const line = draw({ text: '1:24', lives: null, isUrgent: false, replacesScore: false });
    expect(line.call).toBeDefined();
    expect(line.color).toBe(COLORS.WHITE);
    expect(line.scores).toBe(2);
    expect(draw({ text: '0:09', lives: null, isUrgent: true, replacesScore: false }).color).toBe(
      COLORS.PINK,
    );
  });

  it('leaves the scores out where the line takes their place', () => {
    const line = draw({
      text: 'POINTS 7 / 10',
      lives: { left: 2, total: 3 },
      isUrgent: false,
      replacesScore: true,
    });
    expect(line.call).toBeDefined();
    expect(line.scores).toBe(0);
  });

  it('draws the lives as red hearts, those lost as faint outlines', () => {
    const { ctx, spies } = fakeContext();
    spies.measureText.mockReturnValue({ width: 100 });
    const hearts: { fill: boolean; color: string; alpha: number }[] = [];
    spies.fill.mockImplementation(() =>
      hearts.push({ fill: true, color: String(ctx.fillStyle), alpha: ctx.globalAlpha }),
    );
    spies.stroke.mockImplementation(() =>
      hearts.push({ fill: false, color: String(ctx.strokeStyle), alpha: ctx.globalAlpha }),
    );
    const condition = {
      text: 'POINTS 7 / 10',
      lives: { left: 2, total: 3 },
      isUrgent: false,
      replacesScore: true,
    };
    new HudRenderer().render(ctx, 0, paddles(), [7, 1], 0, '', 0, false, false, condition);

    expect(hearts.map((h) => [h.fill, h.color])).toEqual([
      [true, COLORS.RED],
      [true, COLORS.RED],
      [false, COLORS.RED],
    ]);
    expect(hearts[2].alpha).toBeLessThan(hearts[0].alpha);
  });
});

describe('the condition under the court, on a phone held upright', () => {
  beforeEach(() => {
    document.body.innerHTML = '<p id="gameCondition"></p>';
  });

  const line = {
    text: 'POINTS 7 / 10',
    lives: { left: 2, total: 3 },
    isUrgent: false,
    replacesScore: true,
  };

  it('shows the text and the lives as hearts, those lost as outlines', () => {
    const bar = new ConditionBar();
    bar.update(line, true);
    const el = document.getElementById('gameCondition')!;
    expect(el.textContent).toBe('POINTS 7 / 10');
    const hearts = [...el.querySelectorAll('.game-condition__heart')];
    expect(hearts).toHaveLength(3);
    expect(hearts.map((h) => h.classList.contains('game-condition__heart--lost'))).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('stays empty where the court shows it, and marks the urgent clock', () => {
    const bar = new ConditionBar();
    const el = document.getElementById('gameCondition')!;
    bar.update(line, false);
    expect(el.textContent).toBe('');
    bar.update({ ...line, text: '0:09', lives: null, isUrgent: true }, true);
    expect(el.classList).toContain('game-condition--urgent');
  });

  it('leaves the DOM alone when nothing changed', () => {
    const bar = new ConditionBar();
    bar.update(line, true);
    const first = document.querySelector('#gameCondition span');
    bar.update({ ...line }, true);
    expect(document.querySelector('#gameCondition span')).toBe(first);
  });

  it('is not drawn on the turned court', () => {
    const { ctx, spies } = fakeContext();
    spies.measureText.mockReturnValue({ width: 50 });
    const paddles = [new Paddle(0, PADDLE.OFFSET_X, COLORS.CYAN), new Paddle(1, 700, COLORS.PINK)];
    new HudRenderer().render(ctx, 0, paddles, [0, 0], 0, '', 0, true, false, line);
    expect(spies.fillText.mock.calls.some(([text]) => text === line.text)).toBe(false);
  });
});
