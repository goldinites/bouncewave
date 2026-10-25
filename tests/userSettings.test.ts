import { describe, expect, it } from 'vitest';
import { getDefaultSettings, SETTING_KEYS, SETTINGS } from '@/settings/UserSettings';

describe('SETTINGS', () => {
  it('has defaults that pass their own validation', () => {
    const defaults = getDefaultSettings();
    for (const key of SETTING_KEYS) {
      expect(SETTINGS[key].isValid(defaults[key])).toBe(true);
    }
  });

  it('steps every setting to another valid value, one way or the other', () => {
    const defaults = getDefaultSettings();
    for (const key of SETTING_KEYS) {
      const definition = SETTINGS[key] as (typeof SETTINGS)[typeof key];
      const step = (way: 'next' | 'previous') =>
        (definition[way] as (value: unknown) => unknown)(defaults[key]);
      // A volume starts at the top, where only a step down goes anywhere
      const moved = step('next') === defaults[key] ? step('previous') : step('next');
      expect(moved, key).not.toBe(defaults[key]);
      expect(definition.isValid(moved)).toBe(true);
    }
  });
});
