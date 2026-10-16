import { describe, expect, it, vi } from 'vitest';
import { InputHandler } from '@/input/InputHandler';

const makeHandler = () => {
  const callbacks = {
    onUnlockAudio: vi.fn(),
    onTogglePause: vi.fn(),
    onToggleFullscreen: vi.fn(),
    onPress: vi.fn(),
  };
  const handler = new InputHandler(document.createElement('canvas'), callbacks);
  return { handler, callbacks };
};

describe('InputHandler', () => {
  it('reports fresh presses but not held-key repeats', () => {
    const { handler, callbacks } = makeHandler();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', repeat: true }));

    expect(callbacks.onPress).toHaveBeenCalledTimes(1);
    handler.dispose();
  });

  it('toggles fullscreen on F, but not on a held repeat', () => {
    const { handler, callbacks } = makeHandler();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', repeat: true }));

    expect(callbacks.onToggleFullscreen).toHaveBeenCalledTimes(1);
    handler.dispose();
  });

  it('stops listening after dispose', () => {
    const { handler, callbacks } = makeHandler();
    handler.dispose();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }));
    window.dispatchEvent(new Event('contextmenu'));

    expect(callbacks.onPress).not.toHaveBeenCalled();
    expect(callbacks.onTogglePause).not.toHaveBeenCalled();
    expect(callbacks.onToggleFullscreen).not.toHaveBeenCalled();
    expect(callbacks.onUnlockAudio).not.toHaveBeenCalled();
  });
});
