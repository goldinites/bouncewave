import { describe, expect, it, vi } from 'vitest';
import { Background } from '@/render/backgrounds/Background';
import { BackgroundRenderer } from '@/render/BackgroundRenderer';
import { fakeContext } from './helpers/fakeContext';

const MOOD = { laserIntensity: 1, climax: 0.2, celebration: 0.6 };

const fakeBackground = (overlayTint: number, withHooks = false): Background => ({
  overlayTint,
  render: vi.fn(),
  ...(withHooks ? { advance: vi.fn(), triggerDrop: vi.fn() } : {}),
});

const draw = (renderer: BackgroundRenderer, time: number) => {
  const { ctx } = fakeContext();
  renderer.render(ctx, null, time, 0, false, MOOD);
  return ctx;
};

describe('BackgroundRenderer', () => {
  it('draws only the active background and switches on request', () => {
    const backgrounds = [fakeBackground(0.1), fakeBackground(0.2)];
    const renderer = new BackgroundRenderer(backgrounds);

    draw(renderer, 0);
    const first = backgrounds.findIndex((b) => vi.mocked(b.render).mock.calls.length === 1);
    expect(first).toBeGreaterThanOrEqual(0);

    renderer.nextBackground();
    draw(renderer, 0.016);

    const second = backgrounds[(first + 1) % 2];
    expect(second.render).toHaveBeenCalledTimes(1);
    expect(backgrounds[first].render).toHaveBeenCalledTimes(1);
  });

  it('tints with the active background’s own overlay', () => {
    const renderer = new BackgroundRenderer([fakeBackground(0.42)]);
    expect(draw(renderer, 0).fillStyle).toBe('rgba(10, 2, 32, 0.42)');
  });

  it('advances and bursts every background that has the hooks, shown or not', () => {
    const plain = fakeBackground(0.1);
    const lively = fakeBackground(0.3, true);
    const renderer = new BackgroundRenderer([plain, lively]);

    draw(renderer, 0);
    draw(renderer, 0.05);
    renderer.triggerDrop();

    // Heat is the stronger of climax and celebration
    expect(lively.advance).toHaveBeenLastCalledWith(expect.closeTo(0.05), 0, 0.6);
    expect(lively.triggerDrop).toHaveBeenCalledOnce();
  });
});
