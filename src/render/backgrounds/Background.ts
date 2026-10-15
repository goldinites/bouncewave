import { AudioSpectrum } from '@/render/backgrounds/AudioSpectrum';

/** What a background needs to draw one frame. */
export interface BackgroundFrame {
  ctx: CanvasRenderingContext2D;
  spectrum: AudioSpectrum;
  /** Beat strength in [0, 1]. */
  pulse: number;
  time: number;
  isRotated: boolean;
  /** Overall laser brightness, eased by the renderer (dim during play, full in menus). */
  laserIntensity: number;
  /** Rally climax in [0, 1]. */
  climax: number;
  /** Victory celebration in [0, 1]. */
  celebration: number;
}

export interface Background {
  render(frame: BackgroundFrame): void;
}
