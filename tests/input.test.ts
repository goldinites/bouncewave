import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputHandler } from '@/input/InputHandler';
import { COURT } from '@/match/config';
import { Paddle } from '@/match/Paddle';

const makeHandler = () => {
  const callbacks = {
    onUnlockAudio: vi.fn(),
    onTogglePause: vi.fn(),
    onToggleFullscreen: vi.fn(),
    onToggleMusic: vi.fn(),
    onPress: vi.fn(),
  };
  const canvas = document.createElement('canvas');
  // happy-dom lays nothing out, so a real rect has to be faked for the pointer math to run
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: COURT.WIDTH,
    height: COURT.HEIGHT,
  } as DOMRect);

  const handler = new InputHandler(canvas, callbacks);
  return { handler, callbacks, canvas };
};

describe('InputHandler', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('steers the paddle toward a tap on the court', () => {
    const { handler } = makeHandler();
    const paddle = new Paddle(0, 0, '#19f0ff');

    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 50 }),
    );
    handler.pollPlayerMovement(paddle, 1);

    expect(paddle.targetY).not.toBe(COURT.HEIGHT / 2);
    handler.dispose();
  });

  it('ignores a tap that lands on a UI button instead of the court', () => {
    const { handler } = makeHandler();
    const paddle = new Paddle(0, 0, '#19f0ff');
    const button = document.createElement('button');
    document.body.appendChild(button);

    button.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 50 }),
    );
    handler.pollPlayerMovement(paddle, 1);

    expect(paddle.targetY).toBe(COURT.HEIGHT / 2); // unmoved from its starting position
    handler.dispose();
  });

  it('toggles the music on M, once per press', () => {
    const { handler, callbacks } = makeHandler();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', repeat: true }));

    expect(callbacks.onToggleMusic).toHaveBeenCalledTimes(1);
    handler.dispose();
  });

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
