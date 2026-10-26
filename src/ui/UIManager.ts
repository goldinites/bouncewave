import { ComponentChild, render } from 'preact';
import { I18nManager } from '@/i18n/I18nManager';
import { getRequiredElement } from '@/ui/dom';
import { Look } from '@/shared/look';

const CSS_CLASSES = {
  GAME_UI_HIDDEN: 'game__ui--hidden',
  GAME_PAUSE_HIDDEN: 'game-pause--hidden',
} as const;

// Keys that move the focus through a menu's buttons, by how far they move it. Enter and Space
// press the focused button (the browser does that); Enter with no button focused picks the first
const MENU_KEYS: Record<string, 'previous' | 'next' | 'first' | 'last'> = {
  ArrowUp: 'previous',
  KeyW: 'previous',
  ArrowDown: 'next',
  KeyS: 'next',
  Home: 'first',
  End: 'last',
};

/** Button colors; all but the default cyan have a .game-button--<color> modifier in main.css. */
export type ButtonColor = 'cyan' | 'yellow' | 'pink' | 'purple' | 'green';

// A screen coming in: its first ITEMS rise RISE px into place over DURATION ms, STAGGER ms apart
const SCREEN_ENTER = { ITEMS: 8, RISE: 10, DURATION: 220, STAGGER: 30 } as const;

export class UIManager {
  private uiOverlay: HTMLElement;
  private titleElement: HTMLElement;
  private subtitleElement: HTMLElement;
  /** Where the Preact screen on show renders, under the title. */
  private screenElement: HTMLElement;
  /** Which screen is on show (as showScreen was told), to tell it redrawn from another. */
  private screenId: string | null = null;
  /** Runs before any click on the screen on show (it unlocks the audio). */
  private onScreenClick: (() => void) | null = null;
  /** Answers the menu keys' moves and the buttons pressed with their sounds. */
  public onMenuSound: ((sound: 'move' | 'select') => void) | null = null;
  private pauseButton: HTMLButtonElement;
  private i18n: I18nManager;
  /** The main menu's title, as index.html shows it before any script runs. */
  public readonly gameTitle: string;
  private readonly listeners = new AbortController();

  constructor(i18n: I18nManager) {
    this.i18n = i18n;

    this.uiOverlay = getRequiredElement<HTMLElement>('gameUI');
    this.titleElement = getRequiredElement<HTMLElement>('gameTitle');
    this.gameTitle = this.titleElement.textContent ?? '';
    this.subtitleElement = getRequiredElement<HTMLElement>('gameSubtitle');
    this.screenElement = getRequiredElement<HTMLElement>('gameScreen');
    this.pauseButton = getRequiredElement<HTMLButtonElement>('pauseButton');

    this.updateTexts();

    window.addEventListener('keydown', (e) => this.onKeyDown(e), {
      signal: this.listeners.signal,
    });
    // Captured, so it runs before the button's own action (which may start a match)
    this.screenElement.addEventListener(
      'click',
      (e) => {
        this.onScreenClick?.();
        // After the button's own action, which may have answered with a sound of its own (back,
        // a setting switched): a press says so only if nothing else did
        if ((e.target as Element | null)?.closest('button')) {
          queueMicrotask(() => this.onMenuSound?.('select'));
        }
      },
      { capture: true, signal: this.listeners.signal },
    );
  }

  /**
   * What the menu keys walk on the screen on show: its buttons and the other items it marks
   * `data-menu-item` (a quick match choice), but not the buttons switched off, nor those kept out
   * of the keyboard's way (a choice's arrows, which the left and right keys stand in for).
   */
  private get buttons(): HTMLElement[] {
    return [...this.screenElement.querySelectorAll<HTMLElement>('button, [data-menu-item]')].filter(
      (item) => !(item instanceof HTMLButtonElement && item.disabled) && item.tabIndex >= 0,
    );
  }

  /** Whether the keyboard focus is on the screen on show. */
  private get hasFocus(): boolean {
    return this.screenElement.contains(document.activeElement);
  }

  /** Arrows (or W and S), Home and End walk the open menu, wrapping around at either end. */
  private onKeyDown(e: KeyboardEvent): void {
    if (!this.isMenuVisible || e.altKey || e.ctrlKey || e.metaKey) return;

    const buttons = this.buttons;
    if (buttons.length === 0) return;

    const current = buttons.indexOf(document.activeElement as HTMLElement);
    const move = e.code === 'Enter' && current < 0 ? 'first' : MENU_KEYS[e.code];
    if (!move) return;

    // Arrows would otherwise scroll a menu taller than the court
    e.preventDefault();
    const last = buttons.length - 1;
    const target = {
      // From outside the menu, either arrow starts at the top
      previous: current < 0 ? 0 : current === 0 ? last : current - 1,
      next: current < 0 ? 0 : current === last ? 0 : current + 1,
      first: 0,
      last,
    }[move];
    buttons[target].focus();
    if (move !== 'first' || e.code !== 'Enter') this.onMenuSound?.('move');
  }

  /**
   * Shows a Preact screen under the title. Shown again (same `id`, by default its title), the
   * screen is updated in place, so the focus stays where it was; coming from another screen, the
   * focus moves to the first button that can be pressed, if it was on the screen before.
   */
  public showScreen(
    title: string,
    subtitle: string,
    screen: ComponentChild,
    onAnyClick?: () => void,
    id: string = title,
  ): void {
    const hadFocus = this.hasFocus;
    const isSameScreen = this.screenElement.hasChildNodes() && this.screenId === id;
    this.screenId = id;

    this.titleElement.textContent = title;
    this.subtitleElement.textContent = subtitle;
    this.onScreenClick = onAnyClick ?? null;
    // Another screen starts afresh: its components don't inherit the last one's state
    if (!isSameScreen) render(null, this.screenElement);
    render(screen, this.screenElement);

    if (hadFocus && !isSameScreen) {
      this.buttons[0]?.focus();
    }
    if (!isSameScreen) this.enter();
    this.reveal();
  }

  /** Takes the Preact screen down (its components unmount). */
  private closeScreen(): void {
    this.screenId = null;
    this.onScreenClick = null;
    render(null, this.screenElement);
  }

  /**
   * Another screen comes in (6.7): its subtitle and then each of its items rise into place in
   * turn, a few px and a fifth of a second each; not for a player who asked for less motion.
   */
  private enter(): void {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    // A screen in one box (a column of buttons) comes in by what the box holds
    const screen = this.screenElement;
    const root = screen.children.length === 1 ? screen.children[0] : screen;
    const items = [this.subtitleElement, ...root.children].slice(0, SCREEN_ENTER.ITEMS);
    items.forEach((item, i) => {
      if (typeof item.animate !== 'function') return;
      item.animate(
        [
          { opacity: 0, transform: `translateY(${SCREEN_ENTER.RISE}px)` },
          { opacity: 1, transform: 'none' },
        ],
        {
          duration: SCREEN_ENTER.DURATION,
          delay: i * SCREEN_ENTER.STAGGER,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          fill: 'backwards',
        },
      );
    });
  }

  private reveal(): void {
    document.body.style.cursor = 'default';
    this.uiOverlay.classList.remove(CSS_CLASSES.GAME_UI_HIDDEN);
  }

  public get isMenuVisible(): boolean {
    return !this.uiOverlay.classList.contains(CSS_CLASSES.GAME_UI_HIDDEN);
  }

  public hideMenu(): void {
    document.body.style.cursor = 'none';
    this.uiOverlay.classList.add(CSS_CLASSES.GAME_UI_HIDDEN);
  }

  public setPauseButtonVisibility(visible: boolean): void {
    this.pauseButton.classList.toggle(CSS_CLASSES.GAME_PAUSE_HIDDEN, !visible);
  }

  /** The menus' chrome in a look: the classic one flat monochrome, no neon border or glow. */
  public setLook(look: Look): void {
    document.body.classList.toggle('classic-mode', look === 'classic');
  }

  public bindPauseButton(onClick: () => void): void {
    this.pauseButton.onclick = onClick;
  }

  /** Detaches its listeners and takes the screen down. */
  public dispose(): void {
    this.listeners.abort();
    this.pauseButton.onclick = null;
    this.closeScreen();
  }

  /** The texts outside the menus, in the current language. */
  public updateTexts(): void {
    this.pauseButton.setAttribute('aria-label', this.i18n.t('pauseButton'));
  }
}
