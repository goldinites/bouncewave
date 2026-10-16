import { afterEach, describe, expect, it, Mock, vi } from 'vitest';
import { SpriteCache } from '@/render/SpriteCache';
import { fakeContext } from './helpers/fakeContext';

const bounds = { left: -10, top: -5, width: 20, height: 10 };

/** Lets document.createElement('canvas') hand out working (fake) 2D contexts. */
const withOffscreenCanvases = () => {
  const createElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const element = createElement(tag);
    if (tag === 'canvas') {
      vi.spyOn(element as HTMLCanvasElement, 'getContext').mockReturnValue(fakeContext().ctx);
    }
    return element;
  });
};

describe('SpriteCache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('paints a sprite once and then only copies it, around its anchor', () => {
    withOffscreenCanvases();
    const cache = new SpriteCache();
    const { ctx, spies } = fakeContext();
    const paint = vi.fn();

    cache.draw(ctx, 'key', 100, 50, () => bounds, paint);
    cache.draw(ctx, 'key', 100, 50, () => bounds, paint);

    expect(paint).toHaveBeenCalledTimes(1);
    expect(spies.drawImage).toHaveBeenCalledTimes(2);
    expect((spies.drawImage as Mock).mock.calls[0].slice(1)).toEqual([90, 45, 20, 10]);
  });

  it('renders sprites again at a new resolution', () => {
    withOffscreenCanvases();
    const cache = new SpriteCache();
    const { ctx } = fakeContext();
    const paint = vi.fn();

    cache.setScale(2);
    cache.draw(ctx, 'key', 0, 0, () => bounds, paint);
    cache.setScale(2);
    cache.draw(ctx, 'key', 0, 0, () => bounds, paint);
    expect(paint).toHaveBeenCalledTimes(1);

    cache.setScale(1.5);
    cache.draw(ctx, 'key', 0, 0, () => bounds, paint);
    expect(paint).toHaveBeenCalledTimes(2);
  });

  it('draws straight onto the canvas when there is no offscreen canvas', () => {
    const cache = new SpriteCache();
    const { ctx, spies } = fakeContext();
    const paint = vi.fn();

    cache.draw(ctx, 'key', 100, 50, () => bounds, paint);

    expect(paint.mock.calls[0][0]).toBe(ctx);
    expect(spies.translate).toHaveBeenCalledWith(100, 50);
    expect(spies.drawImage).not.toHaveBeenCalled();
  });
});
