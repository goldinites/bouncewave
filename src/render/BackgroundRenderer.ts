import { COURT } from '@/match/config';
import { AudioSpectrum } from '@/render/backgrounds/AudioSpectrum';
import { Background, BackgroundMood } from '@/render/backgrounds/Background';
import { HyperspaceBackground } from '@/render/backgrounds/HyperspaceBackground';
import { LaserBackground } from '@/render/backgrounds/LaserBackground';
import { MemphisBackground } from '@/render/backgrounds/MemphisBackground';
import { OutrunBackground } from '@/render/backgrounds/OutrunBackground';
import { clamp } from '@/shared/math';

// Dark tint over the background so the court reads clearly on top of it
const OVERLAY_TINT_RGB = '10, 2, 32';

/** Every background the game rotates through; add new ones here. */
const createBackgrounds = (): Background[] => [
  new LaserBackground(),
  new MemphisBackground(),
  new OutrunBackground(),
  new HyperspaceBackground(),
];

/** Picks the active background, feeds it the music analysis and the game's mood. */
export class BackgroundRenderer {
  private readonly spectrum = new AudioSpectrum();
  private readonly backgrounds: Background[];
  private backgroundIndex: number;
  private lastTime: number | null = null;

  constructor(backgrounds: Background[] = createBackgrounds()) {
    this.backgrounds = backgrounds;
    this.backgroundIndex = Math.floor(Math.random() * backgrounds.length);
  }

  /** Switches to the next background (on every return to the menu). */
  public nextBackground(): void {
    this.backgroundIndex = (this.backgroundIndex + 1) % this.backgrounds.length;
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
  ): void {
    this.spectrum.update(analyser);
    const pulse = this.spectrum.getPulse(shake);

    const dt = this.lastTime === null ? 0 : clamp(time - this.lastTime, 0, 0.1);
    this.lastTime = time;
    const heat = Math.max(mood.climax, mood.celebration);
    this.backgrounds.forEach((background) => background.advance?.(dt, pulse, heat));

    const background = this.backgrounds[this.backgroundIndex];
    background.render({ ...mood, ctx, spectrum: this.spectrum, pulse, time, isRotated });

    ctx.fillStyle = `rgba(${OVERLAY_TINT_RGB}, ${background.overlayTint})`;
    ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);
  }
}
