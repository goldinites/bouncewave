import { I18nManager } from '@/i18n/I18nManager';
import { getRequiredElement } from '@/ui/dom';

const TITLE_ENTER_CLASS = 'now-playing__title--enter';
const CLASSIC_CLASS = 'now-playing--classic';
const IDLE_CLASS = 'now-playing--idle';
// Left alone this long, the chip fades back so it doesn't compete with the court
export const NOW_PLAYING_IDLE_MS = 5000;

export interface NowPlayingActions {
  onToggle: () => void;
  onNext: () => void;
}

/**
 * The "now playing" chip in the top corner: a record spinning while the music plays, the
 * current song's title, a tap on either to turn the music on or off, and a skip button.
 */
export class NowPlaying {
  private readonly chip: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private readonly title: HTMLElement;
  private readonly i18n: I18nManager;
  /** What the chip last showed, so a frame that changes nothing leaves the DOM alone. */
  private shown: string | null = null;
  private idleTimer: number | null = null;
  private isHovered = false;
  private readonly listeners = new AbortController();

  constructor(i18n: I18nManager, actions: NowPlayingActions) {
    this.i18n = i18n;
    this.chip = getRequiredElement<HTMLElement>('nowPlaying');
    this.toggle = getRequiredElement<HTMLButtonElement>('musicToggle');
    this.next = getRequiredElement<HTMLButtonElement>('nextTrack');
    this.title = getRequiredElement<HTMLElement>('nowPlayingTitle');

    // Blurred right away, so Space or Enter during play never re-presses a chip button
    this.toggle.onclick = () => {
      actions.onToggle();
      this.toggle.blur();
    };
    this.next.onclick = () => {
      actions.onNext();
      this.next.blur();
    };

    const { signal } = this.listeners;
    this.chip.addEventListener(
      'pointerenter',
      () => {
        this.isHovered = true;
        this.wake();
      },
      { signal },
    );
    this.chip.addEventListener(
      'pointerleave',
      () => {
        this.isHovered = false;
        this.wake();
      },
      { signal },
    );
    this.chip.addEventListener('pointerdown', () => this.wake(), { signal });
    this.chip.addEventListener('focusin', () => this.wake(), { signal });
    this.wake();
  }

  /** Brings the chip back to full view, and fades it again once it's left alone for a while. */
  public wake(): void {
    this.chip.classList.remove(IDLE_CLASS);
    if (this.idleTimer !== null) window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      this.idleTimer = null;
      // A pointer resting on it counts as looking at it
      if (this.isHovered) return;
      this.chip.classList.add(IDLE_CLASS);
    }, NOW_PLAYING_IDLE_MS);
  }

  /**
   * Called every frame.
   * @param songTitle the song playing, or null when there is none to name or skip (classic mode)
   */
  public update(songTitle: string | null, isMuted: boolean): void {
    const { i18n } = this;
    const text = isMuted
      ? `${i18n.t('music')}: ${i18n.t('off')}`
      : (songTitle?.toUpperCase() ?? i18n.t('music'));
    const key = `${text}|${isMuted}|${songTitle === null}|${i18n.language}`;
    if (key === this.shown) return;

    const isNewSong = this.shown !== null && !isMuted && !this.shown.startsWith(`${text}|`);
    // Something changed (a new song, music on or off): worth a look even if nobody touched it
    if (this.shown !== null) this.wake();
    this.shown = key;

    this.title.textContent = text;
    this.toggle.setAttribute('aria-pressed', String(!isMuted));
    this.toggle.setAttribute('aria-label', `${i18n.t('music')}: ${text}`);
    this.next.setAttribute('aria-label', i18n.t('next'));
    this.next.title = i18n.t('next');
    this.chip.classList.toggle(CLASSIC_CLASS, songTitle === null);

    // Slide the new title in; the reflow in between restarts the animation
    if (isNewSong) {
      this.title.classList.remove(TITLE_ENTER_CLASS);
      void this.title.offsetWidth;
      this.title.classList.add(TITLE_ENTER_CLASS);
    }
  }

  public dispose(): void {
    this.toggle.onclick = null;
    this.next.onclick = null;
    this.listeners.abort();
    if (this.idleTimer !== null) window.clearTimeout(this.idleTimer);
  }
}
