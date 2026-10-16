import { I18nManager } from '@/i18n/I18nManager';

const TITLE_ENTER_CLASS = 'now-playing__title--enter';

/**
 * The "now playing" chip in the top corner: the current song's title with a little
 * equalizer, and a tap target that turns the music on or off.
 */
export class NowPlaying {
  private readonly button: HTMLButtonElement;
  private readonly title: HTMLElement;
  private readonly i18n: I18nManager;
  /** What the chip last showed, so a frame that changes nothing leaves the DOM alone. */
  private shown: string | null = null;

  constructor(i18n: I18nManager, onToggle: () => void) {
    this.i18n = i18n;
    this.button = this.getRequiredElement<HTMLButtonElement>('nowPlaying');
    this.title = this.getRequiredElement<HTMLElement>('nowPlayingTitle');

    this.button.onclick = () => {
      onToggle();
      // Keyboard play goes on as before instead of Space or Enter re-pressing the chip
      this.button.blur();
    };
  }

  /**
   * Called every frame.
   * @param songTitle the song playing, or null when there is none to name (classic mode)
   */
  public update(songTitle: string | null, isMuted: boolean): void {
    const text = isMuted
      ? `${this.i18n.t('music')}: ${this.i18n.t('off')}`
      : (songTitle?.toUpperCase() ?? this.i18n.t('music'));
    const key = `${text}|${isMuted}`;
    if (key === this.shown) return;

    const isNewSong = this.shown !== null && !isMuted;
    this.shown = key;

    this.title.textContent = text;
    this.button.setAttribute('aria-pressed', String(!isMuted));
    this.button.setAttribute('aria-label', `${this.i18n.t('music')}: ${text}`);

    // Slide the new title in; the reflow in between restarts the animation
    if (isNewSong) {
      this.title.classList.remove(TITLE_ENTER_CLASS);
      void this.title.offsetWidth;
      this.title.classList.add(TITLE_ENTER_CLASS);
    }
  }

  public dispose(): void {
    this.button.onclick = null;
  }

  private getRequiredElement<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) {
      throw new Error(`Required DOM element with id "${id}" not found`);
    }
    return el as T;
  }
}
