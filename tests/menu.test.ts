import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { I18nManager } from '@/i18n/I18nManager';
import { DifficultyLevel } from '@/match/difficulty';
import { SettingsStore } from '@/settings/SettingsStore';
import { getDefaultSettings } from '@/settings/UserSettings';
import { GameMenuActions, MenuController } from '@/ui/MenuController';
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

const setup = (more: Partial<GameMenuActions> = {}) => {
  const store = new SettingsStore({
    load: () => ({ ...getDefaultSettings(), musicVolume: 0 }),
    save: () => {},
  });
  const i18n = new I18nManager('en');
  const sfx = {
    playMenuBack: vi.fn(),
    playMenuMove: vi.fn(),
    playMenuSelect: vi.fn(),
  } as unknown as SoundEffects;
  const actions = {
    onStartGame: vi.fn(),
    onStartQuickMatch: vi.fn(),
    onStartChallenge: vi.fn(),
    onResumeGame: vi.fn(),
    onReturnToMainMenu: vi.fn(),
    onUnlockAudio: vi.fn(),
    ...more,
  };
  const menu = new MenuController(makeUIManager(i18n), i18n, sfx, store, actions);
  // What the keyboard walks, in a menu or a screen (the settings): buttons, and a choice's value
  const buttons = () =>
    [
      ...document.querySelectorAll<HTMLButtonElement>(
        '#gameScreen button, #gameScreen [data-menu-item]',
      ),
    ].filter((item) => item.tabIndex >= 0);
  return { menu, buttons, store, actions, sfx };
};

describe('settings menu', () => {
  afterEach(() => {
    managers.splice(0).forEach((manager) => manager.dispose());
  });

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="gameUI"></div><h1 id="gameTitle"></h1><p id="gameSubtitle"></p>
      <div id="gameScreen"></div><button id="pauseButton"></button>`;
  });

  it('answers the menu keys with a tick, a press with a blip, and going back with its own', async () => {
    const { menu, buttons, sfx } = setup();
    menu.showMainMenu();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }));
    expect(sfx.playMenuMove).toHaveBeenCalledOnce();

    menu.showSettingsMenu();
    buttons()[3].click(); // controls
    await Promise.resolve();
    expect(sfx.playMenuSelect).toHaveBeenCalled();
    menu.goBack();
    expect(sfx.playMenuBack).toHaveBeenCalledOnce();
  });

  it('colors each button by what it does', () => {
    const { menu, buttons } = setup();
    const classes = () => buttons().map((b) => b.className);

    menu.showSettingsMenu();
    expect(classes()).toEqual([
      'option-row__value', // music: a volume, its row pink
      'option-row__value', // sound, purple
      'option-row__value', // language, green
      'game-button game-button--yellow', // controls
      'game-button', // back, default cyan
    ]);
    const rows = buttons().map((b) => b.closest('.option-row')?.className);
    expect(rows.slice(0, 3)).toEqual([
      'option-row game-button--pink',
      'option-row game-button--purple',
      'option-row game-button--green',
    ]);

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
    menu.showSettingsMenu();
    const arrow = (label: string) =>
      buttons()[2]
        .closest('.option-row')!
        .querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;

    buttons()[2].focus();
    arrow('Next').click();
    expect(store.current.language).toBe('ru');
    // Redrawn (in the game, retitled in the new language), still the same screen
    expect(document.activeElement).toBe(buttons()[2]);

    buttons()[2].dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }));
    expect(store.current.language).toBe('en');
  });

  it('redraws an open settings menu when the music is turned off from outside it (M)', () => {
    const { menu, buttons, store } = setup();
    menu.showSettingsMenu();

    store.update({ musicVolume: 0 });
    expect(buttons()[0].getAttribute('aria-valuetext')).toBe('OFF');
  });

  it('steps a volume by its arrows, the keys, and plays a hit at the new sound volume', () => {
    const onSoundVolume = vi.fn();
    const { menu, buttons, store } = setup({ onSoundVolume });
    menu.showSettingsMenu();
    const step = (index: number, code: string) =>
      buttons()[index].dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));

    buttons()[0].focus();
    step(0, 'ArrowRight'); // from off
    expect(store.current.musicVolume).toBe(10);
    expect(buttons()[0].getAttribute('aria-valuetext')).toBe('10%');
    // Redrawn, the focus stays on the setting that was just changed
    expect(document.activeElement).toBe(buttons()[0]);
    expect(onSoundVolume).not.toHaveBeenCalled();

    step(1, 'ArrowLeft');
    expect(store.current.soundVolume).toBe(90);
    expect(onSoundVolume).toHaveBeenCalledOnce();
  });

  it('moves the focus to the first button of the menu it leads to', () => {
    const { menu, buttons } = setup();
    menu.showMainMenu();
    menu.showSettingsMenu();

    buttons()[3].focus();
    buttons()[3].click(); // back
    expect(document.activeElement).toBe(buttons()[0]);
  });

  it("leaves the focus alone when it wasn't in the menu", () => {
    const { menu, buttons } = setup();
    menu.showSettingsMenu();

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

  it('goes back on Esc from the settings to where they were opened, and no further', () => {
    const { menu, buttons } = setup();
    const title = () => document.getElementById('gameTitle')?.textContent;

    menu.showPauseMenu();
    menu.showSettingsMenu();
    expect(menu.goBack()).toBe(true);
    expect(title()).toBe('PAUSED');
    expect(menu.goBack()).toBe(false);

    buttons()[2].click(); // settings, from the pause
    buttons()[4].click(); // back
    expect(title()).toBe('PAUSED');
  });

  it('leads back from the settings to the end of the match they were opened from', () => {
    const { menu, buttons } = setup();
    const title = () => document.getElementById('gameTitle')?.textContent;
    menu.showGameOverMenu(0, [5, 3]);
    buttons()[2].click(); // settings, after the next level's offer
    expect(title()).toBe('SETTINGS');

    expect(menu.goBack()).toBe(true);
    expect(title()).toBe('YOU WIN');
    expect(document.getElementById('gameSubtitle')?.textContent).toBe('5 : 3');
  });

  it('offers the next level up once a match against the CPU is won', () => {
    const { menu, buttons, store, actions } = setup();
    const labels = () => buttons().map((b) => text(b));
    // A newcomer starts at the easiest
    expect(store.current.difficulty).toBe(DifficultyLevel.EASY);

    menu.showGameOverMenu(1, [2, 5]);
    expect(labels()).toEqual(['PLAY AGAIN', 'SETTINGS', 'MAIN MENU']);

    menu.showGameOverMenu(0, [5, 2]);
    expect(labels()).toEqual(['PLAY AGAIN', 'TRY NORMAL', 'SETTINGS', 'MAIN MENU']);
    buttons()[1].click();
    expect(store.current.difficulty).toBe(DifficultyLevel.NORMAL);
    expect(actions.onStartGame).toHaveBeenCalledTimes(1);

    // Nothing above the hardest
    store.update({ difficulty: DifficultyLevel.INSANE });
    menu.showGameOverMenu(0, [5, 2]);
    expect(labels()).not.toContain('TRY NORMAL');
    expect(labels()).toHaveLength(3);
  });

  it('offers no level up after a match of two', () => {
    const { menu, buttons } = setup({ isTwoPlayerMatch: () => true });
    menu.showGameOverMenu(0, [5, 2]);
    expect(buttons().map((b) => text(b))).toEqual(['PLAY AGAIN', 'SETTINGS', 'MAIN MENU']);
  });

  it('opens the same settings from the pause', () => {
    const { menu, buttons } = setup();
    menu.showPauseMenu();
    buttons()[2].click(); // settings

    const labels = () => buttons().map((b) => text(b));
    expect(labels()).toEqual([
      'MUSIC: OFF',
      'SOUND EFFECTS: 100%',
      'LANGUAGE: ENGLISH',
      'CONTROLS',
      'BACK',
    ]);

    // Stepping a setting redraws the menu where it is
    buttons()[0]
      .closest('.option-row')!
      .querySelector<HTMLButtonElement>('[aria-label="Next"]')!
      .click();
    expect(labels()).toEqual([
      'MUSIC: 10%',
      'SOUND EFFECTS: 100%',
      'LANGUAGE: ENGLISH',
      'CONTROLS',
      'BACK',
    ]);
  });

  it('lists the controls alone, with keys on a computer', () => {
    const { menu, buttons } = setup();
    menu.showSettingsMenu();
    buttons()[3].click(); // controls
    expect(document.getElementById('gameTitle')?.textContent).toBe('CONTROLS');
    const rows = [...document.querySelectorAll('.stats__row')].map((row) =>
      [...row.children].map((cell) => cell.textContent),
    );
    expect(rows).toContainEqual(['Pause', 'P · Esc · right click']);
    // The shots are the tutorial's to teach: the screen lists the buttons alone
    expect(rows.map(([name]) => name)).toEqual([
      'Paddle',
      'Pause',
      'Fullscreen',
      'Music',
      'Two players',
    ]);
    expect(buttons().map((b) => text(b))).toEqual(['BACK']);
    buttons()[0].click();
    expect(document.getElementById('gameTitle')?.textContent).toBe('SETTINGS');
  });

  it('leaves the difficulty to the quick match, out of the settings', () => {
    const { menu, buttons } = setup();
    menu.showMainMenu();
    buttons()[3].click(); // settings
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
    menu.showSettingsMenu();
    document.getElementById('gameUI')?.classList.add('game__ui--hidden');

    store.update({ musicVolume: 0 });
    expect(document.getElementById('gameUI')?.classList.contains('game__ui--hidden')).toBe(true);
    expect(buttons()[0].getAttribute('aria-valuetext')).toBe('OFF');
  });
});
