import { COURT } from '@/match/config';
import { Background, BackgroundFrame } from '@/render/backgrounds/Background';
import { mixHexColors } from '@/shared/math';
import { COLORS } from '@/shared/palette';

// The second tier of the challenges (docs/CHALLENGES.md): an exam of mastery in a martial arts
// hall at night. Shoji glowing violet with bamboo shadows swaying on them, paper lanterns, tatami,
// and in the alcove a scroll reading 試練, "trial", framed in neon; the belts of every rank on a
// rack, a taiko drum that answers the beat. An interior, unlike Fuji's landscape

// Where things stand, as shares of the frame's height (or width), so either orientation fits
const LAYOUT = {
  BEAM: 0.11, // the lintel the lanterns hang from
  FLOOR: 0.7, // where the shoji meet the tatami
  ALCOVE: 0.24, // the alcove's width, in the middle of the wall
  // The scroll's room, below the HUD's condition line; it hangs in the middle of it, never taller
  // than SCROLL_HEIGHT, so on a tall portrait court it doesn't take over
  SCROLL_TOP: 0.38,
  SCROLL_BOTTOM: 0.67,
  SCROLL_HEIGHT: 140, // px at full scale
} as const;

const SHOJI = {
  COOL: '#2a1b55',
  HOT: '#4a1a50',
  PANEL: 92, // px between the sliding doors' frames
  ROWS: 5, // paper squares down a door
  COLUMNS: 3,
  FRAME: '#140826',
} as const;
const WOOD = { BEAM: '#1c0d2c', ALCOVE: '#120720', POST: '#170a26' } as const;
const PAPER = '#e9dcbe';
const INK = 'rgba(24, 8, 14, 0.92)';
// The kanji in a brush-like serif, with fallbacks for every platform the game runs on
const KANJI_FONT = "'Yu Mincho', 'Hiragino Mincho ProN', 'Noto Serif JP', 'MS Mincho', serif";
const FRAME_NEON = { WIDTH: 2.5, HALO: 7, HALO_ALPHA: 0.3 } as const;

const TATAMI = { NEAR: '#2b2412', FAR: '#3b3018', EDGE: 'rgba(0, 0, 0, 0.45)' } as const;
const LANTERN = {
  COUNT: 4,
  WIDTH: 26,
  HEIGHT: 34,
  CORD: 0.09, // share of the height from the lintel down to a lantern
  SWING: 0.07, // rad
  SWING_SPEED: 0.9, // rad/s of the swing's phase
  COLORS: ['#ffb347', COLORS.RED, '#ffb347', COLORS.RED],
} as const;
const BAMBOO = { STALKS: 7, SWAY: 4, SPEED: 0.5, ALPHA: 0.32 } as const;
const BELTS = ['#eeeeee', COLORS.YELLOW, '#ff9a3c', '#39c46a', '#3a6cff', '#7a3b14', '#0b0b0b'];
const DRUM = { SKIN: '#e8d6b0', BODY: '#5a1f1a', RIM: '#2a0e0c' } as const;
const SMOKE = { WISPS: 2, RISE: 0.06, ALPHA: 0.22 } as const; // shares of the height a second

// How far laserIntensity (full behind the menus, low during play) may dim the lanterns: a floor,
// so the hall stays lit, only calmer while the ball is in play
const LIGHT_INTENSITY_FLOOR = 0.6;
const DROP_DURATION = 0.7; // s the lanterns flare on a victory

interface Layout {
  width: number;
  height: number;
  beamY: number;
  floorY: number;
  scale: number;
}

export class DojoBackground implements Background {
  public readonly scene = 'dojo';
  public readonly overlayTint = 0.18;

  private readonly reducedMotion =
    typeof window === 'undefined' ? null : window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly lanternPhases = Array.from({ length: LANTERN.COUNT }, (_, i) => i * 1.9);
  private readonly bamboo = Array.from({ length: BAMBOO.STALKS }, (_, i) => ({
    x: (i + 0.3 + Math.random() * 0.4) / BAMBOO.STALKS,
    phase: Math.random() * Math.PI * 2,
    lean: (Math.random() - 0.5) * 0.08,
  }));
  private bambooTime = 0;
  private smokeTime = 0;
  private dropAge = Infinity;
  private gradients: { key: string; glow: CanvasGradient; floor: CanvasGradient } | null = null;

  public triggerDrop(): void {
    this.dropAge = 0;
  }

  private get isStill(): boolean {
    return this.reducedMotion?.matches ?? false;
  }

  /** Sways the lanterns and the bamboo and lifts the smoke, even while another is shown. */
  public advance(dt: number, _pulse: number, heat: number): void {
    this.dropAge += dt;
    if (this.isStill) return;
    for (let i = 0; i < LANTERN.COUNT; i++) {
      this.lanternPhases[i] += dt * LANTERN.SWING_SPEED * (1 + heat);
    }
    this.bambooTime += dt * BAMBOO.SPEED * (1 + heat);
    this.smokeTime += dt;
  }

  public render(frame: BackgroundFrame): void {
    const { ctx, pulse, climax, celebration, laserIntensity, isRotated } = frame;
    const heat = Math.max(climax, celebration);
    const drop = this.dropAge < DROP_DURATION ? 1 - this.dropAge / DROP_DURATION : 0;
    const lights = Math.min(
      1,
      LIGHT_INTENSITY_FLOOR + (1 - LIGHT_INTENSITY_FLOOR) * laserIntensity + drop * 0.5,
    );

    ctx.save();
    const layout = this.applyOrientation(ctx, isRotated);
    this.ensureGradients(ctx, layout);

    this.renderShoji(ctx, heat, layout);
    this.renderBamboo(ctx, layout);
    this.renderAlcove(ctx, pulse, heat, lights, layout);
    this.renderBeams(ctx, layout);
    this.renderBelts(ctx, layout);
    this.renderDrum(ctx, pulse, drop, layout);
    this.renderFloor(ctx, layout);
    this.renderLanterns(ctx, lights, drop, layout);
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
    return {
      width,
      height,
      beamY: Math.round(height * LAYOUT.BEAM),
      floorY: Math.round(height * LAYOUT.FLOOR),
      // Things sized for the landscape court shrink to fit a narrow portrait one
      scale: Math.min(1, width / COURT.WIDTH + 0.25),
    };
  }

  /** A lantern's glow and the floor's sheen: built once per orientation, then moved about. */
  private ensureGradients(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const key = `${layout.width}|${layout.floorY}`;
    if (this.gradients?.key === key) return;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    glow.addColorStop(0, 'rgba(255, 179, 71, 0.55)');
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    const floor = ctx.createLinearGradient(0, layout.floorY, 0, layout.height);
    floor.addColorStop(0, TATAMI.FAR);
    floor.addColorStop(1, TATAMI.NEAR);
    this.gradients = { key, glow, floor };
  }

  /** The sliding doors: violet paper lit from the night outside, a grid of frames over it. */
  private renderShoji(ctx: CanvasRenderingContext2D, heat: number, layout: Layout): void {
    const { width, beamY, floorY } = layout;
    ctx.fillStyle = mixHexColors(SHOJI.COOL, SHOJI.HOT, heat);
    ctx.fillRect(0, 0, width, floorY);

    ctx.strokeStyle = SHOJI.FRAME;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const doorHeight = floorY - beamY;
    for (let x = 0; x <= width; x += SHOJI.PANEL) {
      ctx.moveTo(x, beamY);
      ctx.lineTo(x, floorY);
      for (let c = 1; c < SHOJI.COLUMNS; c++) {
        const cx = x + (SHOJI.PANEL * c) / SHOJI.COLUMNS;
        ctx.moveTo(cx, beamY);
        ctx.lineTo(cx, floorY);
      }
    }
    for (let r = 1; r < SHOJI.ROWS; r++) {
      const y = beamY + (doorHeight * r) / SHOJI.ROWS;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  /** Bamboo outside, its shadow swaying on the paper: stalks and a few leaves, one dark stroke. */
  private renderBamboo(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const { width, beamY, floorY } = layout;
    ctx.save();
    ctx.globalAlpha = BAMBOO.ALPHA;
    ctx.strokeStyle = SHOJI.FRAME;
    ctx.lineCap = 'round';
    for (const stalk of this.bamboo) {
      const sway = Math.sin(this.bambooTime + stalk.phase) * BAMBOO.SWAY;
      const bottom = stalk.x * width;
      const top = bottom + stalk.lean * width + sway;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(bottom, floorY);
      ctx.lineTo(top, beamY);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let k = 1; k <= 3; k++) {
        const t = k / 4;
        const x = bottom + (top - bottom) * t;
        const y = floorY - (floorY - beamY) * t;
        const side = k % 2 ? 1 : -1;
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + side * 14, y - 8, x + side * 30 + sway, y - 4);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * The alcove in the middle of the wall: the scroll reading 試練 in its neon frame, which
   * brightens with the beat and the heat, and smoke rising from the incense under it.
   */
  private renderAlcove(
    ctx: CanvasRenderingContext2D,
    pulse: number,
    heat: number,
    lights: number,
    layout: Layout,
  ): void {
    const { width, height, beamY, floorY, scale } = layout;
    const alcove = width * LAYOUT.ALCOVE;
    const cx = width / 2;
    ctx.fillStyle = WOOD.ALCOVE;
    ctx.fillRect(cx - alcove / 2, beamY, alcove, floorY - beamY);
    ctx.fillStyle = WOOD.POST;
    ctx.fillRect(cx - alcove / 2 - 6, beamY, 6, floorY - beamY);
    ctx.fillRect(cx + alcove / 2, beamY, 6, floorY - beamY);

    const room = height * (LAYOUT.SCROLL_BOTTOM - LAYOUT.SCROLL_TOP);
    const scrollHeight = Math.min(room, LAYOUT.SCROLL_HEIGHT * scale);
    const top = height * LAYOUT.SCROLL_TOP + (room - scrollHeight) / 2;
    const bottom = top + scrollHeight;
    const scrollWidth = Math.min(alcove * 0.62, 78 * scale);
    // Paper and its wooden rods
    ctx.fillStyle = PAPER;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(cx - scrollWidth / 2, top, scrollWidth, bottom - top);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2a140a';
    ctx.fillRect(cx - scrollWidth / 2 - 4, top - 4, scrollWidth + 8, 5);
    ctx.fillRect(cx - scrollWidth / 2 - 4, bottom - 1, scrollWidth + 8, 5);
    // The two characters, stacked as a hanging scroll reads
    const size = Math.min(scrollWidth * 0.78, (bottom - top) * 0.36);
    ctx.font = `700 ${size}px ${KANJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = INK;
    const middle = (top + bottom) / 2;
    ctx.fillText('試', cx, middle - size * 0.55);
    ctx.fillText('練', cx, middle + size * 0.55);

    // The neon frame round it: the hall made over for the trial
    const glow = Math.min(1, (0.55 + 0.25 * pulse + 0.25 * heat) * lights);
    const margin = 10 * scale;
    ctx.strokeStyle = COLORS.PINK;
    ctx.beginPath();
    ctx.rect(
      cx - scrollWidth / 2 - margin,
      top - margin,
      scrollWidth + margin * 2,
      bottom - top + margin * 2,
    );
    ctx.globalAlpha = glow * FRAME_NEON.HALO_ALPHA;
    ctx.lineWidth = FRAME_NEON.WIDTH + FRAME_NEON.HALO;
    ctx.stroke();
    ctx.globalAlpha = glow;
    ctx.lineWidth = FRAME_NEON.WIDTH;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Incense: a small burner and thin wisps rising and fading
    const burnerY = floorY - 10;
    ctx.fillStyle = '#3a2416';
    ctx.fillRect(cx - 10, burnerY, 20, 10);
    ctx.save();
    ctx.strokeStyle = COLORS.PURPLE;
    ctx.lineWidth = 1.5;
    for (let w = 0; w < SMOKE.WISPS; w++) {
      ctx.globalAlpha = SMOKE.ALPHA;
      ctx.beginPath();
      ctx.moveTo(cx - 2 + w * 4, burnerY);
      const rise = (bottom - burnerY) * 0.9;
      for (let k = 1; k <= 8; k++) {
        const t = k / 8;
        const drift = Math.sin(this.smokeTime * 1.5 + t * 6 + w * 2) * 6 * t;
        ctx.lineTo(cx - 2 + w * 4 + drift, burnerY + rise * t);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The lintel overhead and the sill at the floor, dark wood across the wall. */
  private renderBeams(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const { width, beamY, floorY } = layout;
    ctx.fillStyle = WOOD.BEAM;
    ctx.fillRect(0, 0, width, beamY);
    ctx.fillRect(0, floorY - 8, width, 8);
  }

  /**
   * The belts of every rank folded on their rack, left of the alcove. They lie across, away from
   * the paddle's lane: upright strips by the paddle read as a second paddle.
   */
  private renderBelts(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const { width, floorY, scale } = layout;
    const left = width * 0.11;
    const length = width * 0.1;
    const step = 9 * scale;
    const top = floorY - 40 * scale - BELTS.length * step;
    ctx.fillStyle = '#2a140a';
    ctx.fillRect(left - 4, top - 4, 4, BELTS.length * step + 4);
    ctx.fillRect(left + length, top - 4, 4, BELTS.length * step + 4);
    ctx.globalAlpha = 0.75;
    BELTS.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(left, top + i * step, length, 5 * scale);
    });
    ctx.globalAlpha = 1;
  }

  /** A taiko drum on its stand, right of the alcove: its skin lights up on every beat. */
  private renderDrum(
    ctx: CanvasRenderingContext2D,
    pulse: number,
    drop: number,
    layout: Layout,
  ): void {
    const { width, floorY, scale } = layout;
    const cx = width * 0.86;
    const radius = 34 * scale;
    const cy = floorY - radius - 24 * scale;
    // The stand
    ctx.strokeStyle = WOOD.POST;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - radius, floorY);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + radius, floorY);
    ctx.stroke();
    // The body, then the skin facing us
    ctx.fillStyle = DRUM.BODY;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius * 1.05, radius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = DRUM.SKIN;
    ctx.globalAlpha = Math.min(1, 0.45 + 0.45 * pulse + drop * 0.4);
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = DRUM.RIM;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  /** Tatami toward the viewer: mats in perspective, their dark edges in one stroke. */
  private renderFloor(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const { width, height, floorY } = layout;
    ctx.fillStyle = this.gradients!.floor;
    ctx.fillRect(0, floorY, width, height - floorY);
    ctx.strokeStyle = TATAMI.EDGE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const cx = width / 2;
    for (let i = -6; i <= 6; i++) {
      ctx.moveTo(cx + i * width * 0.09, floorY);
      ctx.lineTo(cx + i * width * 0.24, height);
    }
    for (const t of [0.3, 0.65]) {
      const y = floorY + (height - floorY) * t;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  /**
   * Paper lanterns on their cords from the lintel: a warm glow round each, swaying (not with
   * reduced motion), flaring on a victory.
   */
  private renderLanterns(
    ctx: CanvasRenderingContext2D,
    lights: number,
    drop: number,
    layout: Layout,
  ): void {
    const { width, height, beamY, scale } = layout;
    const cord = height * LANTERN.CORD;
    const w = LANTERN.WIDTH * scale;
    const h = LANTERN.HEIGHT * scale;
    const anchors = [0.12, 0.33, 0.67, 0.88];
    ctx.save();
    anchors.forEach((share, i) => {
      const anchor = width * share;
      const angle = Math.sin(this.lanternPhases[i]) * LANTERN.SWING;
      const x = anchor + Math.sin(angle) * cord;
      const y = beamY + Math.cos(angle) * cord;

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.strokeStyle = SHOJI.FRAME;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(anchor, beamY);
      ctx.lineTo(x, y);
      ctx.stroke();

      // The glow round it, one cached gradient scaled to size
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, 0.5 * lights + drop * 0.5);
      ctx.fillStyle = this.gradients!.glow;
      ctx.save();
      ctx.translate(x, y + h / 2);
      ctx.scale(h * 2.2, h * 2.2);
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = Math.min(1, 0.7 + 0.3 * lights);
      ctx.fillStyle = LANTERN.COLORS[i];
      ctx.beginPath();
      ctx.ellipse(x, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Its ribs and its dark caps
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = WOOD.BEAM;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const t of [0.3, 0.5, 0.7]) {
        ctx.moveTo(x - (w / 2) * Math.sin(Math.PI * t), y + h * t);
        ctx.lineTo(x + (w / 2) * Math.sin(Math.PI * t), y + h * t);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = WOOD.BEAM;
      ctx.fillRect(x - w * 0.25, y - 2, w * 0.5, 4);
      ctx.fillRect(x - w * 0.25, y + h - 2, w * 0.5, 4);
    });
    ctx.restore();
  }
}
