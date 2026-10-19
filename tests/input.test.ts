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
    onNextTrack: vi.fn(),
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

const touch = (clientX: number, clientY: number, pointerType = 'touch') =>
  document.body.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, clientX, clientY, pointerType }),
  );

/** Where each paddle heads after a step of the given controls: [solo, left, right]. */
const targets = (handler: InputHandler) => {
  const paddles = [0, 1, 2].map(() => new Paddle(0, 0, '#19f0ff'));
  handler.pollPlayerMovement(paddles[0], 0.1);
  handler.players[0].pollPlayerMovement(paddles[1], 0.1);
  handler.players[1].pollPlayerMovement(paddles[2], 0.1);
  return paddles.map((paddle) => paddle.targetY - COURT.HEIGHT / 2);
};

describe('InputHandler', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('two players on one device', () => {
    it('gives the left player W/S and the right one the arrows; alone, either moves', () => {
      const { handler } = makeHandler();

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
      const [solo, left, right] = targets(handler);
      expect(solo).toBeGreaterThan(0);
      expect(left).toBeGreaterThan(0);
      expect(right).toBe(0);

      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
      const [soloUp, leftStill, rightUp] = targets(handler);
      expect(soloUp).toBeLessThan(0);
      expect(leftStill).toBe(0);
      expect(rightUp).toBeLessThan(0);
      handler.dispose();
    });

    it('steers each paddle by touches on its own half of the court', () => {
      const { handler } = makeHandler();

      touch(100, 400); // left half, low
      touch(700, 50); // right half, high
      const [, left, right] = targets(handler);
      expect(left).toBeGreaterThan(0);
      expect(right).toBeLessThan(0);
      handler.dispose();
    });

    it('takes the bottom half of a portrait phone’s screen for the left player', () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
      } as unknown as MediaQueryList);
      const { handler } = makeHandler();

      // The court is turned a quarter left: its left side at the bottom, its top at the left
      touch(700, 450); // bottom of the screen, toward its right: the left player, low on court
      const [, left, right] = targets(handler);
      expect(left).toBeGreaterThan(0);
      expect(right).toBe(0);
      handler.dispose();
    });

    it('lets the mouse steer only a player who is alone', () => {
      const { handler } = makeHandler();

      touch(100, 400, 'mouse');
      const [solo, left, right] = targets(handler);
      expect(solo).toBeGreaterThan(0);
      expect([left, right]).toEqual([0, 0]);
      handler.dispose();
    });
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

  it('keeps a quick second tap from turning into a double-tap zoom', () => {
    const { handler } = makeHandler();
    const tap = () => {
      const touchEnd = new Event('touchend', { bubbles: true, cancelable: true });
      document.body.dispatchEvent(touchEnd);
      return touchEnd.defaultPrevented;
    };

    expect(tap()).toBe(false);
    expect(tap()).toBe(true);
    handler.dispose();
  });

  it('never lets a pinch start zooming the page', () => {
    const { handler } = makeHandler();
    const pinch = new Event('gesturestart', { cancelable: true });

    window.dispatchEvent(pinch);

    expect(pinch.defaultPrevented).toBe(true);
    handler.dispose();
  });

  it('toggles the music on M, once per press', () => {
    const { handler, callbacks } = makeHandler();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', repeat: true }));

    expect(callbacks.onToggleMusic).toHaveBeenCalledTimes(1);
    handler.dispose();
  });

  it('skips to the next track on N', () => {
    const { handler, callbacks } = makeHandler();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN' }));
    expect(callbacks.onNextTrack).toHaveBeenCalledOnce();
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
