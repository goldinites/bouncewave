import { effect } from '@preact/signals-core';
import { describe, expect, it } from 'vitest';
import { ScreenEntry, ScreenStack } from '@/ui/ScreenStack';

const screen = (id: string): ScreenEntry => ({
  id,
  view: () => ({ title: id, subtitle: '', body: null }),
});

describe('the screen stack', () => {
  it('opens screens over each other and steps back down them', () => {
    const stack = new ScreenStack();
    expect(stack.top.value).toBeNull();

    stack.reset(screen('main'));
    stack.push(screen('play'));
    stack.push(screen('quick'));
    expect(stack.top.value?.id).toBe('quick');

    expect(stack.back()).toBe(true);
    expect(stack.top.value?.id).toBe('play');
    expect(stack.back()).toBe(true);
    // The root has nothing under it
    expect(stack.back()).toBe(false);
    expect(stack.top.value?.id).toBe('main');
  });

  it('starts over from a root, or from the way down to a screen', () => {
    const stack = new ScreenStack();
    stack.reset(screen('main'), screen('settings'));
    stack.reset(screen('pause'));
    expect(stack.back()).toBe(false);

    stack.reset(screen('main'), screen('play'), screen('challenges'));
    stack.back();
    expect(stack.top.value?.id).toBe('play');
  });

  it('tells an effect whenever another screen comes on top', () => {
    const stack = new ScreenStack();
    const shown: string[] = [];
    const stop = effect(() => {
      const top = stack.top.value;
      if (top) shown.push(top.id);
    });

    stack.reset(screen('pause'));
    stack.push(screen('settings'));
    stack.back();
    stop();
    expect(shown).toEqual(['pause', 'settings', 'pause']);
  });
});
