import { I18nManager } from '@/i18n/I18nManager';
import { CSS_CLASSES } from '@/constants/game.constants';

export interface MenuItem {
  label: string;
  action: () => void;
}

export class UIManager {
  private uiOverlay: HTMLElement;
  private titleElement: HTMLElement;
  private subtitleElement: HTMLElement;
  private buttonsContainer: HTMLElement;
  private hintElement: HTMLElement;
  private pauseButton: HTMLButtonElement;
  private i18n: I18nManager;
  private isCoarsePointer: boolean;

  constructor(i18n: I18nManager) {
    this.i18n = i18n;

    this.uiOverlay = this.getRequiredElement<HTMLElement>('gameUI');
    this.titleElement = this.getRequiredElement<HTMLElement>('gameTitle');
    this.subtitleElement = this.getRequiredElement<HTMLElement>('gameSubtitle');
    this.buttonsContainer = this.getRequiredElement<HTMLElement>('gameButtons');
    this.hintElement = this.getRequiredElement<HTMLElement>('gameHint');
    this.pauseButton = this.getRequiredElement<HTMLButtonElement>('pauseButton');

    this.isCoarsePointer = window.matchMedia('(pointer:coarse)').matches;
    this.updateHint();
  }

  public showMenu(
    title: string,
    subtitle: string,
    items: MenuItem[],
    onAnyClick?: () => void,
  ): void {
    this.titleElement.textContent = title;
    this.subtitleElement.textContent = subtitle;
    this.buttonsContainer.textContent = '';

    items.forEach((item) => {
      const btn = document.createElement('button');
      btn.textContent = item.label;
      btn.onclick = () => {
        if (onAnyClick) onAnyClick();
        item.action();
      };
      this.buttonsContainer.appendChild(btn);
    });

    document.body.style.cursor = 'default';
    this.uiOverlay.classList.remove(CSS_CLASSES.GAME_UI_HIDDEN);
  }

  public hideMenu(): void {
    document.body.style.cursor = 'none';
    this.uiOverlay.classList.add(CSS_CLASSES.GAME_UI_HIDDEN);
  }

  public setPauseButtonVisibility(visible: boolean): void {
    this.pauseButton.classList.toggle(CSS_CLASSES.GAME_PAUSE_HIDDEN, !visible);
  }

  public bindPauseButton(onClick: () => void): void {
    this.pauseButton.onclick = onClick;
  }

  public updateHint(): void {
    this.hintElement.innerHTML = this.i18n.t(this.isCoarsePointer ? 'hintT' : 'hintK');
  }

  private getRequiredElement<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) {
      throw new Error(`Required DOM element with id "${id}" not found`);
    }
    return el as T;
  }
}
