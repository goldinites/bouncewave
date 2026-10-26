// Bloom (6.6): what glows on the court (the paddles, the balls, the sparks) drawn again at 1/NEAR
// of the canvas's size, and that shrunk to 1/FAR, is a soft blur of it for free; added back as
// light, NEAR_ALPHA and FAR_ALPHA strong. Drawn afresh rather than read back off the frame, which
// would stall the canvas (~9 ms a frame on the bench)
const BLOOM = { NEAR: 6, FAR: 14, NEAR_ALPHA: 0.4, FAR_ALPHA: 0.3 } as const;
// A light CRT: a dark scanline every LINE canvas px, DARK strong, and the corners dimmed by
// VIGNETTE; the lines run across the screen however the court is turned
const CRT = { LINE: 3, DARK: 0.07, VIGNETTE: 0.28 } as const;
// Chromatic aberration on a big moment: red and cyan fringes split ALPHA strong
const ABERRATION = { ALPHA: 0.45 } as const;

/** What the post-processing draws this frame. */
export interface PostState {
  /** px the colours split by, on a big moment; 0 for none. */
  aberration: number;
  /** The court is turned (a phone held upright): the scanlines run across the canvas the other way. */
  isRotated: boolean;
}

/**
 * The neon look's finish over the court, under the screen's overlays: bloom, a light CRT and,
 * for a moment, chromatic aberration. Canvas 2D only (ROADMAP, stage 6): small offscreen canvases
 * drawn in and out, no filters, no pixel reads.
 */
export class PostEffects {
  private near: CanvasRenderingContext2D | null = null;
  private far: CanvasRenderingContext2D | null = null;
  private soft: CanvasRenderingContext2D | null = null;
  private split: CanvasRenderingContext2D | null = null;
  private scanlines: { pattern: CanvasPattern; isRotated: boolean } | null = null;
  /** Whether the glow has been drawn this frame, for `apply` to add. */
  private hasGlow = false;
  private vignette: { gradient: CanvasGradient; width: number; height: number } | null = null;

  /**
   * The bloom's canvas, cleared, for what glows to be drawn into in court units: its transform is
   * the frame's `scale` shrunk to the glow's size. Null when there is none to have.
   */
  public beginGlow(canvas: HTMLCanvasElement, scale: number): CanvasRenderingContext2D | null {
    const near = (this.near = fit(
      this.near,
      canvas.width / BLOOM.NEAR,
      canvas.height / BLOOM.NEAR,
    ));
    if (!near) return null;
    near.setTransform(1, 0, 0, 1, 0, 0);
    near.globalAlpha = 1;
    near.globalCompositeOperation = 'source-over';
    near.clearRect(0, 0, near.canvas.width, near.canvas.height);
    const shrink = near.canvas.width / canvas.width;
    near.setTransform(scale * shrink, 0, 0, scale * shrink, 0, 0);
    this.hasGlow = true;
    return near;
  }

  /** Draws the finish over what `ctx` holds now, in its canvas's pixels. */
  public apply(ctx: CanvasRenderingContext2D, state: PostState): void {
    const { width, height } = ctx.canvas;
    if (width === 0 || height === 0) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    if (state.aberration > 0) this.drawAberration(ctx, state.aberration);
    if (this.hasGlow) this.drawBloom(ctx);
    this.hasGlow = false;
    this.drawCrt(ctx, state.isRotated);
    ctx.restore();
  }

  private drawBloom(ctx: CanvasRenderingContext2D): void {
    const { width, height } = ctx.canvas;
    const sharp = this.near;
    if (!sharp) return;
    const near = (this.soft = fit(this.soft, sharp.canvas.width, sharp.canvas.height));
    const far = (this.far = fit(this.far, width / BLOOM.FAR, height / BLOOM.FAR));
    if (!near || !far) return;
    // Softened first: each pixel the mean of its four neighbours, so a glow a pixel or two across
    // here spreads round rather than into a square once stretched back up
    near.setTransform(1, 0, 0, 1, 0, 0);
    near.globalCompositeOperation = 'copy';
    near.globalAlpha = 0.25;
    near.drawImage(sharp.canvas, -1, 0);
    near.globalCompositeOperation = 'lighter';
    near.drawImage(sharp.canvas, 1, 0);
    near.drawImage(sharp.canvas, 0, -1);
    near.drawImage(sharp.canvas, 0, 1);
    near.globalAlpha = 1;
    far.globalCompositeOperation = 'copy';
    far.drawImage(near.canvas, 0, 0, far.canvas.width, far.canvas.height);

    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = BLOOM.NEAR_ALPHA;
    ctx.drawImage(near.canvas, 0, 0, width, height);
    ctx.globalAlpha = BLOOM.FAR_ALPHA;
    ctx.drawImage(far.canvas, 0, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawCrt(ctx: CanvasRenderingContext2D, isRotated: boolean): void {
    const { width, height } = ctx.canvas;
    if (!this.scanlines || this.scanlines.isRotated !== isRotated) {
      // One dark pixel in every LINE, down the canvas, or across it when the court is turned
      const line = document.createElement('canvas');
      line.width = isRotated ? CRT.LINE : 1;
      line.height = isRotated ? 1 : CRT.LINE;
      const lineCtx = line.getContext('2d');
      if (!lineCtx) return;
      lineCtx.fillStyle = `rgba(0, 0, 0, ${CRT.DARK})`;
      lineCtx.fillRect(0, 0, 1, 1);
      const pattern = ctx.createPattern(line, 'repeat');
      if (!pattern) return;
      this.scanlines = { pattern, isRotated };
    }
    ctx.fillStyle = this.scanlines.pattern;
    ctx.fillRect(0, 0, width, height);

    if (!this.vignette || this.vignette.width !== width || this.vignette.height !== height) {
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.45,
        width / 2,
        height / 2,
        Math.hypot(width, height) / 2,
      );
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(1, `rgba(0, 0, 0, ${CRT.VIGNETTE})`);
      this.vignette = { gradient, width, height };
    }
    ctx.fillStyle = this.vignette.gradient;
    ctx.fillRect(0, 0, width, height);
  }

  /** The picture's red and cyan pulled `px` apart, over the picture itself. */
  private drawAberration(ctx: CanvasRenderingContext2D, px: number): void {
    const { width, height } = ctx.canvas;
    const split = (this.split = fit(this.split, width, height));
    if (!split) return;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = ABERRATION.ALPHA;
    for (const [color, dx] of [
      ['#ff0000', px],
      ['#00ffff', -px],
    ] as const) {
      split.globalCompositeOperation = 'copy';
      split.drawImage(ctx.canvas, 0, 0);
      // Only that colour of the picture is kept
      split.globalCompositeOperation = 'multiply';
      split.fillStyle = color;
      split.fillRect(0, 0, width, height);
      ctx.drawImage(split.canvas, dx, 0);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** An offscreen canvas of `width` × `height` px (rounded up), reused while it still fits. */
function fit(
  current: CanvasRenderingContext2D | null,
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  if (current && current.canvas.width === w && current.canvas.height === h) return current;
  const canvas = current?.canvas ?? document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas.getContext('2d');
}
