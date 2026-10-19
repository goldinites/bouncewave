import { describe, expect, it, Mock } from 'vitest';
import { PADDLE } from '@/match/config';
import { Paddle } from '@/match/Paddle';
import { HudRenderer } from '@/render/HudRenderer';
import { gameFont } from '@/shared/fonts';
import { fakeContext } from './helpers/fakeContext';

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
    let scores: [number, number] = [0, 0];
    const draw = (dt: number) => {
      const { ctx, spies } = fakeContext();
      hud.render(ctx, dt, players, scores, 0, 'GET READY', 0, false);
      return leftScoreScale(spies);
    };

    expect(draw(0)).toBe(1);

    scores = [1, 0];
    expect(draw(0.11)).toBeCloseTo(1.5); // halfway through the pop: largest
    expect(draw(0.11)).toBeCloseTo(1); // settled
  });

  it('draws the get-ready prompt the same way in every language', () => {
    const drawReady = (text: string) => {
      const { ctx } = fakeContext();
      new HudRenderer().render(ctx, 0, paddles(), [0, 0], 1, text, 0, false);
      return { font: ctx.font, glow: ctx.shadowBlur };
    };

    const latin = drawReady('GET READY');
    expect(latin.font).toBe(gameFont(700, 22));
    expect(drawReady('ГОТОВЬСЬ')).toEqual(latin);
  });

  it('labels whose score is whose only when two players have labels', () => {
    const labelsDrawn = (sideLabels: [string, string] | null) => {
      const { ctx, spies } = fakeContext();
      new HudRenderer().render(ctx, 0, paddles(), [0, 0], 0, '', 0, false, null, sideLabels);
      return spies.fillText.mock.calls.map(([text]) => text).filter((text) => /^P/.test(text));
    };

    expect(labelsDrawn(['P1', 'P2'])).toEqual(['P1', 'P2']);
    expect(labelsDrawn(null)).toEqual([]);
  });
});
