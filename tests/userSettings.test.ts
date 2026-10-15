import { describe, expect, it } from 'vitest';
import { getDefaultSettings, SETTING_KEYS, SETTINGS } from '@/settings/UserSettings';

describe('SETTINGS', () => {
  it('gives every setting its own storage key', () => {
    const keys = SETTING_KEYS.map((key) => SETTINGS[key].storageKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has defaults that pass their own validation', () => {
    const defaults = getDefaultSettings();
    for (const key of SETTING_KEYS) {
      expect(SETTINGS[key].isValid(defaults[key])).toBe(true);
    }
  });

  it('cycles every setting to another valid value', () => {
    const defaults = getDefaultSettings();
    for (const key of SETTING_KEYS) {
      const definition = SETTINGS[key] as (typeof SETTINGS)[typeof key];
      const next = (definition.next as (value: unknown) => unknown)(defaults[key]);
      expect(next).not.toBe(defaults[key]);
      expect(definition.isValid(next)).toBe(true);
    }
  });
});
