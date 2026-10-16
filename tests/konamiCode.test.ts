import { describe, expect, it, vi } from 'vitest';
import { KonamiCode } from '@/easterEgg/KonamiCode';

const press = (...codes: string[]) => {
  codes.forEach((code) => window.dispatchEvent(new KeyboardEvent('keydown', { code })));
};

describe('KonamiCode', () => {
  it('fires once the full sequence lands in order', () => {
    const onComplete = vi.fn();
    const code = new KonamiCode(onComplete);

    press(
      'ArrowUp',
      'ArrowUp',
      'ArrowDown',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowLeft',
      'ArrowRight',
      'KeyB',
      'KeyA',
    );

    expect(onComplete).toHaveBeenCalledOnce();
    code.dispose();
  });

  it('never fires on an unrelated run of keys', () => {
    const onComplete = vi.fn();
    const code = new KonamiCode(onComplete);

    press('KeyW', 'KeyS', 'Space', 'Enter', 'ArrowUp', 'ArrowLeft');

    expect(onComplete).not.toHaveBeenCalled();
    code.dispose();
  });

  it('lets a broken attempt be retried cleanly from the top', () => {
    const onComplete = vi.fn();
    const code = new KonamiCode(onComplete);

    // Derails on an unrelated key, which hard-resets progress to 0
    press('ArrowUp', 'ArrowUp', 'KeyX');
    expect(onComplete).not.toHaveBeenCalled();

    press(
      'ArrowUp',
      'ArrowUp',
      'ArrowDown',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowLeft',
      'ArrowRight',
      'KeyB',
      'KeyA',
    );
    expect(onComplete).toHaveBeenCalledOnce();
    code.dispose();
  });

  it('treats a mismatched key that equals the first step as starting a new attempt', () => {
    const onComplete = vi.fn();
    const code = new KonamiCode(onComplete);

    // The third ArrowUp breaks the "two ArrowUps" opener, but it IS the sequence's first key,
    // so it should count as step 1 of a fresh attempt rather than resetting to 0. A naive
    // "always reset to 0 on mismatch" implementation would never complete this exact run.
    press(
      'ArrowUp',
      'ArrowUp',
      'ArrowUp', // mismatch at step 3, but re-anchors progress to 1
      'ArrowUp', // step 2 of the new attempt
      'ArrowDown',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowLeft',
      'ArrowRight',
      'KeyB',
      'KeyA',
    );

    expect(onComplete).toHaveBeenCalledOnce();
    code.dispose();
  });

  it('stops listening after dispose', () => {
    const onComplete = vi.fn();
    const code = new KonamiCode(onComplete);
    code.dispose();

    press(
      'ArrowUp',
      'ArrowUp',
      'ArrowDown',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowLeft',
      'ArrowRight',
      'KeyB',
      'KeyA',
    );

    expect(onComplete).not.toHaveBeenCalled();
  });
});
