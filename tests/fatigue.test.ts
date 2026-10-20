import { describe, expect, it } from 'vitest';
import { Ball } from '@/match/Ball';
import { CHALLENGE_IDS, CHALLENGES } from '@/match/challenges';
import { COURT, PADDLE } from '@/match/config';
import {
  AiSkill,
  DIFFICULTY_CONFIGS,
  DIFFICULTY_LEVELS,
  DifficultyLevel,
} from '@/match/difficulty';
import { FATIGUE, fatigueAt, tired } from '@/match/fatigue';
import { quickMatchRules } from '@/match/modes';
import { Paddle } from '@/match/Paddle';
import { AiPaddleController } from '@/match/PaddleController';
import { STANDARD_RULES } from '@/match/rules';

const NORMAL = DIFFICULTY_CONFIGS[DifficultyLevel.NORMAL];

/** How the controller plays the shot coming at it now. */
const playing = (controller: AiPaddleController) =>
  (controller as unknown as { playing: AiSkill }).playing;

const cpuPaddle = () => new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6');

describe('a long rally tires the CPU', () => {
  it('only past FROM hits, fully by FULL', () => {
    expect(fatigueAt(0)).toBe(0);
    expect(fatigueAt(FATIGUE.FROM)).toBe(0);
    expect(fatigueAt((FATIGUE.FROM + FATIGUE.FULL) / 2)).toBeCloseTo(0.5);
    expect(fatigueAt(FATIGUE.FULL)).toBe(1);
    expect(fatigueAt(FATIGUE.FULL * 3)).toBe(1);
  });

  it('makes it slower to react, worse at reading the ball and more twitchy', () => {
    expect(tired(NORMAL, 0)).toBe(NORMAL);
    const worn = tired(NORMAL, 1);
    expect(worn.reaction).toBeCloseTo(NORMAL.reaction + FATIGUE.REACTION);
    expect(worn.error).toBe(NORMAL.error + FATIGUE.ERROR);
    expect(worn.errorPerBounce).toBe(NORMAL.errorPerBounce + FATIGUE.ERROR_PER_BOUNCE);
    expect(worn.nerves).toBe(NORMAL.nerves + FATIGUE.NERVES);
    // Its speed and its attack are its own still
    expect(worn.speed).toBe(NORMAL.speed);
    expect(worn.perfectAim).toBe(NORMAL.perfectAim);
  });

  it('wears down a match CPU in a long rally, and it is fresh again for the next point', () => {
    const paddle = cpuPaddle();
    const cpu = new AiPaddleController(
      () => 0.5,
      () => DifficultyLevel.NORMAL,
    );
    cpu.onServe(paddle, [0, 0], quickMatchRules(5));
    const fresh = playing(cpu);

    cpu.onIncomingShot(paddle, undefined, new Ball(), FATIGUE.FROM);
    expect(playing(cpu)).toEqual(fresh);
    cpu.onIncomingShot(paddle, undefined, new Ball(), FATIGUE.FULL);
    expect(playing(cpu)).toEqual(tired(fresh, 1));

    cpu.onServe(paddle, [0, 1], quickMatchRules(5));
    expect(playing(cpu).error).toBeLessThan(tired(fresh, 1).error);
  });

  it('tires the lower levels only: the upper go to overtime instead', () => {
    const tiring = DIFFICULTY_LEVELS.map((level) => DIFFICULTY_CONFIGS[level].fatigue);
    expect(tiring).toEqual([1, 1, 0, 0]);
    expect(DIFFICULTY_LEVELS.map((level) => DIFFICULTY_CONFIGS[level].overtime)).toEqual([
      false,
      false,
      true,
      true,
    ]);
    const insane = DIFFICULTY_CONFIGS[DifficultyLevel.INSANE];
    expect(tired(insane, 1)).toBe(insane);
  });

  it('never tires where the rules say not, nor in the demo', () => {
    const paddle = cpuPaddle();
    const cpu = new AiPaddleController(
      () => 0.5,
      () => DifficultyLevel.NORMAL,
    );
    cpu.onServe(paddle, [0, 0], { ...STANDARD_RULES, rallyPressure: false });
    const fresh = playing(cpu);
    cpu.onIncomingShot(paddle, undefined, new Ball(), FATIGUE.FULL);
    expect(playing(cpu)).toBe(fresh);

    const demo = new AiPaddleController(() => 0.5);
    demo.onServe(paddle, [0, 0], STANDARD_RULES);
    const demoFresh = playing(demo);
    demo.onIncomingShot(paddle, undefined, new Ball(), FATIGUE.FULL);
    expect(playing(demo)).toBe(demoFresh);
  });

  it('is off in the challenges a long rally passes, which a tiring CPU would cut short', () => {
    for (const id of CHALLENGE_IDS) {
      const { rules } = CHALLENGES[id];
      expect(rules.rallyPressure, id).toBe(rules.rallyGoal === null);
    }
  });
});
