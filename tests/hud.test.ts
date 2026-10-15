import { describe, expect, it, Mock, vi } from 'vitest';
import { PADDLE } from '@/match/config';
import { Paddle } from '@/match/Paddle';
import { HudRenderer } from '@/render/HudRenderer';

/** Canvas context stand-in: every method is a spy, every property can be set. */
const fakeContext = (): Record<string, Mock> => {
  const target: Record<string | symbol, unknown> = {};
  return new Proxy(target, {
    get: (t, key) => (key in t ? t[key] : (t[key] = vi.fn())),
  }) as unknown as Record<string, Mock>;
};

const paddles = (): [Paddle, Paddle] => [
  new Paddle(0, PADDLE.OFFSET_X, '#19f0ff'),
  new Paddle(1, 700, '#ff2bd6'),
];

/** Scale applied to the left score in the last render. */
const leftScoreScale = (ctx: Record<string, Mock>) => ctx.scale.mock.calls.at(-2)?.[0];

describe('HudRenderer', () => {
  it('pops a changed score and settles it, on the clock it is given', () => {
    const hud = new HudRenderer();
    const players = paddles();
    const draw = (dt: number) => {
      const ctx = fakeContext();
      hud.render(ctx as unknown as CanvasRenderingContext2D, dt, players, 0, 'GET READY', 0, false);
      return leftScoreScale(ctx);
    };

    expect(draw(0)).toBe(1);

    players[0].score = 1;
    expect(draw(0.11)).toBeCloseTo(1.5); // halfway through the pop: largest
    expect(draw(0.11)).toBeCloseTo(1); // settled
  });
});
