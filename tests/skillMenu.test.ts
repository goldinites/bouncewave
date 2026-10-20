import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkillMenu, SkillOwner } from '@/debug/SkillMenu';

describe('SkillMenu', () => {
  const menus: SkillMenu[] = [];
  const setup = (chosen: Partial<Record<SkillOwner, string[]>> = {}) => {
    const onChange = vi.fn();
    const menu = new SkillMenu(
      ['arc', 'reflex'],
      { player: chosen.player ?? [], cpu: chosen.cpu ?? [] },
      onChange,
    );
    menus.push(menu);
    const box = (skill: string, owner: SkillOwner = 'player') =>
      document.querySelector<HTMLInputElement>(
        `nav input[data-skill="${skill}"][data-owner="${owner}"]`,
      )!;
    return { menu, onChange, box };
  };

  afterEach(() => {
    menus.splice(0).forEach((menu) => menu.dispose());
    history.replaceState(null, '', '/');
  });

  it('ticks the skills the player and the CPU have', () => {
    const { box } = setup({ player: ['reflex'], cpu: ['arc'] });
    expect([box('arc').checked, box('reflex').checked]).toEqual([false, true]);
    expect([box('arc', 'cpu').checked, box('reflex', 'cpu').checked]).toEqual([true, false]);
  });

  it('gives and takes the player’s skills, and keeps them in the address', () => {
    history.replaceState(null, '', '/?debug');
    const { onChange, box } = setup();

    box('arc').click();
    expect(onChange).toHaveBeenLastCalledWith('player', ['arc']);
    box('reflex').click();
    expect(onChange).toHaveBeenLastCalledWith('player', ['arc', 'reflex']);
    expect(new URLSearchParams(window.location.search).get('skills')).toBe('arc,reflex');
    expect(window.location.search).toMatch(/^\?debug&/);

    box('arc').click();
    box('reflex').click();
    expect(onChange).toHaveBeenLastCalledWith('player', []);
    expect(new URLSearchParams(window.location.search).has('skills')).toBe(false);
  });

  it('gives the CPU its own, kept apart', () => {
    const { onChange, box } = setup({ player: ['arc'] });
    box('reflex', 'cpu').click();

    expect(onChange).toHaveBeenLastCalledWith('cpu', ['reflex']);
    expect(new URLSearchParams(window.location.search).get('cpuSkills')).toBe('reflex');
    expect(box('arc').checked).toBe(true);
  });

  it('counts the uses it is told, the player’s and the CPU’s, a skill not yet used at 0', () => {
    const { menu } = setup();
    menu.setCounts(new Map([['reflex', [2, 1] as const]]));
    const cells = [...document.querySelectorAll('nav span')].map((cell) => cell.textContent);
    expect(cells).toEqual(['skills', 'you', 'cpu', 'used', 'arc', '0·0', 'reflex', '2·1']);
  });

  it('shows and hides with the debug overlay', () => {
    const { menu } = setup();
    const nav = () => document.querySelector<HTMLElement>('nav')!;
    expect(nav().style.display).toBe('none');
    menu.setVisible(true);
    expect(nav().style.display).toBe('grid');
  });
});
