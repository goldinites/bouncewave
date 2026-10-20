import { describe, expect, it } from 'vitest';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { DIFFICULTY_CONFIGS, DifficultyLevel } from '@/match/difficulty';
import { Paddle } from '@/match/Paddle';
import { PaddleSpec, STANDARD_PADDLE } from '@/match/PaddleSpec';
import { Physics } from '@/match/Physics';
import { ClassicScene } from '@/render/ClassicScene';
import { RenderFrame, SceneState } from '@/render/scene';
import { fakeContext } from './helpers/fakeContext';

const NORMAL = DIFFICULTY_CONFIGS[DifficultyLevel.NORMAL];
const spec = (changes: Partial<PaddleSpec>): PaddleSpec => ({ ...STANDARD_PADDLE, ...changes });

/**
 * Sends a ball at the left paddle (of `paddleSpec`), meeting it `offset` px below its center,
 * with the paddle moving at `velocity`.
 * @returns the ball after the step, and whether the paddle hit it (perfectly or not)
 */
const shoot = (paddleSpec: PaddleSpec, offset: number, velocity = 0) => {
  const left = new Paddle(0, PADDLE.OFFSET_X, '#19f0ff', paddleSpec);
  const right = new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6');
  left.velocity = velocity;
  const ball = new Ball();
  ball.x = left.x + paddleSpec.width + ball.radius + 1;
  ball.y = left.y + offset;
  ball.vx = -400;
  ball.vy = 0;

  const events = Physics.step(ball, [left, right], NORMAL, 0.005);
  const hit = events.find((e) => e.type === 'paddleHit');
  return { ball, hit: hit?.type === 'paddleHit' ? hit : null };
};

describe('PaddleSpec', () => {
  it('makes the standard paddle the one the game has always had', () => {
    expect([STANDARD_PADDLE.height, STANDARD_PADDLE.width]).toEqual([PADDLE.HEIGHT, PADDLE.WIDTH]);
    expect(STANDARD_PADDLE).toMatchObject({ power: 1, steer: 1, speed: 1 });
    expect(new Paddle(0, 34, '#fff').spec).toBe(STANDARD_PADDLE);
  });

  it('lets a taller paddle reach a ball the standard one misses', () => {
    const offset = PADDLE.HEIGHT / 2 + 20;

    expect(shoot(STANDARD_PADDLE, offset).hit).toBeNull();
    expect(shoot(spec({ height: PADDLE.HEIGHT + 60 }), offset).hit).not.toBeNull();
  });

  it('keeps a taller paddle clear of the walls', () => {
    const tall = new Paddle(0, 34, '#fff', spec({ height: 200 }));
    tall.setTargetY(0);

    expect(tall.targetY - 100).toBe(PADDLE.TOP_MARGIN);
  });

  it('counts a hit as perfect within the paddle’s own perfect zone', () => {
    const offset = PADDLE.HEIGHT / 2 / 4; // a quarter of the way to the end

    expect(shoot(STANDARD_PADDLE, offset).hit?.isPerfect).toBe(false);
    expect(shoot(spec({ perfectZone: 0.3 }), offset).hit?.isPerfect).toBe(true);
  });

  it('speeds the ball up more off a paddle that hits harder', () => {
    const standard = shoot(STANDARD_PADDLE, 20).ball.speed;
    const harder = shoot(spec({ power: 2 }), 20).ball.speed;

    expect(harder).toBeGreaterThan(standard);
    expect(harder / standard).toBeCloseTo(
      (1 + 2 * NORMAL.acceleration) / (1 + NORMAL.acceleration),
    );
  });

  it('steers the ball further off a paddle with more steer', () => {
    const standard = shoot(STANDARD_PADDLE, 20, 500).ball;
    const steered = shoot(spec({ steer: 2 }), 20, 500).ball;

    expect(Math.atan2(steered.vy, steered.vx)).not.toBeCloseTo(
      Math.atan2(standard.vy, standard.vx),
    );
    expect(Math.abs(steered.vy)).toBeGreaterThan(Math.abs(standard.vy));
  });

  it('follows its target faster when it is quicker', () => {
    const standard = new Paddle(0, 34, '#fff');
    const quick = new Paddle(0, 34, '#fff', spec({ speed: 2 }));
    for (const paddle of [standard, quick]) {
      paddle.setTargetY(400);
      paddle.update(0.02);
    }

    expect(quick.y).toBeGreaterThan(standard.y);
  });

  it('is drawn at its own size', () => {
    const { ctx, spies } = fakeContext();
    const wide = new Paddle(0, 34, '#fff', spec({ width: 30, height: 140 }));

    const frame = {
      court: { isDemo: true, paddles: [wide], balls: [] },
      hud: { overdriveCharges: [null] },
    };
    const state = { finalSign: null, menuDim: 0 };
    new ClassicScene().render(ctx, frame as unknown as RenderFrame, state as SceneState);

    expect(spies.fillRect).toHaveBeenCalledWith(34, wide.drawY - 70, 30, 140);
  });
});
