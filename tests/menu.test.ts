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
  return { menu, buttons, store };
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

  it('colors each button by what it does', () => {
    const { menu, buttons } = setup();
    const classes = () => buttons().map((b) => b.className);

    menu.showSettingsMenu(() => {});
    expect(classes()).toEqual([
      'game-button game-button--yellow', // difficulty
      'game-button game-button--pink', // music
      'game-button game-button--purple', // sound
      'game-button game-button--green', // language
      'game-button', // back, default cyan
    ]);

    menu.showPauseMenu();
    expect(classes()).toEqual([
      'game-button',
      'game-button game-button--pink',
      'game-button game-button--purple',
    ]);
  });

  it('redraws an open settings menu when the music is toggled from outside it', () => {
    const { menu, buttons, store } = setup();
    menu.showSettingsMenu(() => {});

    store.cycle('musicMuted');
    expect(buttons()[1].textContent).toBe('MUSIC: ON');
  });

  it('stays hidden when a setting changes during play', () => {
    const { menu, buttons, store } = setup();
    menu.showSettingsMenu(() => {});
    document.getElementById('gameUI')?.classList.add('game__ui--hidden');

    store.cycle('musicMuted');
    expect(document.getElementById('gameUI')?.classList.contains('game__ui--hidden')).toBe(true);
    expect(buttons()[1].textContent).toBe('MUSIC: OFF');
  });
});
