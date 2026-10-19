import { ReadonlySignal, signal } from '@preact/signals-core';
import { KonamiCode } from '@/easterEgg/KonamiCode';
import { TitleTaps } from '@/easterEgg/TitleTaps';
import { Look } from '@/shared/look';

/**
 * The classic look's easter egg: the Konami code, or on a phone five quick taps on the title,
 * switches the game into the classic look and back. Only from the main menu, so a match is never
 * swapped mid-play and a mode the classic look has no place for (a challenge, with its own
 * backdrop) is never on screen when it comes on.
 */
export class ClassicSwitch {
  private readonly current = signal<Look>('neon');
  /** The game's look; whatever follows it reads this. */
  public readonly look: ReadonlySignal<Look> = this.current;
  private readonly konamiCode: KonamiCode;
  private readonly titleTaps: TitleTaps | null;
  private readonly canSwitch: () => boolean;

  /**
   * @param canSwitch whether it may switch now (the main menu is on show)
   * @param title the title to tap, on a phone; null where the Konami code's keyboard is to hand
   */
  constructor(canSwitch: () => boolean, title: HTMLElement | null) {
    this.canSwitch = canSwitch;
    this.konamiCode = new KonamiCode(this.toggle);
    this.titleTaps = title ? new TitleTaps(title, this.toggle) : null;
  }

  private readonly toggle = (): void => {
    if (!this.canSwitch()) return;
    this.current.value = this.current.value === 'classic' ? 'neon' : 'classic';
  };

  public dispose(): void {
    this.konamiCode.dispose();
    this.titleTaps?.dispose();
  }
}
