import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { h } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { I18nManager } from '@/i18n/I18nManager';
import { TRANSLATIONS } from '@/i18n/translations';
import { MODE_IDS, MODES } from '@/match/modes';
import { STANDARD_RULES } from '@/match/rules';
import { SettingsStore } from '@/settings/SettingsStore';
import { getDefaultSettings } from '@/settings/UserSettings';
import { MenuController } from '@/ui/MenuController';
import { ModeSelect } from '@/ui/screens/ModeSelect';
import { UIManager } from '@/ui/UIManager';

describe('modes', () => {
  it('names and describes every mode in every language', () => {
    for (const translations of Object.values(TRANSLATIONS)) {
      expect(Object.keys(translations.modes).sort()).toEqual([...MODE_IDS].sort());
      for (const [name, description] of Object.values(translations.modes)) {
        expect(name).not.toBe('');
        expect(description).not.toBe('');
      }
    }
  });

  it('plays the standard match as it has always been played', () => {
    expect(MODES.standard.rules).toBe(STANDARD_RULES);
  });

  it('plays the quick match to 3, otherwise as the standard one', () => {
    expect(MODES.quick.rules).toEqual({ ...STANDARD_RULES, winningScore: 3 });
  });
});

describe('the mode screen', () => {
  afterEach(cleanup);

  const props = () => ({
    modes: [
      {
        id: 'standard' as const,
        name: 'STANDARD MATCH',
        description: 'First to 10',
        color: 'cyan' as const,
      },
      {
        id: 'quick' as const,
        name: 'QUICK MATCH',
        description: 'First to 3',
        color: 'yellow' as const,
      },
    ] as const,
    backLabel: 'BACK',
    onPick: vi.fn(),
    onBack: vi.fn(),
  });

  it('shows a card per mode with its name and what it is, then BACK', () => {
    render(h(ModeSelect, props()));

    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      'STANDARD MATCHFirst to 10',
      'QUICK MATCHFirst to 3',
      'BACK',
    ]);
  });

  it("colors each card by its mode's color", () => {
    render(h(ModeSelect, props()));

    expect(screen.getAllByRole('button').map((b) => b.className)).toEqual([
      'game-button mode-card',
      'game-button game-button--yellow mode-card',
      'game-button',
    ]);
  });

  it('starts the mode picked, and goes back from BACK', () => {
    const p = props();
    render(h(ModeSelect, p));

    fireEvent.click(screen.getByRole('button', { name: /QUICK MATCH/ }));
    expect(p.onPick).toHaveBeenCalledWith('quick');
    fireEvent.click(screen.getByRole('button', { name: 'BACK' }));
    expect(p.onBack).toHaveBeenCalledOnce();
  });
});

describe('the mode screen in the menus', () => {
  const managers: UIManager[] = [];

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="gameUI"></div><h1 id="gameTitle"></h1><p id="gameSubtitle"></p>
      <div id="gameButtons"></div><div id="gameScreen"></div><p id="gameHint"></p><button id="pauseButton"></button>`;
  });

  afterEach(() => {
    managers.splice(0).forEach((manager) => manager.dispose());
  });

  const setup = (language: 'en' | 'ru' = 'en') => {
    const i18n = new I18nManager(language);
    const ui = new UIManager(i18n);
    managers.push(ui);
    const calls: string[] = [];
    const actions = {
      onStartGame: vi.fn(() => calls.push('start')),
      onResumeGame: vi.fn(),
      onReturnToMainMenu: vi.fn(),
      onUnlockAudio: vi.fn(() => calls.push('unlock')),
    };
    const store = new SettingsStore({ load: getDefaultSettings, save: () => {} });
    const menu = new MenuController(ui, i18n, {} as SoundEffects, store, actions);
    const menuButtons = () => [
      ...document.querySelectorAll<HTMLButtonElement>('#gameButtons button'),
    ];
    const screenButtons = () => [
      ...document.querySelectorAll<HTMLButtonElement>('#gameScreen button'),
    ];
    const title = () => document.getElementById('gameTitle')?.textContent;
    return { menu, actions, calls, menuButtons, screenButtons, title };
  };

  it('opens from PLAY with a card per mode, in the current language', () => {
    const { menu, menuButtons, screenButtons, title } = setup('ru');
    menu.showMainMenu();
    menuButtons()[0].click();

    expect(title()).toBe('РЕЖИМ ИГРЫ');
    expect(menuButtons()).toEqual([]);
    expect(screenButtons().map((b) => b.querySelector('.mode-card__name')?.textContent)).toEqual([
      ...MODE_IDS.map((id) => TRANSLATIONS.ru.modes[id][0]),
      undefined, // back
    ]);
    expect(screenButtons().at(-1)?.textContent).toBe('НАЗАД');
  });

  it('starts the mode picked once the audio is unlocked, and PLAY AGAIN starts it again', () => {
    const { menu, actions, calls, screenButtons, menuButtons } = setup();
    menu.showModeSelect();

    screenButtons()[0].click();
    expect(actions.onStartGame).toHaveBeenLastCalledWith('standard');
    expect(calls).toEqual(['unlock', 'start']);

    menu.showGameOverMenu(0, [10, 4]);
    menuButtons()[0].click(); // play again
    expect(actions.onStartGame).toHaveBeenCalledTimes(2);
    expect(actions.onStartGame).toHaveBeenLastCalledWith('standard');
  });

  it('plays a quick match again after a quick match', () => {
    const { menu, actions, screenButtons, menuButtons } = setup();
    menu.showModeSelect();

    screenButtons()[MODE_IDS.indexOf('quick')].click();
    expect(actions.onStartGame).toHaveBeenLastCalledWith('quick');

    menu.showGameOverMenu(1, [1, 3]);
    menuButtons()[0].click(); // play again
    expect(actions.onStartGame).toHaveBeenLastCalledWith('quick');
  });

  it('goes back to the main menu from BACK and from Esc', () => {
    const { menu, screenButtons, menuButtons } = setup();
    menu.showModeSelect();
    screenButtons().at(-1)?.click();
    expect(menuButtons().map((b) => b.textContent)).toEqual(['PLAY', 'SETTINGS']);
    expect(screenButtons()).toEqual([]);

    menu.showModeSelect();
    expect(menu.goBack()).toBe(true);
    expect(menuButtons().map((b) => b.textContent)).toEqual(['PLAY', 'SETTINGS']);
    expect(menu.goBack()).toBe(false);
  });

  it('carries the keyboard focus from PLAY to the first card and back', () => {
    const { menu, screenButtons, menuButtons } = setup();
    const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    menu.showMainMenu();

    menuButtons()[0].focus();
    menuButtons()[0].click();
    expect(document.activeElement).toBe(screenButtons()[0]);

    press('End');
    expect(document.activeElement).toBe(screenButtons().at(-1));
    press('ArrowDown');
    expect(document.activeElement).toBe(screenButtons()[0]);

    press('End');
    screenButtons().at(-1)?.click(); // back
    expect(document.activeElement).toBe(menuButtons()[0]);
  });
});
