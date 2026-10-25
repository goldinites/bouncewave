import { COURT } from '@/match/config';
import { AdaptiveResolution } from '@/render/AdaptiveResolution';
import { BackdropMood } from '@/render/BackdropMood';
import { BackgroundRenderer } from '@/render/BackgroundRenderer';
import { ClassicScene } from '@/render/ClassicScene';
import { FinalScoreSign } from '@/render/FinalScoreRenderer';
import { NeonScene } from '@/render/NeonScene';
import { RenderFrame, Scene, SceneState } from '@/render/scene';
import { sprites } from '@/render/SpriteCache';
import { Look } from '@/shared/look';
import { approach } from '@/shared/math';
import { BackgroundChoice, SceneId } from '@/shared/scenes';

// The scene dims behind the menus and the pause, easing in and out
const MENU_DIM = { ALPHA: 0.6, SPEED: 8.6 } as const;
// Screen shake fades exponentially, flash linearly (1/s)
const SHAKE_DECAY = 9;
const FLASH_DECAY = 3;
const CLIMAX_FLASH = 0.2; // soft flash when the climax peaks, no screen shake

// Sharpest canvas pixel ratio; phones report 3, which costs more fill rate than it shows
const MAX_PIXEL_RATIO = 2;
// The background is drawn at this share of the scene's resolution (about half the pixels), but
// never below one canvas pixel per CSS pixel unless the scene itself is
const BACKGROUND_RESOLUTION = 0.7;
// The offscreen canvases are rebuilt once the canvas has kept its size this long
const RESIZE_SETTLE_MS = 500;

// CSS effects on the stage at the end of a match; their animations live in main.css
const STAGE_CLASSES = {
  CRT_GLITCH: 'crt-glitch-active',
  VICTORY_BURST: 'victory-burst-active',
} as const;
type StageClass = (typeof STAGE_CLASSES)[keyof typeof STAGE_CLASSES];

/**
 * Draws the game on the canvas: fits it to the screen, keeps what lasts between frames (shake,
 * flash, the final score, the dimming, the backdrop's mood) and hands each frame to the look's
 * scene, the neon one built from layers or the classic one. Takes the feedback the effects ask for
 * (shake, flashes, surges, the stage's CSS effects), unless the look shows none.
 */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private resizeObserver: ResizeObserver;
  /** Set by the ResizeObserver; the canvas is refitted on the next frame, at most once. */
  private needsFit = false;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly resolution = new AdaptiveResolution(
    Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO),
  );

  private readonly background = new BackgroundRenderer();
  private readonly mood = new BackdropMood();
  private screenShake = 0;
  private screenFlash = 0;

  private finalSign: FinalScoreSign | null = null;
  private finalSignAge = 0;

  private menuDim: number = MENU_DIM.ALPHA;

  private stage: HTMLElement | null = null;
  /** Bumped on every stage effect, so a finishing older one never clears a newer one. */
  private stageEffectId = 0;

  /** How the game looks: the classic look draws its own flat scene and silences every flashy
   * feedback method below. */
  private look: Look = 'neon';
  private readonly looks: Record<Look, Scene>;
  /** What the scene draws with this frame; one object, filled anew each frame. */
  private readonly state: SceneState = {
    finalSign: null,
    finalSignAge: 0,
    menuDim: MENU_DIM.ALPHA,
    shake: 0,
    flash: 0,
    mood: { laserIntensity: 1, climax: 0, celebration: 0 },
    realDt: 0,
  };
  /**
   * The player asked the system for less motion: no screen shake, white flashes or camera zoom.
   * Read live, so changing the setting mid-game takes effect at once. The stage's CSS effects
   * honor the same setting in stage.css.
   */
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.stage = canvas.closest('#gameStage');

    // Opaque: every frame paints the whole canvas, so the page never has to be blended under it
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Canvas 2D context not supported');
    }

    this.ctx = context;
    this.looks = {
      neon: new NeonScene(context, this.background, () => this.reducedMotion.matches),
      classic: new ClassicScene(),
    };

    // Refitting reallocates the background layer and every sprite. An iPhone turning around
    // reports several sizes in a row, and iOS caps the memory all canvases share: after a few
    // quick turns an allocation fails, and drawing into or from that canvas silently does nothing
    // (no background or court, the picture smears) until the next resize. So the canvas is
    // refitted at most once a frame, and the offscreen canvases are built anew once it settles
    this.resizeObserver = new ResizeObserver(() => {
      this.needsFit = true;
      clearTimeout(this.settleTimer);
      this.settleTimer = setTimeout(() => this.rebuildOffscreen(), RESIZE_SETTLE_MS);
    });
    this.resizeObserver.observe(this.canvas);

    this.fitToDisplay();
  }

  public fitToDisplay(): void {
    const ratio = this.resolution.pixelRatio;
    const width = Math.round(this.canvas.clientWidth * ratio);
    const height = Math.round(this.canvas.clientHeight * ratio);

    // Assigning a size reallocates the canvas even when it is the same one
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;

    this.scale = this.canvas.width / COURT.WIDTH;

    const backgroundRatio = Math.max(Math.min(ratio, 1), ratio * BACKGROUND_RESOLUTION);
    this.background.setScale((this.scale * backgroundRatio) / ratio);
  }

  /** Reallocates the background layer and the sprites, in case iOS failed to during a resize. */
  private rebuildOffscreen(): void {
    sprites.clear();
    this.background.rebuildLayer();
  }

  /** Canvas pixels per CSS pixel, lowered while frames are slow. */
  public get pixelRatio(): number {
    return this.resolution.pixelRatio;
  }

  /**
   * Feeds the wall-clock time of the last frame to the dynamic resolution.
   * @returns true when the canvas resolution changed
   */
  public trackFrameTime(frameMs: number): boolean {
    if (!this.resolution.tick(frameMs)) return false;
    this.fitToDisplay();
    return true;
  }

  /**
   * Plays a CSS effect on the stage. The class stays on until the animations it starts on the
   * stage (pseudo-elements included) have finished, so their durations live only in the CSS.
   * With reduced motion those animations are switched off and the class is removed at once.
   */
  private triggerStageEffect(className: StageClass): void {
    const stage = this.stage;
    if (!stage || !this.showsEffects) return;

    const id = ++this.stageEffectId;
    stage.classList.remove(STAGE_CLASSES.CRT_GLITCH, STAGE_CLASSES.VICTORY_BURST);
    // Reflow so re-adding the same class restarts its animations
    void stage.offsetWidth;
    stage.classList.add(className);

    const animations = (stage.getAnimations?.({ subtree: true }) ?? []).filter(
      (animation) =>
        animation.effect instanceof KeyframeEffect &&
        animation.effect.target === stage &&
        Number.isFinite(animation.effect.getComputedTiming().endTime),
    );

    Promise.all(animations.map((animation) => animation.finished)).then(
      () => {
        if (id === this.stageEffectId) stage.classList.remove(className);
      },
      () => {
        // Cancelled because a newer effect replaced the class
      },
    );
  }

  public triggerCrtGlitch(): void {
    this.triggerStageEffect(STAGE_CLASSES.CRT_GLITCH);
  }

  public triggerVictoryEffect(): void {
    this.triggerStageEffect(STAGE_CLASSES.VICTORY_BURST);
  }

  public addShake(amount: number): void {
    if (!this.showsEffects || this.reducedMotion.matches) return;
    this.screenShake = Math.max(this.screenShake, amount);
  }

  public addFlash(amount: number): void {
    if (!this.showsEffects || this.reducedMotion.matches) return;
    this.screenFlash = Math.max(this.screenFlash, amount);
  }

  /**
   * Soft accent when the climax peaks: a gentle laser swell and flash, no screen shake. The
   * backgrounds' bursts are kept for the victory celebration only.
   */
  public triggerClimaxSurge(): void {
    if (!this.showsEffects) return;
    this.mood.swell();
    this.addFlash(CLIMAX_FLASH);
  }

  /** Victory: lasers flare and sweep through hues, every background bursts in its own way. */
  public celebrate(): void {
    if (!this.showsEffects) return;
    this.mood.celebrate();
    this.background.triggerDrop();
  }

  /** The backdrop on screen. */
  public get scene(): SceneId {
    return this.background.scene;
  }

  /** Every backdrop there is a background for: the pickable ones, then the modes' own. */
  public get scenes(): SceneId[] {
    return this.background.scenes;
  }

  /**
   * Switches to another background (the match's own scene if it has one, else the chosen one,
   * if the player chose one), flicking through a few channels in static first (a plain cut with
   * reduced motion).
   * @param isAnimated false cuts straight over (the game opening on the chosen background)
   * @param scene the backdrop the match asks for (a challenge's); null for the player's
   * @returns the backdrop on screen now
   */
  public switchChannel(isAnimated = true, scene: SceneId | null = null): SceneId {
    return this.background.switchChannel(
      isAnimated && !this.reducedMotion.matches && this.showsEffects,
      scene,
    );
  }

  /** Puts the unknown channel in place of the background until the next switchChannel. */
  public showMystery(): void {
    this.background.showMystery();
  }

  /** Whether the unknown channel stands in for the background right now. */
  public get isShowingMystery(): boolean {
    return this.background.isShowingMystery;
  }

  /**
   * The menus' next backdrop dissolving in over the one on screen (5.13).
   * @returns the backdrop on screen now
   */
  public dissolveBackground(): SceneId {
    return this.background.dissolve();
  }

  /** Whether channels are flicking past in static right now, on the way to the match's. */
  public get isSurfing(): boolean {
    return this.background.isSurfing;
  }

  /** The player's choice of background, which every switchChannel goes to from now on. */
  public chooseBackground(choice: BackgroundChoice): void {
    this.background.choose(choice === 'random' ? null : choice);
  }

  /**
   * For developers: shows `scene` and keeps it, matches included.
   * @returns false if there is no such background
   */
  public pinBackground(scene: SceneId): boolean {
    return this.background.pin(scene);
  }

  /** Draws the game in a look from now on: the classic one is flat black and white. */
  public setLook(look: Look): void {
    this.look = look;
  }

  /**
   * Whether the look shows the flashy feedback: shake, flashes, surges, particles, the stage's
   * effects, channels flicking over. The classic look shows none of it.
   */
  public get showsEffects(): boolean {
    return this.look === 'neon';
  }

  public showFinalScore(sign: FinalScoreSign): void {
    this.finalSign = sign;
    this.finalSignAge = 0;
  }

  public hideFinalScore(): void {
    this.finalSign = null;
    this.mood.calm();
  }

  /** Advances time-based effects (shake, flash, the backdrop's mood). Not called while paused. */
  public update(dt: number, frame: RenderFrame): void {
    const { gameState, serveTime } = frame.court;
    this.mood.update(dt, gameState, serveTime, frame.drama.climax);
    this.finalSignAge += dt;
    this.screenShake *= Math.exp(-dt * SHAKE_DECAY);
    this.screenFlash = Math.max(0, this.screenFlash - dt * FLASH_DECAY);
  }

  /**
   * Draws the frame. `realDt` is wall-clock time since the last frame, paused frames
   * included, for the few things that keep moving behind the pause menu.
   */
  public render(frame: RenderFrame, realDt: number): void {
    if (this.needsFit) {
      this.needsFit = false;
      this.fitToDisplay();
    }

    // A canvas laid out at no size (hidden, or caught mid-layout) has nothing to draw on, and a
    // zero scale would size the sprites' glow margins at infinity, so their canvases at zero
    if (this.canvas.width === 0 || this.canvas.height === 0) return;

    const dimTarget = frame.court.gameState === 'play' ? 0 : MENU_DIM.ALPHA;
    this.menuDim = approach(this.menuDim, dimTarget, MENU_DIM.SPEED, realDt);

    // Reset transform for high-DPI displays
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    sprites.setScale(this.scale);

    const { state } = this;
    state.finalSign = this.finalSign;
    state.finalSignAge = this.finalSignAge;
    state.menuDim = this.menuDim;
    state.shake = this.screenShake;
    state.flash = this.screenFlash;
    state.mood = this.mood.current(frame.drama.climax);
    state.realDt = realDt;
    this.looks[this.look].render(this.ctx, frame, state);
  }

  public dispose(): void {
    this.resizeObserver.disconnect();
    clearTimeout(this.settleTimer);

    this.stageEffectId++;
    this.stage?.classList.remove(STAGE_CLASSES.CRT_GLITCH, STAGE_CLASSES.VICTORY_BURST);
  }
}
