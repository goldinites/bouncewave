import { applyDebugTheme } from '@/debug/theme';

/** One of the dock's tabs: a panel, and what to do when it is shown or hidden. */
export interface DockPanel {
  name: string;
  element: HTMLElement;
  setVisible: (isVisible: boolean) => void;
}

const STORAGE_KEY = 'bouncewave.debugDock';

/**
 * The developer tools in one place (`?debug` or F3): a single column at the left edge — the FPS
 * meter on top, then a tab per panel (backgrounds, skills, modifiers, the sound stand), one shown
 * at a time — so the panels never overlap each other or crowd the court, on a phone too. It
 * folds down to the FPS line, and moves to the other edge when it covers what is being watched.
 * The tab open, the fold and the edge are remembered per browser.
 */
export class DebugDock {
  private readonly el: HTMLElement;
  private readonly body: HTMLElement;
  private readonly tabs = new Map<string, HTMLButtonElement>();
  private readonly foldButton: HTMLButtonElement;
  /** The tab row and the body: what folding hides, the header staying. */
  private readonly foldable: HTMLElement[];
  private readonly panels: readonly DockPanel[];
  private readonly listeners = new AbortController();
  private active: string;
  private isFolded = false;
  private side: 'left' | 'right' = 'left';
  private isVisible = false;
  private readonly sideButton: HTMLButtonElement;

  /** @param header shown above the tabs, folded or not (the FPS meter) */
  constructor(header: HTMLElement, panels: readonly DockPanel[]) {
    this.panels = panels;
    const saved = DebugDock.load();
    this.active = panels.some((p) => p.name === saved.tab) ? saved.tab! : panels[0].name;
    this.isFolded = saved.isFolded ?? false;
    this.side = saved.side === 'right' ? 'right' : 'left';
    applyDebugTheme();

    this.el = document.createElement('aside');
    this.el.setAttribute('aria-label', 'Debug tools');
    this.el.dataset.dock = '';
    Object.assign(this.el.style, {
      position: 'fixed',
      top: 'calc(6px + env(safe-area-inset-top, 0px))',
      zIndex: '9999',
      display: 'none',
      flexDirection: 'column',
      gap: '6px',
      width: 'min(340px, calc(100vw - 12px))',
      maxHeight:
        'calc(100dvh - 12px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
      padding: '8px',
      boxSizing: 'border-box',
    });

    this.foldButton = this.button('', () => this.setFolded(!this.isFolded));
    this.foldButton.dataset.dock = 'fold';
    this.sideButton = this.button('⇄', () => this.setSide(this.side === 'left' ? 'right' : 'left'));
    this.sideButton.dataset.dock = 'side';
    this.sideButton.title = 'Move to the other edge';
    const top = document.createElement('div');
    // Only the body scrolls: the header and the tabs keep their height on a short screen
    Object.assign(top.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      flexShrink: '0',
    });
    header.style.flex = '1';
    top.append(header, this.sideButton, this.foldButton);

    const tabRow = document.createElement('div');
    tabRow.className = 'dbg-tabs';
    tabRow.style.flexShrink = '0';
    for (const { name } of panels) {
      const tab = this.button(name, () => this.show(name));
      tab.dataset.tab = name;
      this.tabs.set(name, tab);
      tabRow.append(tab);
    }

    this.body = document.createElement('div');
    Object.assign(this.body.style, {
      overflowY: 'auto',
      minHeight: '0',
      display: 'flex',
      flexDirection: 'column',
      paddingRight: '2px',
    });
    this.body.append(...panels.map((panel) => panel.element));
    this.el.append(top, tabRow, this.body);
    this.foldable = [tabRow, this.body];
    document.body.appendChild(this.el);
    this.update();
  }

  public setVisible(isVisible: boolean): void {
    this.isVisible = isVisible;
    this.el.style.display = isVisible ? 'flex' : 'none';
    this.update();
  }

  public dispose(): void {
    this.listeners.abort();
    this.el.remove();
  }

  private show(name: string): void {
    this.active = name;
    this.save();
    this.update();
  }

  private setSide(side: 'left' | 'right'): void {
    this.side = side;
    this.save();
    this.update();
  }

  private setFolded(isFolded: boolean): void {
    this.isFolded = isFolded;
    this.save();
    this.update();
  }

  /** Shows the open tab's panel and hides the rest: a hidden panel stops its timers. */
  private update(): void {
    this.foldButton.textContent = this.isFolded ? '▸' : '▾';
    this.foldButton.setAttribute('aria-label', this.isFolded ? 'Unfold' : 'Fold');
    const edge = 'calc(6px + env(safe-area-inset-left, 0px))';
    this.el.style.left = this.side === 'left' ? edge : '';
    this.el.style.right = this.side === 'right' ? edge.replace('left', 'right') : '';
    this.foldable.forEach((el) => (el.style.display = this.isFolded ? 'none' : 'flex'));
    for (const panel of this.panels) {
      const isShown = this.isVisible && !this.isFolded && panel.name === this.active;
      panel.setVisible(isShown);
      this.tabs.get(panel.name)!.setAttribute('aria-pressed', String(panel.name === this.active));
    }
  }

  private button(text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.addEventListener(
      'click',
      () => {
        onClick();
        // The button keeps no focus: the keys that follow steer the paddle
        button.blur();
      },
      { signal: this.listeners.signal },
    );
    return button;
  }

  private static load(): { tab?: string; isFolded?: boolean; side?: string } {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
        tab?: string;
        isFolded?: boolean;
        side?: string;
      };
    } catch {
      return {};
    }
  }

  private save(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ tab: this.active, isFolded: this.isFolded, side: this.side }),
      );
    } catch {
      // A private window may refuse storage: the dock still works, only it doesn't remember
    }
  }
}
