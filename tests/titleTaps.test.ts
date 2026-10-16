import { describe, expect, it, vi } from 'vitest';
import { TitleTaps } from '@/easterEgg/TitleTaps';

const setup = () => {
  const title = document.createElement('h1');
  const onComplete = vi.fn();
  let time = 0;
  const taps = new TitleTaps(title, onComplete, () => time);
  const tap = (after = 100) => {
    time += after;
    title.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  };
  return { taps, tap, onComplete };
};

describe('TitleTaps', () => {
  it('fires on five quick taps', () => {
    const { taps, tap, onComplete } = setup();

    for (let i = 0; i < 5; i++) tap();

    expect(onComplete).toHaveBeenCalledOnce();
    taps.dispose();
  });

  it('does not fire on four', () => {
    const { taps, tap, onComplete } = setup();

    for (let i = 0; i < 4; i++) tap();

    expect(onComplete).not.toHaveBeenCalled();
    taps.dispose();
  });

  it('starts the count over after a pause between taps', () => {
    const { taps, tap, onComplete } = setup();

    for (let i = 0; i < 4; i++) tap();
    tap(800); // too late: this is tap one of a new run
    expect(onComplete).not.toHaveBeenCalled();

    for (let i = 0; i < 4; i++) tap();
    expect(onComplete).toHaveBeenCalledOnce();
    taps.dispose();
  });

  it('fires again on the next five, so the same taps turn it back off', () => {
    const { taps, tap, onComplete } = setup();

    for (let i = 0; i < 10; i++) tap();

    expect(onComplete).toHaveBeenCalledTimes(2);
    taps.dispose();
  });

  it('stops listening after dispose', () => {
    const { taps, tap, onComplete } = setup();
    taps.dispose();

    for (let i = 0; i < 5; i++) tap();

    expect(onComplete).not.toHaveBeenCalled();
  });
});
