import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackgroundMenu } from '@/debug/BackgroundMenu';
import { SCENES } from '@/shared/scenes';

describe('BackgroundMenu', () => {
  const menus: BackgroundMenu[] = [];
  const setup = () => {
    const onPick = vi.fn();
    const menu = new BackgroundMenu(onPick);
    menus.push(menu);
    const links = () => [...document.querySelectorAll<HTMLAnchorElement>('nav a')];
    return { menu, onPick, links };
  };

  afterEach(() => {
    menus.splice(0).forEach((menu) => menu.dispose());
    history.replaceState(null, '', '/');
  });

  it('links to every background, keeping the debug overlay on', () => {
    const { links } = setup();

    expect(links().map((link) => link.textContent)).toEqual([...SCENES]);
    const fuji = new URL(links()[SCENES.indexOf('fuji')].href);
    expect(fuji.searchParams.get('bg')).toBe('fuji');
    expect(fuji.searchParams.has('debug')).toBe(true);
  });

  it('switches on a plain click without leaving the page, and remembers it in the address', () => {
    const { onPick, links } = setup();

    links()[SCENES.indexOf('jungle')].click();
    expect(onPick).toHaveBeenCalledExactlyOnceWith('jungle');
    expect(new URLSearchParams(window.location.search).get('bg')).toBe('jungle');
  });

  it('marks the background on screen', () => {
    const { menu, links } = setup();
    menu.setCurrent('outrun');

    const current = links().filter((link) => link.getAttribute('aria-current') === 'true');
    expect(current.map((link) => link.textContent)).toEqual(['outrun']);
  });

  it('shows and hides with the debug overlay', () => {
    const { menu } = setup();
    const nav = () => document.querySelector<HTMLElement>('nav')!;

    expect(nav().style.display).toBe('none');
    menu.setVisible(true);
    expect(nav().style.display).toBe('flex');
  });
});
