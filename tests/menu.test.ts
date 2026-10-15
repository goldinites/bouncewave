import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { I18nManager } from '@/i18n/I18nManager';
import { SettingsStore } from '@/settings/SettingsStore';
import { getDefaultSettings } from '@/settings/UserSettings';
import { MenuController } from '@/ui/MenuController';
import { UIManager } from '@/ui/UIManager';

const setup = () => {
  const store = new SettingsStore({
    load: () => ({ ...getDefaultSettings(), musicMuted: true }),
    save: () => {},
  });
  const i18n = new I18nManager('en');
  const sfx = { playSettingsClick: vi.fn() } as unknown as SoundEffects;
  const actions = {
    onStartGame: vi.fn(),
    onResumeGame: vi.fn(),
    onReturnToMainMenu: vi.fn(),
    onUnlockAudio: vi.fn(),
  };
  const menu = new MenuController(new UIManager(i18n), i18n, sfx, store, actions);
  const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('#gameButtons button')];
  return { menu, buttons };
};

describe('settings menu', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="gameUI"></div><h1 id="gameTitle"></h1><p id="gameSubtitle"></p>
      <div id="gameButtons"></div><p id="gameHint"></p><button id="pauseButton"></button>`;
  });

  it('shows music and sound as toggles, pressed while on', () => {
    const { menu, buttons } = setup();
    menu.showSettingsMenu(() => {});

    // difficulty, music (muted), sound (on), language, back
    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual([
      null,
      'false',
      'true',
      null,
      null,
    ]);
  });

  it('flips a toggle when it is picked', () => {
    const { menu, buttons } = setup();
    menu.showSettingsMenu(() => {});

    buttons()[1].click(); // music back on
    expect(buttons()[1].getAttribute('aria-pressed')).toBe('true');
    expect(buttons()[1].textContent).toBe('MUSIC: ON');
  });
});
