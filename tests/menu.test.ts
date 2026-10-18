import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { I18nManager } from '@/i18n/I18nManager';
import { SettingsStore } from '@/settings/SettingsStore';
import { getDefaultSettings } from '@/settings/UserSettings';
import { MenuController } from '@/ui/MenuController';
import { UIManager } from '@/ui/UIManager';

// Each one listens for keys on the window until disposed
const managers: UIManager[] = [];
const makeUIManager = (i18n: I18nManager) => {
  const manager = new UIManager(i18n);
  managers.push(manager);
  return manager;
};

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
  const menu = new MenuController(makeUIManager(i18n), i18n, sfx, store, actions);
  const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('#gameButtons button')];
  return { menu, buttons, store };
};

describe('settings menu', () => {
  afterEach(() => {
    managers.splice(0).forEach((manager) => manager.dispose());
  });

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="gameUI"></div><h1 id="gameTitle"></h1><p id="gameSubtitle"></p>
      <div id="gameButtons"></div><div id="gameScreen"></div><p id="gameHint"></p><button id="pauseButton"></button>`;
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

  it('keeps the keyboard focus on the setting that was just changed', () => {
    const { menu, buttons } = setup();
    menu.showSettingsMenu(() => {});

    buttons()[2].focus();
    buttons()[2].click(); // sound, redrawing the whole menu
    expect(document.activeElement).toBe(buttons()[2]);
  });

  it('moves the focus to the first button of the menu it leads to', () => {
    const { menu, buttons } = setup();
    menu.showSettingsMenu(() => menu.showMainMenu());

    buttons()[4].focus();
    buttons()[4].click(); // back
    expect(document.activeElement).toBe(buttons()[0]);
  });

  it("leaves the focus alone when it wasn't in the menu", () => {
    const { menu, buttons } = setup();
    menu.showSettingsMenu(() => {});

    menu.showPauseMenu();
    expect(buttons()).not.toContain(document.activeElement);
  });

  it('walks the menu with the arrow keys, wrapping around at either end', () => {
    const { menu, buttons } = setup();
    menu.showPauseMenu(); // resume, settings, menu
    const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    const focused = () => buttons().indexOf(document.activeElement as HTMLButtonElement);

    press('ArrowDown');
    expect(focused()).toBe(0); // from outside the menu, the first button
    press('ArrowDown');
    press('KeyS');
    expect(focused()).toBe(2);
    press('ArrowDown');
    expect(focused()).toBe(0);
    press('ArrowUp');
    expect(focused()).toBe(2);
    press('Home');
    expect(focused()).toBe(0);
    press('End');
    expect(focused()).toBe(2);
  });

  it('puts Enter on the first button when nothing in the menu is focused yet', () => {
    const { menu, buttons } = setup();
    menu.showPauseMenu();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
    expect(document.activeElement).toBe(buttons()[0]);
  });

  it('leaves the arrow keys to the game while the menu is hidden', () => {
    const { menu, buttons } = setup();
    menu.showPauseMenu();
    document.getElementById('gameUI')?.classList.add('game__ui--hidden');

    const event = new KeyboardEvent('keydown', { code: 'ArrowDown', cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(buttons()).not.toContain(document.activeElement);
  });

  it('goes back from the settings menu on Esc, and only from there', () => {
    const { menu } = setup();
    const back = vi.fn();

    menu.showSettingsMenu(back);
    expect(menu.goBack()).toBe(true);
    expect(back).toHaveBeenCalledOnce();

    menu.showPauseMenu();
    expect(menu.goBack()).toBe(false);
  });

  it('leaves the difficulty out of the settings opened from the pause', () => {
    const { menu, buttons } = setup();
    menu.showPauseMenu();
    buttons()[1].click(); // settings

    const labels = () => buttons().map((b) => b.textContent);
    expect(labels()).toEqual(['MUSIC: OFF', 'SOUND EFFECTS: ON', 'LANGUAGE: ENGLISH', 'BACK']);

    // Switching a setting redraws the menu, still without the difficulty
    buttons()[0].click();
    expect(labels()).toEqual(['MUSIC: ON', 'SOUND EFFECTS: ON', 'LANGUAGE: ENGLISH', 'BACK']);
  });

  it('offers the difficulty between matches', () => {
    const { menu, buttons } = setup();
    menu.showMainMenu();
    buttons()[1].click(); // settings
    expect(buttons()[0].textContent).toMatch(/^DIFFICULTY/);
  });

  it('names the pause button in the current language', () => {
    const { store } = setup();
    const label = () => document.getElementById('pauseButton')?.getAttribute('aria-label');
    expect(label()).toBe('Pause');

    store.cycle('language');
    const i18n = new I18nManager(store.current.language);
    makeUIManager(i18n);
    expect(label()).toBe('Пауза');
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
