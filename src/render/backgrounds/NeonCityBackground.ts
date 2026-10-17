import { COURT } from '@/match/config';
import { Background, BackgroundFrame } from '@/render/backgrounds/Background';
import { mixHexColors, randomRange } from '@/shared/math';
import { COLORS } from '@/shared/palette';

// Night sky, cool at rest and hot at full climax or celebration — same heat language as Outrun
const SKY_COOL = ['#050118', '#1c0a45', '#5a1668'];
const SKY_HOT = ['#1a0628', '#6a0f4f', '#d0352f'];
// The sky gradient is rebuilt only when the heat moves by a step this size
const HEAT_STEPS = 40;

const STREET_LEVEL = 0.8; // share of the frame's height where the buildings stand
const STREET_COLOR = '#05010d';
const TILE_LENGTH = 1300; // px of skyline before it repeats as it scrolls past

interface SkylineLayer {
  seed: number;
  /** px/s the layer drifts left at rest; the far one slower, for parallax. */
  scrollSpeed: number;
  width: readonly [min: number, max: number];
  height: readonly [min: number, max: number];
  coolColor: string;
  hotColor: string;
  window: { width: number; height: number; stepX: number; stepY: number };
  /** Share of windows that are lit. */
  litShare: number;
  /** Opacity of a lit window at rest. */
  windowAlpha: number;
  /** Whether the rooftops carry the neon equalizer, antennas and street reflections. */
  isFront: boolean;
}

const LAYERS: readonly SkylineLayer[] = [
  {
    seed: 7,
    scrollSpeed: 5,
    width: [34, 72],
    height: [100, 215],
    coolColor: '#2b1460',
    hotColor: '#521550',
    window: { width: 2, height: 3, stepX: 7, stepY: 9 },
    litShare: 0.22,
    windowAlpha: 0.35,
    isFront: false,
  },
  {
    seed: 23,
    scrollSpeed: 16,
    width: [48, 112],
    height: [70, 225],
    coolColor: '#0c0420',
    hotColor: '#1c0420',
    window: { width: 3, height: 5, stepX: 9, stepY: 12 },
    litShare: 0.4,
    windowAlpha: 0.7,
    isFront: true,
  },
];

// Mostly warm light, with the odd neon-lit office
const WINDOW_COLORS = [COLORS.YELLOW, COLORS.YELLOW, COLORS.CYAN, COLORS.PINK];
const ROOF_NEON_COLORS = [COLORS.CYAN, COLORS.PINK, COLORS.PURPLE];
const FLICKER_SHARE = 0.05; // windows that switch on and off on their own
const FLICKER_RATE = 0.4; // switches per second
const SPECTRUM_BARS = 16; // the front rooftops share this many analyzer bars
const ANTENNA_SHARE = 0.35;
const GAP_SHARE = 0.2;
const ANTENNA_BLINK_PERIOD = 1.6; // s
const ANTENNA_COLOR = mixHexColors(LAYERS[1].coolColor, COLORS.PURPLE, 0.3);
const REFLECTION_STREAKS = 4;
// Neon on the rooftops without shadowBlur: a wide faint stroke under each one
const NEON_HALO = { WIDTH: 6, ALPHA: 0.3 } as const;

const STAR_COUNT = 40;
const RAIN = { COUNT: 70, SPEED: 0.9, SLANT: 0.18, LENGTH: 16, ALPHA: 0.16 } as const;
const CLIMAX_SPEEDUP = 2; // skyline and rain move up to (1 + this)× faster

// How far laserIntensity (full behind the menus, low during play) may dim the lights. A floor,
// not a straight multiply, so the city never goes dark, just calmer during play
const LIGHT_INTENSITY_FLOOR = 0.6;

// Victory/climax drop: lightning flashes the sky and every window lights up at once
const DROP_DURATION = 0.6;

interface Building {
  x: number;
  width: number;
  height: number;
  windowColor: string;
  neonColor: string;
  spectrumBar: number;
  hasAntenna: boolean;
  /** Fixed per-building salt for the window and antenna patterns. */
  salt: number;
  /**
   * Steady windows as (dx, dy, threshold) triples from the building's top-left corner, sorted
   * by threshold: a window is lit while its threshold is under the layer's lit share, so a
   * frame just walks the front of the list instead of hashing every window again.
   */
  windows: Float32Array;
  /** Windows that switch on and off on their own, as (dx, dy, id) triples. */
  flickers: Float32Array;
}

/** One skyline: its buildings, grouped by window color so each color is a single fill. */
interface Skyline {
  buildings: Building[];
  byWindowColor: { color: string; buildings: Building[] }[];
}

/** Where the street sits, and how wide/tall the scene is, in whichever space is "up" right now. */
interface Layout {
  width: number;
  height: number;
  streetY: number;
}

/** A small seeded PRNG (mulberry32), so the skyline is the same city on every visit. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable pseudo-random value in [0, 1) for a pair of integers. */
function hash(a: number, b: number): number {
  let h = Math.imul(a, 0x27d4eb2d) ^ Math.imul(b + 0x165667b1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Lays out a building's window grid once; which windows are lit is decided per frame. */
function buildWindows(
  layer: SkylineLayer,
  width: number,
  height: number,
  salt: number,
): Pick<Building, 'windows' | 'flickers'> {
  const { width: w, stepX, stepY } = layer.window;
  const columns = Math.floor((width - 4) / stepX);
  const rows = Math.floor((height - 10) / stepY);
  const left = (width - (columns - 1) * stepX - w) / 2;
  const steady: [dx: number, dy: number, threshold: number][] = [];
  const flickers: number[] = [];

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const id = row * 64 + column;
      const dx = left + column * stepX;
      const dy = 8 + row * stepY;
      if (hash(salt + 1, id) < FLICKER_SHARE) {
        flickers.push(dx, dy, id);
      } else {
        steady.push([dx, dy, hash(salt, id)]);
      }
    }
  }
  steady.sort((a, b) => a[2] - b[2]);
  return { windows: Float32Array.from(steady.flat()), flickers: Float32Array.from(flickers) };
}

function buildSkyline(layer: SkylineLayer): Skyline {
  const random = seededRandom(layer.seed);
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  const buildings: Building[] = [];

  for (let x = 0; x < TILE_LENGTH;) {
    const width = layer.width[0] + random() * (layer.width[1] - layer.width[0]);
    // Squared so most buildings are low and only a few tower over the rest
    const height = layer.height[0] + random() ** 2 * (layer.height[1] - layer.height[0]);
    const clippedWidth = Math.min(width, TILE_LENGTH - x);
    const windowColor = pick(WINDOW_COLORS);
    const neonColor = pick(ROOF_NEON_COLORS);
    const spectrumBar = Math.floor(random() * SPECTRUM_BARS);
    const hasAntenna = random() < ANTENNA_SHARE;
    const salt = Math.floor(random() * 1e6);
    buildings.push({
      x,
      width: clippedWidth,
      height,
      windowColor,
      neonColor,
      spectrumBar,
      hasAntenna,
      salt,
      ...buildWindows(layer, clippedWidth, height, salt),
    });
    // Now and then an alley opens a view onto the far skyline
    x += width + (random() < GAP_SHARE ? 20 + random() * 40 : random() * 6);
  }

  const byWindowColor = [...new Set(WINDOW_COLORS)].map((color) => ({
    color,
    buildings: buildings.filter((building) => building.windowColor === color),
  }));
  return { buildings, byWindowColor };
}

/**
 * A rainy synthwave night city: two skylines drifting past at different speeds, their windows
 * breathing with the beat, the front rooftops lit as a neon equalizer, and their glow smeared
 * across the wet street below.
 */
export class NeonCityBackground implements Background {
  public readonly scene = 'neonCity';
  public readonly overlayTint = 0.2;

  private readonly skylines = LAYERS.map(buildSkyline);
  private readonly scroll = LAYERS.map(() => Math.random() * TILE_LENGTH);
  /** Stars and raindrops in shares of the frame, so they fit either orientation. */
  private readonly stars = Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random(),
    y: Math.random() ** 1.5,
    phase: Math.random() * 10,
  }));
  private readonly rain = Array.from({ length: RAIN.COUNT }, () => ({
    x: Math.random(),
    y: Math.random(),
    speed: randomRange(0.8, 1.2),
  }));
  private dropAge = Infinity;
  private sky: { key: string; value: CanvasGradient } | null = null;
  private haze: { streetY: number; value: CanvasGradient } | null = null;

  public triggerDrop(): void {
    this.dropAge = 0;
  }

  /** Keeps the city drifting and the rain falling even while another background is shown. */
  public advance(dt: number, _pulse: number, heat: number): void {
    this.dropAge += dt;
    const speedup = 1 + heat * CLIMAX_SPEEDUP;

    LAYERS.forEach((layer, i) => {
      this.scroll[i] = (this.scroll[i] + dt * layer.scrollSpeed * speedup) % TILE_LENGTH;
    });

    for (const drop of this.rain) {
      drop.y += dt * RAIN.SPEED * drop.speed * speedup;
      drop.x -= dt * RAIN.SPEED * RAIN.SLANT * drop.speed * speedup;
      if (drop.y > 1) {
        drop.y -= 1;
        drop.x = Math.random();
      }
      if (drop.x < 0) drop.x += 1;
    }
  }

  public render(frame: BackgroundFrame): void {
    const { ctx, time, pulse, climax, celebration, laserIntensity, isRotated } = frame;
    const heat = Math.max(climax, celebration);
    const lights = LIGHT_INTENSITY_FLOOR + (1 - LIGHT_INTENSITY_FLOOR) * laserIntensity;
    const flash = this.dropAge < DROP_DURATION ? 1 - this.dropAge / DROP_DURATION : 0;

    ctx.save();
    const layout = this.applyOrientation(ctx, isRotated);

    ctx.fillStyle = this.getSky(ctx, heat, layout);
    ctx.fillRect(0, 0, layout.width, layout.streetY);
    this.renderStars(ctx, time, layout);
    this.renderHaze(ctx, heat, pulse, layout);

    ctx.fillStyle = STREET_COLOR;
    ctx.fillRect(0, layout.streetY, layout.width, layout.height - layout.streetY);

    LAYERS.forEach((layer, i) => {
      const visible = this.visibleBuildings(this.skylines[i].buildings, i, layout);
      this.renderSilhouettes(ctx, layer, visible, heat, layout);
      this.renderWindows(ctx, layer, i, time, pulse, lights, flash, layout);
      if (layer.isFront) {
        this.renderRooftops(ctx, visible, frame, heat, lights, layout);
      }
    });

    this.renderStreetGlow(ctx, heat, layout);
    this.renderRain(ctx, layout);

    if (flash > 0) {
      ctx.globalAlpha = flash * flash * 0.35;
      ctx.fillStyle = COLORS.WHITE;
      ctx.fillRect(0, 0, layout.width, layout.height);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  /**
   * Same trick as the Outrun sunset: on a portrait phone the stage is swept ‑90° in CSS, so the
   * canvas is pre-rotated the other way and its width and height swapped, keeping the sky up.
   */
  private applyOrientation(ctx: CanvasRenderingContext2D, isRotated: boolean): Layout {
    const width = isRotated ? COURT.HEIGHT : COURT.WIDTH;
    const height = isRotated ? COURT.WIDTH : COURT.HEIGHT;

    if (isRotated) {
      ctx.translate(COURT.WIDTH / 2, COURT.HEIGHT / 2);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-width / 2, -height / 2);
    }

    return { width, height, streetY: Math.round(height * STREET_LEVEL) };
  }

  /** Sky gradient down to the street; cached per heat step and orientation. */
  private getSky(ctx: CanvasRenderingContext2D, heat: number, layout: Layout): CanvasGradient {
    const heatStep = Math.round(heat * HEAT_STEPS);
    const key = `${heatStep}|${layout.streetY}`;
    if (this.sky?.key === key) return this.sky.value;

    const value = ctx.createLinearGradient(0, 0, 0, layout.streetY);
    [0, 0.55, 1].forEach((stop, i) =>
      value.addColorStop(stop, mixHexColors(SKY_COOL[i], SKY_HOT[i], heatStep / HEAT_STEPS)),
    );
    this.sky = { key, value };
    return value;
  }

  private renderStars(ctx: CanvasRenderingContext2D, time: number, layout: Layout): void {
    const skyHeight = layout.streetY - LAYERS[0].height[1];

    ctx.fillStyle = COLORS.WHITE;
    for (const star of this.stars) {
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(time * 1.3 + star.phase);
      ctx.fillRect(star.x * layout.width, star.y * skyHeight, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  }

  /** City glow rising behind the skyline, brighter with the heat and the beat. */
  private renderHaze(
    ctx: CanvasRenderingContext2D,
    heat: number,
    pulse: number,
    layout: Layout,
  ): void {
    const top = layout.streetY - LAYERS[1].height[1] * 1.2;
    if (this.haze?.streetY !== layout.streetY) {
      const value = ctx.createLinearGradient(0, top, 0, layout.streetY);
      value.addColorStop(0, 'rgba(255, 43, 214, 0)');
      value.addColorStop(1, 'rgba(255, 43, 214, 1)');
      this.haze = { streetY: layout.streetY, value };
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.18 + heat * 0.2 + pulse * 0.08;
    ctx.fillStyle = this.haze.value;
    ctx.fillRect(0, top, layout.width, layout.streetY - top);
    ctx.restore();
  }

  /** Those of `buildings` (from layer `i`) on screen right now, each with its x scrolled. */
  private visibleBuildings(buildings: Building[], i: number, layout: Layout): Building[] {
    const visible: Building[] = [];
    for (let start = -this.scroll[i]; start < layout.width; start += TILE_LENGTH) {
      for (const building of buildings) {
        const x = start + building.x;
        if (x + building.width > 0 && x < layout.width) {
          visible.push({ ...building, x });
        }
      }
    }
    return visible;
  }

  private renderSilhouettes(
    ctx: CanvasRenderingContext2D,
    layer: SkylineLayer,
    buildings: Building[],
    heat: number,
    layout: Layout,
  ): void {
    ctx.fillStyle = mixHexColors(layer.coolColor, layer.hotColor, heat);
    ctx.beginPath();
    for (const { x, width, height } of buildings) {
      ctx.rect(x, layout.streetY - height, width, height);
    }
    ctx.fill();
  }

  /**
   * Lit windows, batched into one path per color. A few flicker on their own; the beat makes
   * them all breathe, and a victory drop lights every one of them.
   */
  private renderWindows(
    ctx: CanvasRenderingContext2D,
    layer: SkylineLayer,
    i: number,
    time: number,
    pulse: number,
    lights: number,
    flash: number,
    layout: Layout,
  ): void {
    const { width: w, height: h } = layer.window;
    const flickerTick = Math.floor(time * FLICKER_RATE);
    const litShare = layer.litShare + (1 - layer.litShare) * flash;

    ctx.save();
    ctx.globalAlpha = Math.min(1, (layer.windowAlpha + pulse * 0.25) * lights + flash * 0.3);
    for (const { color, buildings } of this.skylines[i].byWindowColor) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const building of this.visibleBuildings(buildings, i, layout)) {
        const top = layout.streetY - building.height;
        const { windows, flickers } = building;

        for (let k = 0; k < windows.length && windows[k + 2] < litShare; k += 3) {
          ctx.rect(building.x + windows[k], top + windows[k + 1], w, h);
        }
        for (let k = 0; k < flickers.length; k += 3) {
          if (hash(building.salt + 2, flickers[k + 2] + flickerTick) < 0.5) {
            ctx.rect(building.x + flickers[k], top + flickers[k + 1], w, h);
          }
        }
      }
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * The front rooftops as an equalizer: each one's neon edge glows with its own analyzer bar,
   * smeared across the wet street below; antennas blink red on top.
   */
  private renderRooftops(
    ctx: CanvasRenderingContext2D,
    buildings: Building[],
    { spectrum, time }: BackgroundFrame,
    heat: number,
    lights: number,
    layout: Layout,
  ): void {
    const { streetY, height: frameHeight } = layout;

    ctx.save();
    ctx.lineCap = 'round';
    for (const building of buildings) {
      const level = spectrum.getBarLevel(building.spectrumBar, SPECTRUM_BARS, time);
      const color = heat > 0.5 ? COLORS.PINK : building.neonColor;
      const roofY = streetY - building.height;
      const alpha = (0.4 + 0.6 * level) * lights;

      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(building.x + 2, roofY);
      ctx.lineTo(building.x + building.width - 2, roofY);
      ctx.globalAlpha = alpha * NEON_HALO.ALPHA;
      ctx.lineWidth = 2 + NEON_HALO.WIDTH;
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Wet-street reflection: broken streaks, fainter and further apart the nearer they get
      ctx.fillStyle = color;
      for (let k = 0; k < REFLECTION_STREAKS; k++) {
        const y = streetY + 5 + (k + 1) ** 2 * ((frameHeight - streetY) / 20);
        const wobble = Math.sin(time * 2 + building.salt + k) * 3;
        const streakWidth = building.width * (0.7 - k * 0.12);
        ctx.globalAlpha = alpha * 0.6 * (1 - k / REFLECTION_STREAKS);
        ctx.fillRect(
          building.x + (building.width - streakWidth) / 2 + wobble,
          y,
          streakWidth,
          2 + k,
        );
      }

      if (building.hasAntenna) {
        const antennaX = building.x + building.width * 0.7;
        const antennaTop = roofY - 18;
        ctx.globalAlpha = 1;
        ctx.strokeStyle = ANTENNA_COLOR;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(antennaX, roofY);
        ctx.lineTo(antennaX, antennaTop);
        ctx.stroke();

        const blink = (time + (building.salt % 100) / 60) % ANTENNA_BLINK_PERIOD;
        if (blink < ANTENNA_BLINK_PERIOD * 0.4) {
          ctx.fillStyle = '#ff3355';
          ctx.globalAlpha = 0.9 * lights;
          ctx.fillRect(antennaX - 1.5, antennaTop - 1.5, 3, 3);
        }
      }
    }
    ctx.restore();
  }

  /** A neon line along the curb, where the city meets its reflection. */
  private renderStreetGlow(ctx: CanvasRenderingContext2D, heat: number, layout: Layout): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = mixHexColors(COLORS.PURPLE, COLORS.PINK, heat);
    ctx.fillRect(0, layout.streetY - 1, layout.width, 3);
    ctx.restore();
  }

  /** Slanted rain streaks over the whole scene, one batched stroke. */
  private renderRain(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const { width, height } = layout;

    ctx.save();
    ctx.strokeStyle = COLORS.PURPLE;
    ctx.globalAlpha = RAIN.ALPHA;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const drop of this.rain) {
      const x = drop.x * width;
      const y = drop.y * height;
      ctx.moveTo(x, y);
      ctx.lineTo(x + RAIN.LENGTH * RAIN.SLANT, y - RAIN.LENGTH);
    }
    ctx.stroke();
    ctx.restore();
  }
}
