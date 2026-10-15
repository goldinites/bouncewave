import { describe, expect, it } from 'vitest';
import { AiController } from '@/match/AiController';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { DEMO_AI_SKILL, DifficultyLevel, DIFFICULTY_CONFIGS } from '@/match/difficulty';
import { Paddle } from '@/match/Paddle';

const NORMAL = DIFFICULTY_CONFIGS[DifficultyLevel.NORMAL];
const cpuPaddle = () => new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6');

describe('AiController', () => {
  it('moves paddle toward ball when ball is heading towards CPU paddle', () => {
    const paddle = cpuPaddle();
    paddle.targetY = 100;

    const ball = new Ball();
    ball.y = 400;
    ball.vx = 300; // moving towards paddle 1 (rightwards)

    new AiController().update(paddle, ball, NORMAL, 0.1);

    expect(paddle.targetY).toBeGreaterThan(100);
  });

  it('returns paddle toward center when ball is heading away from CPU paddle', () => {
    const paddle = cpuPaddle();
    paddle.targetY = 100;

    const ball = new Ball();
    ball.y = 400;
    ball.vx = -300; // moving away from paddle 1

    new AiController().update(paddle, ball, NORMAL, 0.1);

    // Should move toward COURT.HEIGHT / 2 (250)
    expect(paddle.targetY).toBeGreaterThan(100);
    expect(paddle.targetY).toBeLessThanOrEqual(COURT.HEIGHT / 2);
  });

  it('moves no faster than its skill allows', () => {
    const paddle = cpuPaddle();
    paddle.targetY = 100;

    const ball = new Ball();
    ball.y = 450;
    ball.vx = 300;

    new AiController().update(paddle, ball, DEMO_AI_SKILL, 0.1);

    expect(paddle.targetY).toBeCloseTo(100 + DEMO_AI_SKILL.speed * 0.1);
  });

  it('rolls an aim error within the skill', () => {
    const paddle = cpuPaddle();
    const hard = DIFFICULTY_CONFIGS[DifficultyLevel.HARD];
    const ai = new AiController();

    for (let i = 0; i < 50; i++) {
      ai.rollAimError(paddle, hard);
      expect(Math.abs(ai.getAimError(paddle))).toBeLessThanOrEqual(hard.error / 2);

      ai.rollAimError(paddle, DEMO_AI_SKILL);
      expect(Math.abs(ai.getAimError(paddle))).toBeLessThanOrEqual(DEMO_AI_SKILL.error / 2);
    }
  });

  it('forgets the aim errors on reset', () => {
    const paddle = cpuPaddle();
    const ai = new AiController();

    ai.rollAimError(paddle, DEMO_AI_SKILL);
    ai.reset();

    expect(ai.getAimError(paddle)).toBe(0);
  });
});
