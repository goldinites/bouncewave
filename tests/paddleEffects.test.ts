import { describe, expect, it } from 'vitest';
import { PaddleEffects } from '@/fx/PaddleEffects';
import { ParticleSystem } from '@/fx/ParticleSystem';
import { COURT, PADDLE } from '@/match/config';
import { Paddle } from '@/match/Paddle';

describe('PaddleEffects whip', () => {
  const setup = () => {
    const paddles = [
      new Paddle(0, PADDLE.OFFSET_X, '#19f0ff'),
      new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6'),
    ];
    const fx = new PaddleEffects(paddles.length);
    const run = (seconds: number) => {
      const angles: number[] = [];
      for (let t = 0; t < seconds; t += 1 / 60) {
        fx.update(1 / 60, paddles, new ParticleSystem(), 0);
        angles.push(fx.tilt[0]);
      }
      return angles;
    };
    return { fx, run };
  };

  it('turns each paddle’s face the way it swept the ball', () => {
    const { fx } = setup();
    fx.onWhip(0, 0, 500, 0.5);
    fx.onWhip(1, 1, 500, 0.5);
    // Moving down: the left paddle turns clockwise, the right one counterclockwise
    expect(fx.tilt[0]).toBeGreaterThan(0);
    expect(fx.tilt[1]).toBeLessThan(0);
  });

  it('leans further off a harder spin, and always enough to see', () => {
    const { fx } = setup();
    fx.onWhip(0, 0, -500, 0);
    const gentle = Math.abs(fx.tilt[0]);
    fx.onWhip(0, 0, -500, 1);
    expect(gentle).toBeGreaterThan(0.1);
    expect(Math.abs(fx.tilt[0])).toBeGreaterThan(gentle);
  });

  it('springs back past upright once, then stands still', () => {
    const { fx, run } = setup();
    fx.onWhip(0, 0, 500, 1);
    const angles = run(0.6);

    expect(Math.min(...angles)).toBeLessThan(0);
    expect(angles.at(-1)).toBe(0);
  });
});
