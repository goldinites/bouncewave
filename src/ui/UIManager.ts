import { ComponentChild, render } from 'preact';
import { I18nManager } from '@/i18n/I18nManager';
import { getRequiredElement } from '@/ui/dom';

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

export interface MenuItem {
  label: string;
  action: () => void;
  /** Cyan when left out. */
  color?: ButtonColor;
  /** Makes the item a toggle, drawn filled while on; plain buttons leave it out. */
  isOn?: boolean;
}

export class UIManager {
  private uiOverlay: HTMLElement;
  private titleElement: HTMLElement;
  private subtitleElement: HTMLElement;
  private buttonsContainer: HTMLElement;
  /** Where a Preact screen renders, under the title in place of the buttons. */
  private screenElement: HTMLElement;
  /** Runs before any click on the screen on show, as `onAnyClick` does for menu buttons. */
  private onScreenClick: (() => void) | null = null;
  private hintElement: HTMLElement;
  private pauseButton: HTMLButtonElement;
  private i18n: I18nManager;
  private isCoarsePointer: boolean;
  /** The main menu's title, as index.html shows it before any script runs. */
  public readonly gameTitle: string;
  private readonly listeners = new AbortController();

  constructor(i18n: I18nManager) {
    this.i18n = i18n;

    this.uiOverlay = getRequiredElement<HTMLElement>('gameUI');
    this.titleElement = getRequiredElement<HTMLElement>('gameTitle');
    this.gameTitle = this.titleElement.textContent ?? '';
    this.subtitleElement = getRequiredElement<HTMLElement>('gameSubtitle');
    this.buttonsContainer = getRequiredElement<HTMLElement>('gameButtons');
    this.screenElement = getRequiredElement<HTMLElement>('gameScreen');
    this.hintElement = getRequiredElement<HTMLElement>('gameHint');
    this.pauseButton = getRequiredElement<HTMLButtonElement>('pauseButton');

    this.isCoarsePointer = window.matchMedia('(pointer:coarse)').matches;
    this.updateTexts();

    window.addEventListener('keydown', (e) => this.onKeyDown(e), {
      signal: this.listeners.signal,
    });
    // Captured, so it runs before the button's own action (which may start a match)
    this.screenElement.addEventListener('click', () => this.onScreenClick?.(), {
      capture: true,
      signal: this.listeners.signal,
    });
  }

  /**
   * The buttons of whatever is on show, a menu's or a screen's (only one has any), but those
   * switched off and those kept out of the keyboard's way (a choice's arrows, which the left and
   * right keys stand in for): the keys walk past them.
   */
  private get buttons(): HTMLButtonElement[] {
    return [
      ...this.buttonsContainer.querySelectorAll('button'),
      ...this.screenElement.querySelectorAll('button'),
    ].filter((button) => !button.disabled && button.tabIndex >= 0);
  }

  /** Whether the keyboard focus is on a menu's or a screen's button. */
  private get hasFocus(): boolean {
    const focused = document.activeElement;
    return this.buttonsContainer.contains(focused) || this.screenElement.contains(focused);
  }

  /** Arrows (or W and S), Home and End walk the open menu, wrapping around at either end. */
  private onKeyDown(e: KeyboardEvent): void {
    if (!this.isMenuVisible || e.altKey || e.ctrlKey || e.metaKey) return;

    const buttons = this.buttons;
    if (buttons.length === 0) return;

    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
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
  }

  public showMenu(
    title: string,
    subtitle: string,
    items: MenuItem[],
    onAnyClick?: () => void,
  ): void {
    // The buttons are rebuilt every time, so a keyboard player's focus would drop out of the
    // menu: put it back on the same button when the same menu is redrawn (a setting changed),
    // on the first one when it is another menu
    const focusedIndex = [...this.buttonsContainer.children].indexOf(
      document.activeElement as Element,
    );
    const wasOnScreen = this.screenElement.contains(document.activeElement);
    const isSameMenu = this.titleElement.textContent === title;

    this.closeScreen();
    this.titleElement.textContent = title;
    this.subtitleElement.textContent = subtitle;
    this.buttonsContainer.textContent = '';

    items.forEach((item) => {
      const btn = document.createElement('button');
      btn.className = 'game-button';
      if (item.color && item.color !== 'cyan') {
        btn.classList.add(`game-button--${item.color}`);
      }
      btn.textContent = item.label;
      if (item.isOn !== undefined) {
        btn.setAttribute('aria-pressed', String(item.isOn));
      }
      btn.onclick = () => {
        if (onAnyClick) onAnyClick();
        item.action();
      };
      this.buttonsContainer.appendChild(btn);
    });

    if (focusedIndex >= 0 || wasOnScreen) {
      const buttons = this.buttonsContainer.children;
      const target = isSameMenu ? Math.min(Math.max(0, focusedIndex), buttons.length - 1) : 0;
      (buttons[target] as HTMLElement | undefined)?.focus();
    }

    this.reveal();
  }

  /**
   * Shows a Preact screen under the title in place of a menu's buttons. Shown again (same
   * title), the screen is updated in place, so the focus stays where it was; coming from a menu
   * or another screen, the focus moves to the first button that can be pressed, if it was in
   * the menu.
   */
  public showScreen(
    title: string,
    subtitle: string,
    screen: ComponentChild,
    onAnyClick?: () => void,
  ): void {
    const hadFocus = this.hasFocus;
    const isSameScreen =
      this.screenElement.hasChildNodes() && this.titleElement.textContent === title;

    this.titleElement.textContent = title;
    this.subtitleElement.textContent = subtitle;
    this.buttonsContainer.textContent = '';
    this.onScreenClick = onAnyClick ?? null;
    render(screen, this.screenElement);

    if (hadFocus && !isSameScreen) {
      this.buttons[0]?.focus();
    }
    this.reveal();
  }

  /** Takes the Preact screen down (its components unmount), leaving the place to a menu. */
  private closeScreen(): void {
    this.onScreenClick = null;
    render(null, this.screenElement);
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

  /** The classic-mode easter egg: flat monochrome chrome, no neon border or button glow. */
  public setClassicMode(enabled: boolean): void {
    document.body.classList.toggle('classic-mode', enabled);
  }

  public bindPauseButton(onClick: () => void): void {
    this.pauseButton.onclick = onClick;
  }

  /** Detaches its listeners (menu buttons are rebuilt on every showMenu, so not theirs). */
  public dispose(): void {
    this.listeners.abort();
    this.pauseButton.onclick = null;
    this.buttonsContainer.textContent = '';
    this.closeScreen();
  }

  /** The texts outside the menus, in the current language. */
  public updateTexts(): void {
    this.hintElement.innerHTML = this.i18n.t(this.isCoarsePointer ? 'hintT' : 'hintK');
    this.pauseButton.setAttribute('aria-label', this.i18n.t('pauseButton'));
  }
}
