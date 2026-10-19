import { SCENES, SceneId } from '@/shared/scenes';

/**
 * Developer-only menu of the backgrounds, shown with the debug overlay (`?debug` or F3).
 *
 * - Every entry is a real link (`?debug&bg=fuji`), so it can be opened in a new tab or
 *   shared; a plain click switches at once instead of reloading, and updates the address so a
 *   reload keeps it.
 * - Picking a background pins it, matches included.
 * - It lists every background there is: the challenges' own too, which nothing else offers.
 */
export class BackgroundMenu {
  private readonly el: HTMLElement;
  private readonly onPick: (scene: SceneId) => void;
  private readonly listeners = new AbortController();

  /** @param scenes the backgrounds there are, in order; the pickable ones when left out */
  constructor(onPick: (scene: SceneId) => void, scenes: readonly SceneId[] = SCENES) {
    this.onPick = onPick;

    this.el = document.createElement('nav');
    this.el.setAttribute('aria-label', 'Backgrounds (debug)');
    Object.assign(this.el.style, {
      position: 'fixed',
      top: 'calc(60px + env(safe-area-inset-top, 0px))',
      left: 'calc(6px + env(safe-area-inset-right, 0px))',
      zIndex: '9999',
      display: 'none',
      flexDirection: 'column',
      gap: '2px',
      padding: '4px 8px',
      font: '12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      background: 'rgba(0, 0, 0, 0.6)',
      borderRadius: '4px',
    });

    const title = document.createElement('span');
    title.textContent = 'bg';
    title.style.color = '#7cfc8a';
    this.el.append(title, ...scenes.map((scene) => this.createLink(scene)));
    document.body.appendChild(this.el);
  }

  public setVisible(isVisible: boolean): void {
    this.el.style.display = isVisible ? 'flex' : 'none';
  }

  /** Highlights the background on screen. */
  public setCurrent(scene: SceneId): void {
    for (const link of this.el.querySelectorAll<HTMLAnchorElement>('a')) {
      const isCurrent = link.dataset.scene === scene;
      link.style.color = isCurrent ? '#ffe53b' : '#19f0ff';
      link.style.fontWeight = isCurrent ? 'bold' : 'normal';
      if (isCurrent) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    }
  }

  public dispose(): void {
    this.listeners.abort();
    this.el.remove();
  }

  private createLink(scene: SceneId): HTMLAnchorElement {
    const link = document.createElement('a');
    link.textContent = scene;
    link.dataset.scene = scene;
    link.href = BackgroundMenu.addressFor(scene);
    link.style.textDecoration = 'none';

    link.addEventListener(
      'click',
      (event) => {
        // Modified clicks open the link as usual (a new tab, a new window)
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        history.replaceState(null, '', link.href);
        this.onPick(scene);
      },
      { signal: this.listeners.signal },
    );
    return link;
  }

  /** This page's address with the debug overlay on and `bg` set to `scene`. */
  private static addressFor(scene: SceneId): string {
    const url = new URL(window.location.href);
    url.searchParams.set('bg', scene);
    url.searchParams.set('debug', '');
    // `debug=` reads better as a bare flag
    return url.toString().replace(/([?&])debug=(&|$)/, '$1debug$2');
  }
}
