import { COURT } from '@/match/config';
import { Paddle } from '@/match/Paddle';
import { PlayerInput } from '@/match/PaddleController';
import { Side } from '@/match/side';
import { clamp } from '@/shared/math';

const PADDLE_SPEED = 500; // px/s under keyboard control, for a paddle of standard speed
// Two taps closer than this make iOS zoom in; a little over its own double-tap window
const DOUBLE_TAP_MS = 350;

/**
 * Who a set of controls steers: the one player of a single-player match, or the player at one
 * side when two share the device.
 */
type Seat = 'solo' | Side;

/** Up and down keys of each seat: alone, a player may use either set; two players get one each. */
const SEAT_KEYS: Record<Seat, readonly (readonly [up: string, down: string])[]> = {
  solo: [
    ['KeyW', 'KeyS'],
    ['ArrowUp', 'ArrowDown'],
  ],
  0: [['KeyW', 'KeyS']],
  1: [['ArrowUp', 'ArrowDown']],
};

/** A tap that landed on a UI button (pause, menu) rather than the court itself. */
const isUiTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest('button') !== null;

export interface InputHandlerCallbacks {
  onUnlockAudio: () => void;
  onTogglePause: () => void;
  onToggleFullscreen: () => void;
  onToggleMusic: () => void;
  onNextTrack: () => void;
  /** A fresh key press or tap (not a held-key repeat), e.g. to skip a cutscene. */
  onPress: () => void;
}

/**
 * The keyboard, mouse and touch, read for one player or for two. Alone, the player steers with
 * either set of keys and a pointer anywhere; two players get W/S and the arrows, and each steers
 * by touching their own half of the court (on a portrait phone, where the court is turned, the
 * bottom and the top half of the screen). The mouse is one person's, so it steers only alone.
 */
export class InputHandler implements PlayerInput {
  private keys: Record<string, boolean> = {};
  private canvas: HTMLCanvasElement;
  private isPortraitRotated = false;
  private callbacks: InputHandlerCallbacks;
  private mediaQuery: MediaQueryList;
  /** Aborting it removes every listener this handler added. */
  private readonly listeners = new AbortController();
  /** Where each seat last pointed on the court, as a paddle's y; null until it does. */
  private readonly pointerY: Record<Seat, number | null> = { solo: null, 0: null, 1: null };
  /** The controls of each side's player, when two share the device: [left, right]. */
  public readonly players: readonly [PlayerInput, PlayerInput] = [0, 1].map((side) => ({
    pollPlayerMovement: (paddle: Paddle, dt: number) => this.poll(side as Side, paddle, dt),
  })) as [PlayerInput, PlayerInput];

  constructor(canvas: HTMLCanvasElement, callbacks: InputHandlerCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    this.mediaQuery = window.matchMedia('(orientation:portrait) and (max-width:900px)');
    this.isPortraitRotated = this.mediaQuery.matches;

    this.bindEvents();
  }

  public get isRotated(): boolean {
    return this.isPortraitRotated;
  }

  public dispose(): void {
    this.listeners.abort();
  }

  private bindEvents(): void {
    const { signal } = this.listeners;

    this.mediaQuery.addEventListener(
      'change',
      (e) => {
        this.isPortraitRotated = e.matches;
      },
      { signal },
    );

    window.addEventListener(
      'contextmenu',
      (e) => {
        e.preventDefault();
        this.callbacks.onTogglePause();
      },
      { signal },
    );

    window.addEventListener(
      'keydown',
      (e) => {
        this.callbacks.onUnlockAudio();
        if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
          e.preventDefault();
        }
        this.keys[e.code] = true;

        if (!e.repeat) {
          this.callbacks.onPress();
        }

        if (e.code === 'KeyP' || e.code === 'Escape') {
          if (e.repeat) return;

          this.callbacks.onTogglePause();
        }

        if (e.code === 'KeyF') {
          if (e.repeat) return;

          this.callbacks.onToggleFullscreen();
        }

        if (e.code === 'KeyM') {
          if (e.repeat) return;

          this.callbacks.onToggleMusic();
        }

        if (e.code === 'KeyN') {
          if (e.repeat) return;

          this.callbacks.onNextTrack();
        }
      },
      { signal },
    );

    window.addEventListener(
      'keyup',
      (e) => {
        this.keys[e.code] = false;
      },
      { signal },
    );

    window.addEventListener(
      'blur',
      () => {
        for (const k in this.keys) {
          this.keys[k] = false;
        }
      },
      { signal },
    );

    const handlePointer = (e: PointerEvent) => {
      this.callbacks.onUnlockAudio();
      if (isUiTarget(e.target)) return;

      const rect = this.canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // On a portrait phone the stage is turned a quarter left: the court's top is the screen's
      // left, its left side the screen's bottom
      const across = this.isPortraitRotated
        ? 1 - (e.clientY - rect.top) / rect.height
        : (e.clientX - rect.left) / rect.width;
      const down = this.isPortraitRotated
        ? (e.clientX - rect.left) / rect.width
        : (e.clientY - rect.top) / rect.height;
      const y = down * COURT.HEIGHT;

      this.pointerY.solo = y;
      if (e.pointerType !== 'mouse') this.pointerY[across < 0.5 ? 0 : 1] = y;
    };

    window.addEventListener('pointermove', handlePointer, { signal });
    window.addEventListener(
      'pointerdown',
      (e) => {
        handlePointer(e);
        if (!isUiTarget(e.target)) this.callbacks.onPress();
      },
      { signal },
    );

    // iOS zooms in on a quick double tap and on a pinch, ignoring the viewport's no-zoom, and
    // the page's touch-action: none then leaves no gesture to zoom back out. So the second tap
    // of a pair never becomes a double tap, and a pinch never starts. Steering is unaffected:
    // it runs on pointer events, which fire before this
    let lastTouchEnd = -Infinity;
    window.addEventListener(
      'touchend',
      (e) => {
        // iOS lets a touch start audio only once it ends: pointerdown above is too early, and
        // the context it creates or resumes there stays silent
        this.callbacks.onUnlockAudio();
        if (e.timeStamp - lastTouchEnd < DOUBLE_TAP_MS) e.preventDefault();
        lastTouchEnd = e.timeStamp;
      },
      { signal, passive: false },
    );
    window.addEventListener('gesturestart', (e) => e.preventDefault(), { signal });
  }

  /** The single player's controls: either set of keys, a pointer anywhere. */
  public pollPlayerMovement(playerPaddle: Paddle, dt: number): void {
    this.poll('solo', playerPaddle, dt);
  }

  private poll(seat: Seat, paddle: Paddle, dt: number): void {
    const direction = clamp(
      SEAT_KEYS[seat].reduce(
        (sum, [up, down]) => sum + (this.keys[down] ? 1 : 0) - (this.keys[up] ? 1 : 0),
        0,
      ),
      -1,
      1,
    );

    if (direction !== 0) {
      const speed = PADDLE_SPEED * paddle.spec.speed;
      paddle.setTargetY(paddle.targetY + direction * speed * dt);
      this.pointerY[seat] = null; // Keyboard overrides pointer target
    } else if (this.pointerY[seat] !== null) {
      paddle.setTargetY(this.pointerY[seat]);
    }
  }
}
