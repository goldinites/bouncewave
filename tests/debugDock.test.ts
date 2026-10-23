import { afterEach, describe, expect, it, vi } from 'vitest';
import { DebugDock, DockPanel } from '@/debug/DebugDock';

describe('DebugDock', () => {
  const docks: DebugDock[] = [];
  const setup = () => {
    const header = document.createElement('div');
    header.textContent = 'FPS 60';
    const panels = ['bg', 'sound'].map((name) => ({
      name,
      element: document.createElement('div'),
      setVisible: vi.fn<(isVisible: boolean) => void>(),
    })) satisfies DockPanel[];
    const dock = new DebugDock(header, panels);
    docks.push(dock);
    dock.setVisible(true);
    const click = (selector: string) =>
      document.querySelector<HTMLButtonElement>(`[data-dock] ${selector}`)!.click();
    const shown = () => panels.map((panel) => panel.setVisible.mock.lastCall?.[0]);
    return { dock, panels, header, click, shown };
  };

  afterEach(() => {
    docks.splice(0).forEach((dock) => dock.dispose());
    localStorage.clear();
  });

  it('shows one panel at a time, the tab picked', () => {
    const { click, shown } = setup();
    expect(shown()).toEqual([true, false]);
    click('[data-tab="sound"]');
    expect(shown()).toEqual([false, true]);
  });

  it('folds down to its header, every panel hidden', () => {
    const { click, shown, header } = setup();
    click('[data-dock="fold"]');
    expect(shown()).toEqual([false, false]);
    expect(header.isConnected).toBe(true);
    click('[data-dock="fold"]');
    expect(shown()).toEqual([true, false]);
  });

  it('moves to the other edge and back', () => {
    const { click } = setup();
    const dock = document.querySelector<HTMLElement>('[data-dock]')!;
    expect(dock.style.left).not.toBe('');
    click('[data-dock="side"]');
    expect(dock.style.left).toBe('');
    expect(dock.style.right).not.toBe('');
    click('[data-dock="side"]');
    expect(dock.style.right).toBe('');
  });

  it('hides every panel with the debug tools, and remembers the tab for next time', () => {
    const first = setup();
    first.click('[data-tab="sound"]');
    first.dock.setVisible(false);
    expect(first.shown()).toEqual([false, false]);
    first.dock.dispose();
    docks.length = 0;

    const second = setup();
    expect(second.shown()).toEqual([false, true]);
  });
});
