import { COURT } from '@/match/config';
import { Background, BackgroundFrame } from '@/render/backgrounds/Background';

// The tutorial's own backdrop (5.13): the Range, a training hall drawn as a blueprint. Of every
// backdrop it has the least going on, so a learner's eyes stay on the ball: a grid on dark
// tracing paper, rulers and crop marks, a centre line, and the ball's paths dotted across it
// one at a time, as a coach would sketch them, a slow scan passing down the sheet

const PAPER = { TOP: '#0a2550', BOTTOM: '#061634' } as const;
const INK = '170, 215, 255'; // rgb of the drawing's lines
const GRID = {
  MINOR: 20, // game units between the faint lines
  MAJOR: 100, // between the stronger ones
  MINOR_ALPHA: 0.07,
  MAJOR_ALPHA: 0.16,
  BEAT_ALPHA: 0.08, // the stronger lines brighten this much on a beat
} as const;
const RULER = { SHORT: 4, LONG: 10, ALPHA: 0.3 } as const; // ticks' lengths along the edges
const CROP = { INSET: 24, ARM: 18, ALPHA: 0.45 } as const; // the sheet's corner marks
const CENTRE_DASH = [18, 6, 3, 6];
// The ball's paths: drawn from one side to the other, bouncing off the margins, then faded
const PATH = {
  MARGIN: 40, // game units from the edges where a path bounces and ends
  BOUNCES: [1, 3], // walls hit on the way across
  DRAW: 2.4, // s to draw one across
  HOLD: 1.6, // s it stays drawn
  FADE: 1, // s to fade
  DASH: [6, 8],
  ALPHA: 0.4,
  MARK: 5, // half-size of the cross at each bounce
} as const;
const PATHS = 2; // drawn at once, out of step
const SCAN = { PERIOD: 9, HEIGHT: 70, ALPHA: 0.07 } as const; // s for the scan to pass down
const DROP_DURATION = 0.8; // s the drawing flares on a victory

interface Layout {
  width: number;
  height: number;
}

interface Path {
  points: { x: number; y: number }[];
  length: number;
  /** Seconds into its draw, hold and fade. */
  age: number;
}

const PATH_LIFE = PATH.DRAW + PATH.HOLD + PATH.FADE;

/** The Range: the tutorial's quiet blueprint hall. */
export class RangeBackground implements Background {
  public readonly scene = 'range' as const;
  public readonly overlayTint = 0.3;

  private readonly reducedMotion =
    typeof window === 'undefined' ? null : window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly random: () => number;
  private readonly paths: Path[] = [];
  private scanAge = 0;
  private dropAge = Infinity;
  private paper: { key: string; gradient: CanvasGradient } | null = null;
  /** The scan's band, soft at both edges: built once, then only moved down. */
  private scanBand: CanvasGradient | null = null;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  private get isStill(): boolean {
    return this.reducedMotion?.matches ?? false;
  }

  public triggerDrop(): void {
    this.dropAge = 0;
  }

  /** Draws the paths on and moves the scan down, even while another backdrop is shown. */
  public advance(dt: number, _pulse: number, heat: number): void {
    this.dropAge += dt;
    if (this.isStill) return;
    this.scanAge = (this.scanAge + dt) % SCAN.PERIOD;
    for (const path of this.paths) path.age += dt * (1 + heat);
  }

  public render(frame: BackgroundFrame): void {
    const { ctx, pulse, isRotated } = frame;
    const drop = this.dropAge < DROP_DURATION ? 1 - this.dropAge / DROP_DURATION : 0;
    ctx.save();
    const layout = this.applyOrientation(ctx, isRotated);

    ctx.fillStyle = this.paperGradient(ctx, layout);
    ctx.fillRect(0, 0, layout.width, layout.height);
    this.renderGrid(ctx, layout, pulse, drop);
    this.renderRulers(ctx, layout);
    this.renderCropMarks(ctx, layout);
    this.renderCentreLine(ctx, layout);
    this.renderPaths(ctx, layout);
    if (!this.isStill) this.renderScan(ctx, layout);
    ctx.restore();
  }

  /** As the other backgrounds: on a portrait phone the canvas is turned back, sides swapped. */
  private applyOrientation(ctx: CanvasRenderingContext2D, isRotated: boolean): Layout {
    const width = isRotated ? COURT.HEIGHT : COURT.WIDTH;
    const height = isRotated ? COURT.WIDTH : COURT.HEIGHT;
    if (isRotated) {
      ctx.translate(COURT.WIDTH / 2, COURT.HEIGHT / 2);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-width / 2, -height / 2);
    }
    return { width, height };
  }

  /** The tracing paper, darker at the foot: built once per orientation. */
  private paperGradient(ctx: CanvasRenderingContext2D, layout: Layout): CanvasGradient {
    const key = `${layout.width}|${layout.height}`;
    if (this.paper?.key !== key) {
      const gradient = ctx.createLinearGradient(0, 0, 0, layout.height);
      gradient.addColorStop(0, PAPER.TOP);
      gradient.addColorStop(1, PAPER.BOTTOM);
      this.paper = { key, gradient };
    }
    return this.paper.gradient;
  }

  /** Faint lines every few units, stronger ones every hundred, brightening on the beat. */
  private renderGrid(
    ctx: CanvasRenderingContext2D,
    { width, height }: Layout,
    pulse: number,
    drop: number,
  ): void {
    ctx.lineWidth = 1;
    for (const [step, alpha] of [
      [GRID.MINOR, GRID.MINOR_ALPHA],
      [GRID.MAJOR, GRID.MAJOR_ALPHA + GRID.BEAT_ALPHA * pulse + 0.2 * drop],
    ]) {
      ctx.strokeStyle = `rgba(${INK}, ${alpha})`;
      ctx.beginPath();
      for (let x = step; x < width; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = step; y < height; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    }
  }

  /** Ticks along the top and the foot, as a ruler's, longer every hundred units. */
  private renderRulers(ctx: CanvasRenderingContext2D, { width, height }: Layout): void {
    ctx.strokeStyle = `rgba(${INK}, ${RULER.ALPHA})`;
    ctx.beginPath();
    for (let x = GRID.MINOR; x < width; x += GRID.MINOR) {
      const tick = x % GRID.MAJOR === 0 ? RULER.LONG : RULER.SHORT;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, tick);
      ctx.moveTo(x, height);
      ctx.lineTo(x, height - tick);
    }
    ctx.stroke();
  }

  /** An L at each corner of the sheet, where it would be trimmed. */
  private renderCropMarks(ctx: CanvasRenderingContext2D, { width, height }: Layout): void {
    const { INSET, ARM } = CROP;
    ctx.strokeStyle = `rgba(${INK}, ${CROP.ALPHA})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [x, y, dx, dy] of [
      [INSET, INSET, 1, 1],
      [width - INSET, INSET, -1, 1],
      [INSET, height - INSET, 1, -1],
      [width - INSET, height - INSET, -1, -1],
    ]) {
      ctx.moveTo(x + dx * ARM, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * ARM);
    }
    ctx.stroke();
  }

  /** The drawing's centre line, dash and dot, across the middle. */
  private renderCentreLine(ctx: CanvasRenderingContext2D, { width, height }: Layout): void {
    ctx.strokeStyle = `rgba(${INK}, 0.18)`;
    ctx.lineWidth = 1;
    ctx.setLineDash(CENTRE_DASH);
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * The ball's paths, dotted on from one side to the other, a cross at each bounce, held a
   * moment and faded, a new one starting as each goes. Still, two stand fully drawn.
   */
  private renderPaths(ctx: CanvasRenderingContext2D, layout: Layout): void {
    // A path is laid out for the orientation it is drawn in; one from another is laid out anew
    while (this.paths.length < PATHS) this.paths.push(this.newPath(layout, this.paths.length));
    for (let i = 0; i < this.paths.length; i++) {
      const path = this.paths[i];
      const fits = path.points.every((p) => p.x <= layout.width && p.y <= layout.height);
      if (path.age >= PATH_LIFE || !fits) this.paths[i] = this.newPath(layout, 0);
    }

    ctx.lineWidth = 1.5;
    ctx.setLineDash(PATH.DASH);
    for (const path of this.paths) {
      const age = this.isStill ? PATH.DRAW : Math.max(0, path.age);
      const drawn = Math.min(1, age / PATH.DRAW) * path.length;
      const fade = Math.max(0, age - PATH.DRAW - PATH.HOLD) / PATH.FADE;
      const alpha = PATH.ALPHA * (1 - Math.min(1, fade));
      if (alpha <= 0 || drawn <= 0) continue;
      ctx.strokeStyle = `rgba(${INK}, ${alpha})`;
      this.strokeAlong(ctx, path, drawn);
    }
    ctx.setLineDash([]);
  }

  /** Strokes `path` up to `drawn` units along it, a cross at each bounce passed. */
  private strokeAlong(ctx: CanvasRenderingContext2D, path: Path, drawn: number): void {
    const { points } = path;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    let left = drawn;
    const passed: { x: number; y: number }[] = [];
    for (let i = 1; i < points.length && left > 0; i++) {
      const from = points[i - 1];
      const to = points[i];
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      const share = Math.min(1, left / length);
      ctx.lineTo(from.x + (to.x - from.x) * share, from.y + (to.y - from.y) * share);
      if (share === 1 && i < points.length - 1) passed.push(to);
      left -= length;
    }
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    for (const { x, y } of passed) {
      ctx.moveTo(x - PATH.MARK, y - PATH.MARK);
      ctx.lineTo(x + PATH.MARK, y + PATH.MARK);
      ctx.moveTo(x + PATH.MARK, y - PATH.MARK);
      ctx.lineTo(x - PATH.MARK, y + PATH.MARK);
    }
    ctx.stroke();
    ctx.setLineDash(PATH.DASH);
  }

  /**
   * A path across the sheet, side to side, bouncing off the margins a few times; the `index`-th
   * of those drawn at once starts that far out of step with the first.
   */
  private newPath({ width, height }: Layout, index: number): Path {
    const { MARGIN, BOUNCES } = PATH;
    const top = MARGIN;
    const bottom = height - MARGIN;
    const bounces = BOUNCES[0] + Math.floor(this.random() * (BOUNCES[1] - BOUNCES[0] + 1));
    const goesRight = this.random() < 0.5;
    const [startX, endX] = goesRight ? [MARGIN, width - MARGIN] : [width - MARGIN, MARGIN];
    const points = [{ x: startX, y: top + this.random() * (bottom - top) }];
    // The bounces take turns between the margins, as the ball's do between the walls
    const firstHigh = this.random() < 0.5;
    for (let i = 1; i <= bounces; i++) {
      points.push({
        x: startX + ((endX - startX) * i) / (bounces + 1),
        y: (i % 2 === 1) === firstHigh ? top : bottom,
      });
    }
    points.push({ x: endX, y: top + this.random() * (bottom - top) });
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return { points, length, age: -(index * PATH_LIFE) / PATHS };
  }

  /** A faint band of light passing slowly down the sheet, as a scanner's, soft at its edges. */
  private renderScan(ctx: CanvasRenderingContext2D, { width, height }: Layout): void {
    if (!this.scanBand) {
      const band = ctx.createLinearGradient(0, 0, 0, SCAN.HEIGHT);
      band.addColorStop(0, `rgba(${INK}, 0)`);
      band.addColorStop(0.5, `rgba(${INK}, ${SCAN.ALPHA})`);
      band.addColorStop(1, `rgba(${INK}, 0)`);
      this.scanBand = band;
    }
    const y = (this.scanAge / SCAN.PERIOD) * (height + SCAN.HEIGHT) - SCAN.HEIGHT;
    ctx.translate(0, y);
    ctx.fillStyle = this.scanBand;
    ctx.fillRect(0, 0, width, SCAN.HEIGHT);
    ctx.translate(0, -y);
  }
}
