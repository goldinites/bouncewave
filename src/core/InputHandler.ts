import { GAME_HEIGHT, PADDLE_SPEED } from '@/constants/game.constants';
import { Paddle } from '@/entities/Paddle';
import { clamp } from '@/utils/math';

export interface InputHandlerCallbacks {
  onUnlockAudio: () => void;
  onTogglePause: () => void;
}

export class InputHandler {
  private keys: Record<string, boolean> = {};
  private canvas: HTMLCanvasElement;
  private isPortraitRotated = false;
  private callbacks: InputHandlerCallbacks;
  private mediaQuery: MediaQueryList;

  constructor(canvas: HTMLCanvasElement, callbacks: InputHandlerCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    this.mediaQuery = window.matchMedia('(orientation:portrait) and (max-width:900px)');
    this.isPortraitRotated = this.mediaQuery.matches;

    this.mediaQuery.addEventListener('change', (e) => {
      this.isPortraitRotated = e.matches;
    });

    this.bindEvents();
  }

  public get isRotated(): boolean {
    return this.isPortraitRotated;
  }

  private bindEvents(): void {
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.callbacks.onTogglePause();
    });

    window.addEventListener('keydown', (e) => {
      this.callbacks.onUnlockAudio();
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault();
      }
      this.keys[e.code] = true;

      if (e.code === 'KeyP' || e.code === 'Escape') {
        this.callbacks.onTogglePause();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('blur', () => {
      for (const k in this.keys) {
        this.keys[k] = false;
      }
    });

    const handlePointer = (e: PointerEvent) => {
      this.callbacks.onUnlockAudio();
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const normalizedY = this.isPortraitRotated
        ? (e.clientX - rect.left) / rect.width
        : (e.clientY - rect.top) / rect.height;

      this.lastPointerY = normalizedY * GAME_HEIGHT;
    };

    window.addEventListener('pointermove', handlePointer);
    window.addEventListener('pointerdown', handlePointer);
  }

  private lastPointerY: number | null = null;

  public pollPlayerMovement(playerPaddle: Paddle, dt: number): void {
    const keyDir1 = (this.keys['KeyS'] ? 1 : 0) - (this.keys['KeyW'] ? 1 : 0);
    const keyDir2 = (this.keys['ArrowDown'] ? 1 : 0) - (this.keys['ArrowUp'] ? 1 : 0);
    const combinedKeyDir = clamp(keyDir1 + keyDir2, -1, 1);

    if (combinedKeyDir !== 0) {
      playerPaddle.setTargetY(playerPaddle.targetY + combinedKeyDir * PADDLE_SPEED * dt);
      this.lastPointerY = null; // Keyboard overrides pointer target
    } else if (this.lastPointerY !== null) {
      playerPaddle.setTargetY(this.lastPointerY);
    }
  }

  public clearPointer(): void {
    this.lastPointerY = null;
  }
}
