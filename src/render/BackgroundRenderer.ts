import { COURT } from '@/match/config';
import { AudioSpectrum } from '@/render/backgrounds/AudioSpectrum';
import { Background, BackgroundMood } from '@/render/backgrounds/Background';
import { LaserBackground } from '@/render/backgrounds/LaserBackground';
import { MemphisBackground } from '@/render/backgrounds/MemphisBackground';
import { clamp } from '@/shared/math';

// Dark tint over the background so the court reads clearly on top of it
const OVERLAY_TINT_RGB = '10, 2, 32';
const OVERLAY_TINT_ALPHA = { laser: 0.15, memphis: 0.3 };

/** Picks the active background, feeds it the music analysis and the game's mood. */
export class BackgroundRenderer {
  private readonly spectrum = new AudioSpectrum();
  private readonly laser = new LaserBackground();
  private readonly memphis = new MemphisBackground();
  private readonly backgrounds: Background[] = [this.laser, this.memphis];
  private backgroundIndex = Math.floor(Math.random() * this.backgrounds.length);
  private lastTime: number | null = null;

  /** Switches to the other background (on every return to the menu). */
  public nextBackground(): void {
    this.backgroundIndex = (this.backgroundIndex + 1) % this.backgrounds.length;
  }

  /** Victory burst: Memphis shapes get thrown outward and ease back. */
  public triggerDrop(): void {
    this.memphis.triggerDrop();
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
    this.memphis.advance(dt, pulse, Math.max(mood.climax, mood.celebration));

    const background = this.backgrounds[this.backgroundIndex];
    background.render({ ...mood, ctx, spectrum: this.spectrum, pulse, time, isRotated });

    const tint = background === this.laser ? OVERLAY_TINT_ALPHA.laser : OVERLAY_TINT_ALPHA.memphis;
    ctx.fillStyle = `rgba(${OVERLAY_TINT_RGB}, ${tint})`;
    ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);
  }
}
