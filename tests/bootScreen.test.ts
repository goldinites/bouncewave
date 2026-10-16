import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dismissBootScreen } from '@/ui/BootScreen';

const boot = () => document.getElementById('boot');
const isFading = () => boot()?.classList.contains('boot--done') ?? false;

/** happy-dom has no FontFaceSet: stands one in whose load() settles as `result` does. */
const stubFonts = (result: Promise<FontFace[]>) =>
  Object.defineProperty(document, 'fonts', { value: { load: () => result }, configurable: true });

describe('boot screen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16),
    );
    document.body.innerHTML = '<div class="boot" id="boot"></div>';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (document as { fonts?: unknown }).fonts;
    document.body.innerHTML = '';
  });

  it('fades out once the font is in and the game has drawn, then leaves the page', async () => {
    stubFonts(Promise.resolve([]));

    dismissBootScreen();
    expect(isFading()).toBe(false);

    await vi.advanceTimersByTimeAsync(40);
    expect(isFading()).toBe(true);

    boot()?.dispatchEvent(new Event('transitionend'));
    expect(boot()).toBeNull();
  });

  it("doesn't wait forever for a font that never comes", async () => {
    stubFonts(new Promise(() => {}));

    dismissBootScreen();
    await vi.advanceTimersByTimeAsync(2000);
    expect(isFading()).toBe(false);

    await vi.advanceTimersByTimeAsync(600);
    expect(isFading()).toBe(true);
  });
});
