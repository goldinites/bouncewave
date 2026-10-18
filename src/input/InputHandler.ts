import { COURT } from '@/match/config';
import { Paddle } from '@/match/Paddle';
import { clamp } from '@/shared/math';

const PADDLE_SPEED = 500; // px/s under keyboard control, for a paddle of standard speed
// Two taps closer than this make iOS zoom in; a little over its own double-tap window
const DOUBLE_TAP_MS = 350;

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

export class InputHandler {
  private keys: Record<string, boolean> = {};
  private canvas: HTMLCanvasElement;
  private isPortraitRotated = false;
  private callbacks: InputHandlerCallbacks;
  private mediaQuery: MediaQueryList;
  /** Aborting it removes every listener this handler added. */
  private readonly listeners = new AbortController();

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

      const normalizedY = this.isPortraitRotated
        ? (e.clientX - rect.left) / rect.width
        : (e.clientY - rect.top) / rect.height;

      this.lastPointerY = normalizedY * COURT.HEIGHT;
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

  private lastPointerY: number | null = null;

  public pollPlayerMovement(playerPaddle: Paddle, dt: number): void {
    const keyDir1 = (this.keys['KeyS'] ? 1 : 0) - (this.keys['KeyW'] ? 1 : 0);
    const keyDir2 = (this.keys['ArrowDown'] ? 1 : 0) - (this.keys['ArrowUp'] ? 1 : 0);
    const combinedKeyDir = clamp(keyDir1 + keyDir2, -1, 1);

    if (combinedKeyDir !== 0) {
      const speed = PADDLE_SPEED * playerPaddle.spec.speed;
      playerPaddle.setTargetY(playerPaddle.targetY + combinedKeyDir * speed * dt);
      this.lastPointerY = null; // Keyboard overrides pointer target
    } else if (this.lastPointerY !== null) {
      playerPaddle.setTargetY(this.lastPointerY);
    }
  }
}
