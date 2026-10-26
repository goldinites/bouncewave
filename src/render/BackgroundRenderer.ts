import { COURT } from '@/match/config';
import { AudioSpectrum } from '@/render/backgrounds/AudioSpectrum';
import { Background, BackgroundMood } from '@/render/backgrounds/Background';
import { BrokenNetBackground } from '@/render/backgrounds/BrokenNetBackground';
import { DojoBackground } from '@/render/backgrounds/DojoBackground';
import { FujiBackground } from '@/render/backgrounds/FujiBackground';
import { LaserBackground } from '@/render/backgrounds/LaserBackground';
import { MysteryBackground } from '@/render/backgrounds/MysteryBackground';
import { NeonCityBackground } from '@/render/backgrounds/NeonCityBackground';
import { RangeBackground } from '@/render/backgrounds/RangeBackground';
import { WarehouseBackground } from '@/render/backgrounds/WarehouseBackground';
import { CHANNEL_SURF } from '@/shared/channelSurf';
import { clamp } from '@/shared/math';
import { isPickableScene, SceneId } from '@/shared/scenes';

// The share of its dark veil a backdrop sheds on a full beat (6.5)
const BEAT_BREATH = 0.25;
// Dark tint over the background so the court reads clearly on top of it
const OVERLAY_TINT_RGB = '10, 2, 32';

// Static while the channels flick past: bright bands torn across the picture, which rolls
// a little at every switch
const STATIC = { BANDS: 14, BAND_HEIGHT: [2, 14], ROLL: 28, DIM: 0.35 } as const;
const STATIC_COLORS = ['rgb(255, 255, 255)', 'rgb(25, 240, 255)', 'rgb(255, 43, 214)'] as const;

// The menus' backdrops giving way one to the next (5.13): the last frame of the old one, still,
// melting over the new one as it plays, so a frame never draws two backgrounds
export const DISSOLVE = { DURATION: 3 } as const; // s

interface Dissolve {
  /** Seconds since it began. */
  age: number;
  /** The old backdrop's last frame, as the layer held it. */
  frame: HTMLCanvasElement;
}

interface Surf {
  /** Seconds since it began. */
  age: number;
  /** Background indices shown in turn, the last one the one that stays. */
  channels: number[];
  /** Seconds the static takes to clear on the last one. */
  settle: number;
  /** Whether it tunes to the unknown channel, which the last one stands for. */
  toMystery?: boolean;
}

/**
 * Every background there is; add new ones here. The quick match rotates through the pickable
 * ones; a mode's own (a challenge's) is shown only when a match asks for it.
 */
const createBackgrounds = (): Background[] => [
  new LaserBackground(),
  new NeonCityBackground(),
  new FujiBackground(),
  new WarehouseBackground(),
  new DojoBackground(),
  new BrokenNetBackground(),
  new RangeBackground(),
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
  private readonly random: () => number;
  /** Background indices still to come before the deck is shuffled again; the next is last. */
  private deck: number[] = [];
  private surf: Surf | null = null;
  private dissolving: Dissolve | null = null;
  /** The canvas the old backdrop's last frame is copied into, kept so a dissolve makes no new one. */
  private still: HTMLCanvasElement | null = null;
  /** A developer pinned the background: it stays, matches included, and the deck sits idle. */
  private _isPinned = false;
  /** The background the player chose for their matches; null deals one from the deck. */
  private chosen: number | null = null;
  /** Stands in for "random" behind the quick match's setup; never dealt for a match. */
  private readonly mystery = new MysteryBackground();
  private _isShowingMystery = false;
  private lastTime: number | null = null;

  private layer: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
  private layerScale = 0;
  /**
   * The backgrounds a quick match may get, by index: the pickable ones. The challenges' own are
   * shown only when a match asks for them by name, never dealt nor flicked past.
   */
  private readonly pickable: number[];

  constructor(backgrounds: Background[] = createBackgrounds(), random: () => number = Math.random) {
    this.backgrounds = backgrounds;
    this.random = random;
    this.pickable = backgrounds.flatMap((background, i) =>
      isPickableScene(background.scene) ? [i] : [],
    );
    this.backgroundIndex = this.pickable[Math.floor(random() * this.pickable.length)] ?? 0;
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

  /** Every backdrop there is a background for, in order. */
  public get scenes(): SceneId[] {
    return this.backgrounds.map((background) => background.scene);
  }

  /** The backdrop on screen. */
  public get scene(): SceneId {
    return this.backgrounds[this.backgroundIndex].scene;
  }

  /**
   * The player's choice of background for their matches, which switchChannel goes to from then
   * on; null for a different one each time.
   */
  public choose(scene: SceneId | null): void {
    const index = this.backgrounds.findIndex((background) => background.scene === scene);
    this.chosen = index < 0 ? null : index;
  }

  /**
   * Switches to another background (at the start of every match): the scene the match asks for
   * (a challenge's own), else the one the player chose, or else one dealt from a shuffled deck,
   * where every one comes up once before any comes up again, and never the same one twice
   * running. Already on the one it would switch to, it stays.
   * @param isAnimated flick through a few channels in static first; off, it just cuts over
   * @param scene the backdrop the match is to be played on; when there is no background for it
   *   (yet), the match gets the player's as if none were asked for
   * @returns the backdrop the match is played on
   */
  public switchChannel(isAnimated: boolean, scene: SceneId | null = null): SceneId {
    if (this._isPinned) return this.scene;
    const wasMystery = this._isShowingMystery;
    this._isShowingMystery = false;
    const previous = this.backgroundIndex;
    const asked = this.backgrounds.findIndex((background) => background.scene === scene);
    const target = asked >= 0 ? asked : this.chosen;
    // Already on it (and showing it, not the mystery): it stays
    if (target === previous && !wasMystery) return this.scene;
    // A cut or a surf takes over from a dissolve or a burst of static on its way
    this.dissolving = null;
    this.surf = null;
    this.backgroundIndex = target ?? this.deal();

    // Channels flicking past are the pickable ones, each unlike the one before, ending on the
    // match's own
    const others = this.pickable.length;
    if (isAnimated && others > 1) {
      const channels: number[] = [];
      let last = previous;
      for (let i = 1; i < CHANNEL_SURF.CHANNELS; i++) {
        const choices = this.pickable.filter((index) => index !== last);
        const next = choices[Math.floor(this.random() * choices.length)];
        channels.push(next);
        last = next;
      }
      if (last === this.backgroundIndex) channels.pop();
      channels.push(this.backgroundIndex);
      this.surf = { age: 0, channels, settle: CHANNEL_SURF.SETTLE };
    }
    return this.scene;
  }

  /**
   * Tunes straight to the backdrop the player chose, as the quick match's setup flicks between
   * them: one burst of static as its channel comes on, no channels flicking past first.
   * @returns the backdrop on screen now
   */
  public tune(): SceneId {
    const before = this.backgroundIndex;
    const wasMystery = this._isShowingMystery;
    const scene = this.switchChannel(false);
    if (this.backgroundIndex !== before || wasMystery) this.tuneIn(false);
    return scene;
  }

  /** One burst of static over the channel coming on: the backdrop's, or the unknown one. */
  private tuneIn(toMystery: boolean): void {
    this.surf = {
      age: 0,
      channels: [this.backgroundIndex],
      settle: CHANNEL_SURF.TUNE,
      toMystery,
    };
  }

  /**
   * Shows the unknown channel in place of the background (the player picked "random"), until
   * the next switchChannel deals a real one. Not over a developer's pin.
   * @param isTuned tuned to as the setup flicks to it: one burst of static as it comes on
   */
  public showMystery(isTuned = false): void {
    if (this._isPinned) return;
    const wasMystery = this._isShowingMystery;
    this._isShowingMystery = true;
    this.surf = null;
    this.dissolving = null;
    if (isTuned && !wasMystery) this.tuneIn(true);
  }

  /** Whether the unknown channel stands in for the background right now. */
  public get isShowingMystery(): boolean {
    return this._isShowingMystery;
  }

  /** Whether channels are flicking past in static right now, on the way to the match's. */
  public get isSurfing(): boolean {
    return this.surf !== null;
  }

  /** Whether a developer pinned the background on screen. */
  public get isPinned(): boolean {
    return this._isPinned;
  }

  /**
   * For developers: shows `scene` at once and keeps it, matches included.
   * @returns false if there is no such background
   */
  public pin(scene: SceneId): boolean {
    const index = this.backgrounds.findIndex((background) => background.scene === scene);
    if (index < 0) return false;
    this.backgroundIndex = index;
    this._isPinned = true;
    this.surf = null;
    this.dissolving = null;
    return true;
  }

  /** The next background off the deck, shuffling a new one when it runs out. */
  private deal(): number {
    if (this.deck.length === 0) {
      this.deck = [...this.pickable];
      for (let i = this.deck.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
      }
      // Where one deck meets the next, the one on screen doesn't come straight back
      const top = this.deck.length - 1;
      if (top > 0 && this.deck[top] === this.backgroundIndex) {
        [this.deck[0], this.deck[top]] = [this.deck[top], this.deck[0]];
      }
    }
    return this.deck.pop() ?? this.backgroundIndex;
  }

  /**
   * The menus' next backdrop, off the deck, dissolving in over the one on screen: its last frame
   * held still and melting away. Not over a developer's pin, the unknown channel, nor channels
   * flicking past; without a layer of its own to copy, the new one simply cuts in.
   * @returns the backdrop on screen now
   */
  public dissolve(): SceneId {
    if (this._isPinned || this._isShowingMystery || this.surf || this.pickable.length < 2) {
      return this.scene;
    }
    const next = this.deal();
    if (next === this.backgroundIndex) return this.scene;
    const layer = this.layer;
    if (layer) {
      const still = this.still ?? document.createElement('canvas');
      still.width = layer.canvas.width;
      still.height = layer.canvas.height;
      still.getContext('2d')?.drawImage(layer.canvas, 0, 0);
      this.still = still;
      this.dissolving = { age: 0, frame: still };
    }
    this.backgroundIndex = next;
    return this.scene;
  }

  /** Whether a backdrop is dissolving into the next right now. */
  public get isDissolving(): boolean {
    return this.dissolving !== null;
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
    beat: number | null = null,
    breathes = false,
  ): void {
    this.spectrum.update(analyser);
    const pulse = this.spectrum.getPulse(shake, beat);

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

    const surf = this.advanceSurf(dt);
    const isMystery = this._isShowingMystery && (!surf || this.surf?.toMystery);
    const background = isMystery
      ? this.mystery
      : this.backgrounds[surf?.channel ?? this.backgroundIndex];

    // At each switch the picture rolls down a little and settles, as an old set's would
    const roll = surf?.roll ?? 0;
    if (roll > 0) {
      target.fillStyle = '#000';
      target.fillRect(0, 0, COURT.WIDTH, roll);
      target.save();
      target.translate(0, roll);
    }
    background.render({ ...mood, ctx: target, spectrum: this.spectrum, pulse, time, isRotated });
    if (roll > 0) target.restore();

    // On every beat the dark veil over the backdrop lifts a little: the whole picture breathes with
    // the music in its own colours, in play too, when its lights are dimmed (not for less motion)
    const breath = breathes ? pulse * BEAT_BREATH : 0;
    target.fillStyle = `rgba(${OVERLAY_TINT_RGB}, ${background.overlayTint * (1 - breath)})`;
    target.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);
    if (surf) this.renderStatic(target, surf.noise);
    this.renderDissolve(target, dt);

    if (layer) {
      ctx.drawImage(layer.canvas, 0, 0, COURT.WIDTH, COURT.HEIGHT);
    }
  }

  /**
   * Moves the channel surf on by `dt`.
   * @returns what it shows this frame (which channel, how much static, how far rolled), or
   *   null once it is over
   */
  private advanceSurf(dt: number): { channel: number; noise: number; roll: number } | null {
    const surf = this.surf;
    if (!surf) return null;

    surf.age += dt;
    const { STEP } = CHANNEL_SURF;
    const last = surf.channels.length - 1;
    if (surf.age >= last * STEP + surf.settle) {
      this.surf = null;
      return null;
    }

    const step = Math.min(last, Math.floor(surf.age / STEP));
    // Static flares at every switch and fades through the step; on the last one it fades for good
    const sinceSwitch = surf.age - step * STEP;
    const fade = step < last ? sinceSwitch / STEP : sinceSwitch / surf.settle;
    const noise = (1 - fade) * (step < last ? 1 : 0.8);
    return { channel: surf.channels[step], noise, roll: (1 - fade) ** 2 * STATIC.ROLL };
  }

  /** The old backdrop's last frame over the new one, melting away with an ease out of it. */
  private renderDissolve(ctx: CanvasRenderingContext2D, dt: number): void {
    const dissolving = this.dissolving;
    if (!dissolving) return;
    dissolving.age += dt;
    const t = dissolving.age / DISSOLVE.DURATION;
    if (t >= 1) {
      this.dissolving = null;
      return;
    }
    ctx.save();
    ctx.globalAlpha = 1 - t * t * (3 - 2 * t);
    ctx.drawImage(dissolving.frame, 0, 0, COURT.WIDTH, COURT.HEIGHT);
    ctx.restore();
  }

  /** Static over the picture: a dim veil and bright bands torn across it, new every frame. */
  private renderStatic(ctx: CanvasRenderingContext2D, noise: number): void {
    if (noise <= 0) return;

    ctx.save();
    ctx.globalAlpha = noise * STATIC.DIM;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);

    const [low, high] = STATIC.BAND_HEIGHT;
    for (let i = 0; i < STATIC.BANDS; i++) {
      ctx.globalAlpha = noise * (0.2 + 0.5 * this.random());
      ctx.fillStyle = STATIC_COLORS[i % STATIC_COLORS.length];
      const height = low + this.random() * (high - low);
      ctx.fillRect(0, this.random() * COURT.HEIGHT, COURT.WIDTH, height);
    }
    ctx.restore();
  }
}
