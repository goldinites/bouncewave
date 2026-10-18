import { COURT } from '@/match/config';
import { BackgroundFrame } from '@/render/backgrounds/Background';
import { COLORS } from '@/shared/palette';
import { TWO_PI } from '@/shared/math';

const SKY = ['#1a0640', '#0b0320', '#05010d'] as const;
const HORIZON = 0.62; // share of the frame's height the floor starts at

const GRID = {
  ROWS: 12, // lines marching toward the viewer
  COLS: 14, // lines fanning out from the vanishing point
  SCROLL: 0.35, // loops of the floor per second
  SPREAD: 1.8, // how far the outer columns splay past the frame's edges
  COLOR: '255, 43, 214',
  ALPHA: 0.35,
} as const;

// The question mark: a neon tube, in units of its own height
const MARK = {
  HEIGHT: 0.7, // share of the frame's height: big enough to show around the menu over it
  BOB: 0.025, // share of its height it floats up and down by
  BOB_SPEED: 0.9, // radians per second
  TUBE: 0.075, // tube thickness
  GHOST_OFFSET: 0.025, // the cyan double, nudged aside like a misaligned old set
  PULSE_GLOW: 24, // extra glow (px) on a full beat
} as const;

// One light per backdrop the player might get, in each one's own color, circling the mark
const ORBIT = {
  COLORS: ['#19f0ff', '#ffe53b', '#ff2bd6', '#b79bff', '#ff5c7a', '#3dff8b'],
  RADIUS: 0.62, // of the mark's height
  TILT: 0.32, // the ring seen from slightly above
  SPEED: 0.6, // radians per second
  SIZE: 0.035, // of the mark's height
} as const;

// Now and then the picture glitches, as a channel with no signal would
const GLITCH = { EVERY: 3.2, LENGTH: 0.14, BANDS: 3, SHIFT: 26 } as const;

/**
 * The "random" choice behind the quick match's setup: an unknown channel. A neon question mark
 * floats over a synthwave floor, the six backdrops' colors circling it as lights, and the
 * picture glitches now and then. Never dealt for a match; it only stands in while the player has
 * picked "random", so they see that a backdrop will be drawn for them.
 */
export class MysteryBackground {
  public readonly overlayTint = 0.1;
  private readonly reducedMotion =
    typeof window === 'undefined' ? null : window.matchMedia('(prefers-reduced-motion: reduce)');

  public render(frame: BackgroundFrame): void {
    const { ctx, time, pulse, isRotated } = frame;
    const still = this.reducedMotion?.matches ?? false;
    const clock = still ? 0 : time;

    ctx.save();
    // Turned against the portrait stage's own turn, so the mark stands upright for the viewer
    const width = isRotated ? COURT.HEIGHT : COURT.WIDTH;
    const height = isRotated ? COURT.WIDTH : COURT.HEIGHT;
    if (isRotated) {
      ctx.translate(COURT.WIDTH / 2, COURT.HEIGHT / 2);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-width / 2, -height / 2);
    }

    this.renderSky(ctx, width, height);
    this.renderFloor(ctx, width, height, clock);

    const markHeight = height * MARK.HEIGHT;
    const centerX = width / 2;
    const centerY = height * 0.47 + Math.sin(clock * MARK.BOB_SPEED) * markHeight * MARK.BOB;
    this.renderOrbit(ctx, centerX, centerY, markHeight, clock, 'back');
    this.renderMark(ctx, centerX, centerY, markHeight, pulse);
    this.renderOrbit(ctx, centerX, centerY, markHeight, clock, 'front');
    ctx.restore();

    if (!still) this.renderGlitch(ctx, time);
  }

  private renderSky(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, SKY[0]);
    sky.addColorStop(HORIZON, SKY[1]);
    sky.addColorStop(1, SKY[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    // A thin glow along the horizon
    const horizonY = height * HORIZON;
    const glow = ctx.createLinearGradient(0, horizonY - 30, 0, horizonY + 6);
    glow.addColorStop(0, 'rgba(255, 43, 214, 0)');
    glow.addColorStop(1, 'rgba(255, 43, 214, 0.35)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, horizonY - 30, width, 36);
  }

  /** The floor: lines fanning from the vanishing point, rows sliding toward the viewer. */
  private renderFloor(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number,
  ): void {
    const horizonY = height * HORIZON;
    const depth = height - horizonY;
    ctx.save();
    ctx.lineWidth = 1.5;

    for (let i = 0; i <= GRID.COLS; i++) {
      const x = width / 2 + (i / GRID.COLS - 0.5) * width * GRID.SPREAD;
      ctx.strokeStyle = `rgba(${GRID.COLOR}, ${GRID.ALPHA})`;
      ctx.beginPath();
      ctx.moveTo(width / 2, horizonY);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    const scroll = (time * GRID.SCROLL) % 1;
    for (let i = 0; i < GRID.ROWS; i++) {
      // Rows bunch up toward the horizon, as the floor recedes
      const t = (i + scroll) / GRID.ROWS;
      const y = horizonY + depth * t * t;
      ctx.strokeStyle = `rgba(${GRID.COLOR}, ${GRID.ALPHA * t})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The question mark as a neon tube: a cyan double behind, the pink tube, a white core. */
  private renderMark(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    pulse: number,
  ): void {
    const tube = size * MARK.TUBE;
    const ghost = size * MARK.GHOST_OFFSET;
    const glow = 22 + pulse * MARK.PULSE_GLOW;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const passes: [dx: number, color: string, width: number, blur: number, alpha: number][] = [
      [-ghost, COLORS.CYAN, tube, glow, 0.55],
      [ghost * 0.5, COLORS.PINK, tube, glow, 1],
      [ghost * 0.5, COLORS.WHITE, tube * 0.35, 0, 0.9],
    ];
    for (const [dx, color, width, blur, alpha] of passes) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
      ctx.lineWidth = width;
      this.traceMark(ctx, x + dx, y, size);
    }
    ctx.restore();
  }

  /** The mark's hook and stem, stroked, and its dot, filled; centered on (x, y). */
  private traceMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const radius = size * 0.24;
    const top = y - size / 2;
    const hookY = top + radius;

    ctx.beginPath();
    // The hook: from its left end over the top and round to the right, curling back in
    ctx.arc(x, hookY, radius, Math.PI * 1.05, Math.PI * 0.45);
    // Down into the stem
    ctx.quadraticCurveTo(x, hookY + radius * 1.25, x, hookY + radius * 1.75);
    ctx.lineTo(x, y + size * 0.22);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y + size * 0.42, size * MARK.TUBE * 0.8, 0, TWO_PI);
    ctx.fill();
  }

  /** The six lights circling the mark; the half of the ring behind it is drawn first and dimmer. */
  private renderOrbit(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    time: number,
    half: 'back' | 'front',
  ): void {
    const count = ORBIT.COLORS.length;
    ctx.save();
    for (let i = 0; i < count; i++) {
      const angle = time * ORBIT.SPEED + (i / count) * TWO_PI;
      const depth = Math.sin(angle); // above 0: in front of the mark
      if (depth >= 0 !== (half === 'front')) continue;

      const lx = x + Math.cos(angle) * size * ORBIT.RADIUS;
      const ly = y + depth * size * ORBIT.RADIUS * ORBIT.TILT + size * 0.05;
      const scale = 0.75 + 0.25 * depth;
      ctx.globalAlpha = half === 'front' ? 1 : 0.45;
      ctx.fillStyle = ORBIT.COLORS[i];
      ctx.shadowColor = ORBIT.COLORS[i];
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(lx, ly, size * ORBIT.SIZE * scale, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * For a moment every few seconds, bands of the picture slide sideways, as on a channel with
   * no signal. Drawn over the whole canvas, in its own (unturned) frame.
   */
  private renderGlitch(ctx: CanvasRenderingContext2D, time: number): void {
    const phase = time % GLITCH.EVERY;
    if (phase > GLITCH.LENGTH) return;
    const strength = 1 - phase / GLITCH.LENGTH;
    const cycle = Math.floor(time / GLITCH.EVERY);

    ctx.save();
    for (let i = 0; i < GLITCH.BANDS; i++) {
      // Where the bands fall follows the cycle, not Math.random, so a frame redraws the same
      const seed = Math.sin((cycle + 1) * 12.9898 + i * 78.233) * 43758.5453;
      const r = seed - Math.floor(seed);
      const y = r * COURT.HEIGHT;
      const bandHeight = 6 + r * 18;
      ctx.globalAlpha = 0.35 * strength;
      ctx.fillStyle = i % 2 ? COLORS.CYAN : COLORS.PINK;
      ctx.fillRect((r - 0.5) * GLITCH.SHIFT, y, COURT.WIDTH, bandHeight);
    }
    ctx.restore();
  }
}
