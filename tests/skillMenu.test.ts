import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkillMenu } from '@/debug/SkillMenu';

describe('SkillMenu', () => {
  const menus: SkillMenu[] = [];
  const setup = (chosen: string[] = []) => {
    const onChange = vi.fn();
    const menu = new SkillMenu(['arc', 'reflex'], chosen, onChange);
    menus.push(menu);
    const box = (skill: string) =>
      document.querySelector<HTMLInputElement>(`nav input[data-skill="${skill}"]`)!;
    return { menu, onChange, box };
  };

  afterEach(() => {
    menus.splice(0).forEach((menu) => menu.dispose());
    history.replaceState(null, '', '/');
  });

  it('ticks the skills the player has', () => {
    const { box } = setup(['reflex']);
    expect([box('arc').checked, box('reflex').checked]).toEqual([false, true]);
  });

  it('gives and takes skills, and keeps them in the address', () => {
    history.replaceState(null, '', '/?debug');
    const { onChange, box } = setup();

    box('arc').click();
    expect(onChange).toHaveBeenLastCalledWith(['arc']);
    box('reflex').click();
    expect(onChange).toHaveBeenLastCalledWith(['arc', 'reflex']);
    expect(new URLSearchParams(window.location.search).get('skills')).toBe('arc,reflex');
    expect(window.location.search).toMatch(/^\?debug&/);

    box('arc').click();
    box('reflex').click();
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(new URLSearchParams(window.location.search).has('skills')).toBe(false);
  });

  it('counts the uses it is told, a skill not yet used at 0', () => {
    const { menu } = setup();
    menu.setCounts(new Map([['reflex', 2]]));
    const rows = [...document.querySelectorAll('nav label')].map((row) => row.textContent);
    expect(rows).toEqual(['arc0', 'reflex2']);
  });

  it('shows and hides with the debug overlay', () => {
    const { menu } = setup();
    const nav = () => document.querySelector<HTMLElement>('nav')!;
    expect(nav().style.display).toBe('none');
    menu.setVisible(true);
    expect(nav().style.display).toBe('flex');
  });
});
