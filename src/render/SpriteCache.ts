/** Area a sprite covers around its anchor point, in game units. */
export interface SpriteBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Sprite {
  image: HTMLCanvasElement;
  bounds: SpriteBounds;
}

// Plenty for every score, label and paddle at once; a full cache is simply dropped and rebuilt
const MAX_SPRITES = 96;

/**
 * Pre-rendered pieces of the scene, for anything drawn with shadowBlur that rarely changes.
 *
 * A canvas shadow is a Gaussian blur run on every draw call — the most expensive thing Canvas 2D
 * does, especially in Safari. A sprite pays for it once and is then a plain drawImage.
 *
 * Sprites are rendered at the canvas's current resolution, so they stay as sharp as direct
 * drawing; shadowBlur is in canvas pixels either way, so the glow comes out the same size. The
 * cache is dropped whenever that resolution changes or a web font finishes loading (text drawn
 * before it would keep the fallback font forever).
 */
export class SpriteCache {
  private readonly sprites = new Map<string, Sprite | null>();
  private scale = 1;
  private measureContext: CanvasRenderingContext2D | null | undefined;

  constructor() {
    document.fonts?.addEventListener?.('loadingdone', () => this.clear());
  }

  /** Canvas pixels per game unit; call once per frame before drawing. */
  public setScale(scale: number): void {
    if (scale === this.scale) return;
    this.scale = scale;
    this.clear();
  }

  public clear(): void {
    // Zero-sized, a canvas gives its memory back at once instead of whenever GC runs: iOS caps
    // the total canvas memory, and every resize drops all the sprites
    for (const sprite of this.sprites.values()) {
      if (!sprite) continue;
      sprite.image.width = 0;
      sprite.image.height = 0;
    }
    this.sprites.clear();
  }

  /**
   * Draws the sprite `key` with its anchor at (x, y) in the current transform, rendering it
   * first if needed. Draws `paint` directly instead when no offscreen canvas is available.
   * @param measure the sprite's bounds around the anchor; gets a context to measure text with
   *   and the canvas pixels per game unit
   * @param paint draws the sprite around the anchor at (0, 0)
   */
  public draw(
    ctx: CanvasRenderingContext2D,
    key: string,
    x: number,
    y: number,
    measure: (measureCtx: CanvasRenderingContext2D, scale: number) => SpriteBounds,
    paint: (spriteCtx: CanvasRenderingContext2D) => void,
  ): void {
    let sprite = this.sprites.get(key);
    if (sprite === undefined) {
      sprite = this.build(measure, paint);
      if (this.sprites.size >= MAX_SPRITES) this.clear();
      this.sprites.set(key, sprite);
    }

    if (!sprite) {
      ctx.save();
      ctx.translate(x, y);
      paint(ctx);
      ctx.restore();
      return;
    }

    const { left, top, width, height } = sprite.bounds;
    ctx.drawImage(sprite.image, x + left, y + top, width, height);
  }

  private build(
    measure: (measureCtx: CanvasRenderingContext2D, scale: number) => SpriteBounds,
    paint: (spriteCtx: CanvasRenderingContext2D) => void,
  ): Sprite | null {
    const measureCtx = this.getMeasureContext();
    if (!measureCtx) return null;

    const bounds = measure(measureCtx, this.scale);
    const image = document.createElement('canvas');
    image.width = Math.max(1, Math.ceil(bounds.width * this.scale));
    image.height = Math.max(1, Math.ceil(bounds.height * this.scale));

    const spriteCtx = image.getContext('2d');
    if (!spriteCtx) return null;

    spriteCtx.scale(image.width / bounds.width, image.height / bounds.height);
    spriteCtx.translate(-bounds.left, -bounds.top);
    paint(spriteCtx);
    return { image, bounds };
  }

  private getMeasureContext(): CanvasRenderingContext2D | null {
    if (this.measureContext === undefined) {
      this.measureContext = document.createElement('canvas').getContext('2d');
    }
    return this.measureContext;
  }
}

/** One cache for the whole scene; the renderer keeps its scale up to date. */
export const sprites = new SpriteCache();

/** Room around a shape for a shadowBlur of `glow` canvas pixels, in game units. */
export function glowMargin(glow: number, scale: number): number {
  // A canvas shadow fades out within about its blur value, in canvas pixels
  return (glow * 1.2) / scale + 2;
}

/**
 * Bounds of a line of text around its anchor, with room for a glow of `glow` canvas pixels.
 * @param align 'center' for textAlign center + textBaseline middle, 'left' for textAlign left
 *   on the alphabetic baseline
 */
export function measureText(
  measureCtx: CanvasRenderingContext2D,
  scale: number,
  text: string,
  font: string,
  glow: number,
  align: 'center' | 'left' = 'center',
): SpriteBounds {
  measureCtx.font = font;
  const textWidth = measureCtx.measureText(text).width;
  const fontSize = Number(/(\d+)px/.exec(font)?.[1] ?? 32);
  const margin = glowMargin(glow, scale) + 2;
  const width = textWidth + margin * 2;
  const height = fontSize * 1.4 + margin * 2;

  return align === 'center'
    ? { left: -width / 2, top: -height / 2, width, height }
    : { left: -margin, top: -fontSize * 1.1 - margin, width, height };
}

/** Text in one color with an optional glow, drawn the way measureText expects. */
export function paintText(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  color: string,
  glow: number,
  glowColor = color,
  align: 'center' | 'left' = 'center',
): void {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = align === 'center' ? 'middle' : 'alphabetic';
  ctx.fillStyle = color;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = glow;
  ctx.fillText(text, 0, 0);
}
