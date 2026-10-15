import { AudioSpectrum } from '@/render/backgrounds/AudioSpectrum';

/** How the game feels right now; set by the renderer, read by every background. */
export interface BackgroundMood {
  /** Overall laser brightness, eased by the renderer (dim during play, full in menus). */
  laserIntensity: number;
  /** Rally climax in [0, 1]. */
  climax: number;
  /** Victory celebration in [0, 1]. */
  celebration: number;
}

/** What a background needs to draw one frame. */
export interface BackgroundFrame extends BackgroundMood {
  ctx: CanvasRenderingContext2D;
  spectrum: AudioSpectrum;
  /** Beat strength in [0, 1]. */
  pulse: number;
  time: number;
  isRotated: boolean;
}

/**
 * One animated backdrop behind the court. To add one, implement this and list it in
 * BackgroundRenderer; the optional hooks are only needed by backgrounds with their own motion.
 */
export interface Background {
  /** Share of dark tint drawn over this background so the court reads clearly on top. */
  readonly overlayTint: number;

  render(frame: BackgroundFrame): void;

  /**
   * Advances the background's own motion. Called every frame even while another background
   * is shown, so switching never makes it jump.
   * @param heat how lively it should be, in [0, 1] (rally climax or victory celebration)
   */
  advance?(dt: number, pulse: number, heat: number): void;

  /** Victory burst. */
  triggerDrop?(): void;
}
