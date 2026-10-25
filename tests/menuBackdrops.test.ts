import { describe, expect, it, vi } from 'vitest';
import { MenuBackdrops } from '@/app/MenuBackdrops';
import { Song } from '@/audio/music/score';

const MENUS = { place: 'menu' } as Song;
const OTHER = {} as Song;

/** Backdrops behind the menus on an audio clock the test moves. */
const setup = () => {
  let clock: number | null = 0;
  const change = vi.fn();
  const backdrops = new MenuBackdrops(change, () => clock);
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += 0.1) {
      if (clock !== null) clock += 0.1;
      backdrops.update(0.1);
    }
  };
  return {
    backdrops,
    change,
    run,
    silence: () => {
      clock = null;
    },
  };
};

describe('MenuBackdrops', () => {
  it('changes the backdrop when a part of the menus’ song sounds, not when it is scheduled', () => {
    const { backdrops, change, run } = setup();
    backdrops.setActive(true);
    run(20);
    backdrops.onSectionStart(21, MENUS);
    expect(change).not.toHaveBeenCalled();
    run(1.2);
    expect(change).toHaveBeenCalledOnce();
  });

  it('keeps a backdrop that came in with the menus a while, whatever part starts', () => {
    const { backdrops, change, run } = setup();
    backdrops.setActive(true);
    run(5);
    backdrops.onSectionStart(5.5, MENUS);
    run(1);
    expect(change).not.toHaveBeenCalled();
  });

  it('listens to the menus’ song only, and only while it plays', () => {
    const { backdrops, change, run } = setup();
    backdrops.setActive(true);
    run(20);
    backdrops.onSectionStart(20.5, OTHER);
    run(1);
    expect(change).not.toHaveBeenCalled();
    backdrops.setActive(false);
    backdrops.onSectionStart(21.5, MENUS);
    run(60);
    expect(change).not.toHaveBeenCalled();
  });

  it('changes on its own every while when no music keeps time', () => {
    const { backdrops, change, run, silence } = setup();
    silence();
    backdrops.setActive(true);
    run(24);
    expect(change).not.toHaveBeenCalled();
    run(2);
    expect(change).toHaveBeenCalledOnce();
    run(26);
    expect(change).toHaveBeenCalledTimes(2);
  });
});
