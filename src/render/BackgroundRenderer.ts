import { COURT } from '@/match/config';
import { AudioSpectrum } from '@/render/backgrounds/AudioSpectrum';
import { Background, BackgroundMood } from '@/render/backgrounds/Background';
import { LaserBackground } from '@/render/backgrounds/LaserBackground';
import { MemphisBackground } from '@/render/backgrounds/MemphisBackground';
import { NeonCityBackground } from '@/render/backgrounds/NeonCityBackground';
import { OutrunBackground } from '@/render/backgrounds/OutrunBackground';
import { clamp } from '@/shared/math';
import { SceneId } from '@/shared/scenes';

// Dark tint over the background so the court reads clearly on top of it
const OVERLAY_TINT_RGB = '10, 2, 32';

/** Every background the game rotates through; add new ones here. */
const createBackgrounds = (): Background[] => [
  new LaserBackground(),
  new MemphisBackground(),
  new OutrunBackground(),
  new NeonCityBackground(),
];

/**
 * Picks the active background, feeds it the music analysis and the game's mood.
 *
 * Once given a scale it draws into a layer of its own at that resolution, copied onto the scene
 * in one drawImage: the backgrounds are soft and sit under a tint and the court, so a lower
 * resolution barely shows, while their full-screen gradients and glows are what eats the fill
 * rate. The copy is drawn under the scene's camera zoom like everything else.
 */
export class BackgroundRenderer {
  private readonly spectrum = new AudioSpectrum();
  private readonly backgrounds: Background[];
  private backgroundIndex: number;
  private lastTime: number | null = null;

  private layer: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
  private layerScale = 0;

  constructor(backgrounds: Background[] = createBackgrounds()) {
    this.backgrounds = backgrounds;
    this.backgroundIndex = Math.floor(Math.random() * backgrounds.length);
  }

  /**
   * Canvas pixels per game unit for the background layer; 0 (the default) draws the background
   * straight onto the scene instead.
   */
  public setScale(scale: number): void {
    if (scale === this.layerScale) return;
    this.layerScale = scale;

    if (scale <= 0) {
      this.layer = null;
      return;
    }

    const canvas = this.layer?.canvas ?? document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(COURT.WIDTH * scale));
    canvas.height = Math.max(1, Math.round(COURT.HEIGHT * scale));
    const ctx = canvas.getContext('2d', { alpha: false });
    this.layer = ctx ? { canvas, ctx } : null;
  }

  /** Reallocates the layer at its current scale (iOS may have failed to the last time). */
  public rebuildLayer(): void {
    if (this.layerScale <= 0) return;
    const scale = this.layerScale;
    this.layerScale = 0;
    this.setScale(scale);
  }

  /** The backdrop on screen. */
  public get scene(): SceneId {
    return this.backgrounds[this.backgroundIndex].scene;
  }

  /**
   * Switches to the next background (on every return to the menu).
   * @returns the backdrop now on screen
   */
  public nextBackground(): SceneId {
    this.backgroundIndex = (this.backgroundIndex + 1) % this.backgrounds.length;
    return this.scene;
  }

  /** Victory burst, for every background that has one. */
  public triggerDrop(): void {
    this.backgrounds.forEach((background) => background.triggerDrop?.());
  }

  public render(
    ctx: CanvasRenderingContext2D,
    analyser: AnalyserNode | null,
    time: number,
    shake: number,
    isRotated: boolean,
    mood: BackgroundMood,
  ): void {
    this.spectrum.update(analyser);
    const pulse = this.spectrum.getPulse(shake);

    const dt = this.lastTime === null ? 0 : clamp(time - this.lastTime, 0, 0.1);
    this.lastTime = time;
    const heat = Math.max(mood.climax, mood.celebration);
    this.backgrounds.forEach((background) => background.advance?.(dt, pulse, heat));

    const layer = this.layer;
    const target = layer?.ctx ?? ctx;
    if (layer) {
      const { width, height } = layer.canvas;
      target.setTransform(width / COURT.WIDTH, 0, 0, height / COURT.HEIGHT, 0, 0);
      target.globalAlpha = 1;
      target.globalCompositeOperation = 'source-over';
    }

    const background = this.backgrounds[this.backgroundIndex];
    background.render({ ...mood, ctx: target, spectrum: this.spectrum, pulse, time, isRotated });

    target.fillStyle = `rgba(${OVERLAY_TINT_RGB}, ${background.overlayTint})`;
    target.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);

    if (layer) {
      ctx.drawImage(layer.canvas, 0, 0, COURT.WIDTH, COURT.HEIGHT);
    }
  }
}
