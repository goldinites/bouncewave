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

export interface Background {
  render(frame: BackgroundFrame): void;
}
