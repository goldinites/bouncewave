import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { I18nManager } from '@/i18n/I18nManager';
import { SettingsStore } from '@/settings/SettingsStore';
import { getDefaultSettings } from '@/settings/UserSettings';
import { MenuController } from '@/ui/MenuController';
import { UIManager } from '@/ui/UIManager';

/** What an item says: a button its text, a choice its name and value. */
const text = (item: Element) =>
  item.getAttribute('role') === 'spinbutton'
    ? `${item.getAttribute('aria-label')}: ${item.getAttribute('aria-valuetext')}`
    : item.textContent;

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
  // What the keyboard walks, in a menu or a screen (the settings): buttons, and a choice's value
  const buttons = () =>
    [
      ...document.querySelectorAll<HTMLButtonElement>(
        '#gameButtons button, #gameScreen button, #gameScreen [data-menu-item]',
      ),
    ].filter((item) => item.tabIndex >= 0);
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

    // music (muted), sound (on), language, back
    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      null,
      null,
    ]);
  });

  it('flips a toggle when it is picked', () => {
    const { menu, buttons } = setup();
    menu.showSettingsMenu(() => {});

    buttons()[0].click(); // music back on
    expect(buttons()[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons()[0].textContent).toBe('MUSIC: ON');
  });

  it('colors each button by what it does', () => {
    const { menu, buttons } = setup();
    const classes = () => buttons().map((b) => b.className);

    menu.showSettingsMenu(() => {});
    expect(classes()).toEqual([
      'game-button game-button--pink', // music
      'game-button game-button--purple', // sound
      'option-row__value', // language: a choice, its row green
      'game-button', // back, default cyan
    ]);
    expect(buttons()[2].closest('.option-row')?.className).toBe('option-row game-button--green');

    menu.showPauseMenu();
    expect(classes()).toEqual([
      'game-button',
      'game-button game-button--yellow',
      'game-button game-button--pink',
      'game-button game-button--purple',
    ]);
  });

  it('steps the language either way by its arrows, the focus staying on it', () => {
    const { menu, buttons, store } = setup();
    menu.showSettingsMenu(() => {});
    const arrow = (label: string) =>
      document.querySelector<HTMLButtonElement>(`#gameScreen [aria-label="${label}"]`)!;

    buttons()[2].focus();
    arrow('Next').click();
    expect(store.current.language).toBe('ru');
    // Redrawn (in the game, retitled in the new language), still the same screen
    expect(document.activeElement).toBe(buttons()[2]);

    buttons()[2].dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }));
    expect(store.current.language).toBe('en');
  });

  it('redraws an open settings menu when the music is toggled from outside it', () => {
    const { menu, buttons, store } = setup();
    menu.showSettingsMenu(() => {});

    store.cycle('musicMuted');
    expect(buttons()[0].textContent).toBe('MUSIC: ON');
  });

  it('keeps the keyboard focus on the setting that was just changed', () => {
    const { menu, buttons } = setup();
    menu.showSettingsMenu(() => {});

    buttons()[1].focus();
    buttons()[1].click(); // sound, redrawing the whole menu
    expect(document.activeElement).toBe(buttons()[1]);
  });

  it('moves the focus to the first button of the menu it leads to', () => {
    const { menu, buttons } = setup();
    menu.showSettingsMenu(() => menu.showMainMenu());

    buttons()[3].focus();
    buttons()[3].click(); // back
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
    menu.showPauseMenu(); // resume, restart, settings, menu
    const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    const focused = () => buttons().indexOf(document.activeElement as HTMLButtonElement);

    press('ArrowDown');
    expect(focused()).toBe(0); // from outside the menu, the first button
    press('ArrowDown');
    press('KeyS');
    press('ArrowDown');
    expect(focused()).toBe(3);
    press('ArrowDown');
    expect(focused()).toBe(0);
    press('ArrowUp');
    expect(focused()).toBe(3);
    press('Home');
    expect(focused()).toBe(0);
    press('End');
    expect(focused()).toBe(3);
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

  it('opens the same settings from the pause', () => {
    const { menu, buttons } = setup();
    menu.showPauseMenu();
    buttons()[2].click(); // settings

    const labels = () => buttons().map((b) => text(b));
    expect(labels()).toEqual(['MUSIC: OFF', 'SOUND EFFECTS: ON', 'LANGUAGE: ENGLISH', 'BACK']);

    // Switching a setting redraws the menu where it is
    buttons()[0].click();
    expect(labels()).toEqual(['MUSIC: ON', 'SOUND EFFECTS: ON', 'LANGUAGE: ENGLISH', 'BACK']);
  });

  it('leaves the difficulty to the quick match, out of the settings', () => {
    const { menu, buttons } = setup();
    menu.showMainMenu();
    buttons()[1].click(); // settings
    expect(buttons().map((b) => text(b))).not.toContainEqual(expect.stringMatching(/^DIFFICULTY/));
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
    expect(buttons()[0].textContent).toBe('MUSIC: OFF');
  });
});
