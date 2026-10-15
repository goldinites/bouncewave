import { Mock, vi } from 'vitest';

/**
 * Canvas context stand-in: every method is a spy, every property can be set and read back.
 * `ctx` is what the code under test gets; `spies` is the same object, typed for assertions.
 */
export const fakeContext = () => {
  const target: Record<string | symbol, unknown> = {};
  const proxy = new Proxy(target, {
    get: (t, key) => (key in t ? t[key] : (t[key] = vi.fn())),
  });
  return {
    ctx: proxy as unknown as CanvasRenderingContext2D,
    spies: proxy as unknown as Record<string, Mock>,
  };
};
