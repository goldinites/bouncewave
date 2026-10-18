import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { h } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { I18nManager } from '@/i18n/I18nManager';
import { TRANSLATIONS } from '@/i18n/translations';
import { MATCH_POINTS, MODE_IDS, nextMatchPoints, quickMatchRules } from '@/match/modes';
import { STANDARD_RULES } from '@/match/rules';
import { SettingsStore } from '@/settings/SettingsStore';
import { getDefaultSettings } from '@/settings/UserSettings';
import { BACKGROUND_CHOICES, nextBackgroundChoice, SCENES } from '@/shared/scenes';
import { MenuController } from '@/ui/MenuController';
import { PlayMenu } from '@/ui/screens/PlayMenu';
import { QuickMatchSetup } from '@/ui/screens/QuickMatchSetup';
import { UIManager } from '@/ui/UIManager';

describe('modes', () => {
  it('names every mode and every background in every language', () => {
    for (const translations of Object.values(TRANSLATIONS)) {
      expect(Object.keys(translations.modes).sort()).toEqual([...MODE_IDS].sort());
      expect(Object.keys(translations.backgrounds).sort()).toEqual([...BACKGROUND_CHOICES].sort());
      expect([
        ...Object.values(translations.modes),
        ...Object.values(translations.backgrounds),
      ]).not.toContain('');
    }
  });

  it('plays a quick match to the points set, otherwise by the standard rules', () => {
    expect(MATCH_POINTS).toEqual([3, 5, 7]);
    expect(quickMatchRules(7)).toEqual({ ...STANDARD_RULES, winningScore: 7 });
  });

  it('steps through the lengths and the backgrounds, wrapping around', () => {
    expect([3, 5, 7].map((points) => nextMatchPoints(points as 3 | 5 | 7))).toEqual([5, 7, 3]);
    expect(nextBackgroundChoice('random')).toBe(SCENES[0]);
    expect(nextBackgroundChoice(SCENES[SCENES.length - 1])).toBe('random');
  });
});

describe('the PLAY menu and the setup, as screens', () => {
  afterEach(cleanup);

  it("shows a mode that can't be played yet, switched off", () => {
    const onPick = vi.fn();
    render(
      h(PlayMenu, {
        modes: [
          { id: 'story', name: 'STORY', color: 'pink', isPlayable: false },
          { id: 'quick', name: 'QUICK MATCH', color: 'cyan', isPlayable: true },
        ],
        backLabel: 'BACK',
        onPick,
        onBack: vi.fn(),
      }),
    );

    const story = screen.getByRole('button', { name: 'STORY' }) as HTMLButtonElement;
    expect(story.disabled).toBe(true);
    expect(story.className).toBe('game-button game-button--pink');
    fireEvent.click(story);
    fireEvent.click(screen.getByRole('button', { name: 'QUICK MATCH' }));
    expect(onPick.mock.calls).toEqual([['quick']]);
  });

  it('steps a choice on, and starts or goes back', () => {
    const props = {
      options: [
        { id: 'matchPoints', label: 'POINTS TO WIN: 5', color: 'pink' as const, onCycle: vi.fn() },
      ],
      startLabel: 'START',
      backLabel: 'BACK',
      onStart: vi.fn(),
      onBack: vi.fn(),
    };
    render(h(QuickMatchSetup, props));

    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'POINTS TO WIN: 5',
      'START',
      'BACK',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'POINTS TO WIN: 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'START' }));
    fireEvent.click(screen.getByRole('button', { name: 'BACK' }));
    expect(props.options[0].onCycle).toHaveBeenCalledOnce();
    expect(props.onStart).toHaveBeenCalledOnce();
    expect(props.onBack).toHaveBeenCalledOnce();
  });
});

describe('the PLAY menu and the setup, in the menus', () => {
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
    const labels = () => screenButtons().map((b) => b.textContent);
    const title = () => document.getElementById('gameTitle')?.textContent;
    const subtitle = () => document.getElementById('gameSubtitle')?.textContent;
    const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    return {
      menu,
      actions,
      calls,
      store,
      menuButtons,
      screenButtons,
      labels,
      title,
      subtitle,
      press,
    };
  };

  it('opens from PLAY: the story and the challenges switched off, the quick match on', () => {
    const { menu, menuButtons, screenButtons, labels, title } = setup('ru');
    menu.showMainMenu();
    menuButtons()[0].click();

    expect(title()).toBe('РЕЖИМ ИГРЫ');
    expect(menuButtons()).toEqual([]);
    expect(labels()).toEqual(['СЮЖЕТ', 'БЫСТРЫЙ МАТЧ', 'ИСПЫТАНИЕ', 'НАЗАД']);
    expect(screenButtons().map((b) => b.disabled)).toEqual([true, false, true, false]);
  });

  it('sets up the quick match: background, difficulty and points, as last chosen', () => {
    const { menu, screenButtons, labels, title, subtitle, store } = setup();
    menu.showPlayMenu();
    screenButtons()[1].click(); // quick match

    expect(title()).toBe('QUICK MATCH');
    expect(subtitle()).toBe('vs CPU: a balanced opponent');
    expect(labels()).toEqual([
      'BACKGROUND: RANDOM',
      'DIFFICULTY: NORMAL',
      'POINTS TO WIN: 5',
      'START',
      'BACK',
    ]);

    screenButtons()[0].click();
    screenButtons()[1].click();
    screenButtons()[2].click();
    expect(store.current).toMatchObject({
      matchBackground: SCENES[0],
      difficulty: getDefaultSettings().difficulty + 1,
      matchPoints: 7,
    });
    expect(labels().slice(0, 3)).toEqual([
      'BACKGROUND: LASERS',
      'DIFFICULTY: HARD',
      'POINTS TO WIN: 7',
    ]);
    expect(subtitle()).toBe('vs CPU: fast and accurate');
  });

  it('starts the match from START once the audio is unlocked, and again from PLAY AGAIN', () => {
    const { menu, actions, calls, screenButtons, menuButtons } = setup();
    menu.showQuickMatchSetup();

    screenButtons()[3].click(); // start
    expect(calls).toEqual(['unlock', 'start']);

    menu.showGameOverMenu(1, [2, 5]);
    menuButtons()[0].click(); // play again
    expect(actions.onStartGame).toHaveBeenCalledTimes(2);
  });

  it('steps back on Esc: setup, PLAY menu, main menu', () => {
    const { menu, menuButtons, title } = setup();
    menu.showQuickMatchSetup();

    expect(menu.goBack()).toBe(true);
    expect(title()).toBe('GAME MODE');
    expect(menu.goBack()).toBe(true);
    expect(menuButtons().map((b) => b.textContent)).toEqual(['PLAY', 'SETTINGS']);
    expect(menu.goBack()).toBe(false);
  });

  it('walks the keyboard past the modes that are switched off', () => {
    const { menu, menuButtons, screenButtons, press } = setup();
    menu.showMainMenu();

    menuButtons()[0].focus();
    menuButtons()[0].click(); // play
    expect(document.activeElement).toBe(screenButtons()[1]); // quick match, the first on

    press('ArrowDown');
    expect(document.activeElement).toBe(screenButtons()[3]); // back
    press('ArrowDown');
    expect(document.activeElement).toBe(screenButtons()[1]);
    press('Home');
    expect(document.activeElement).toBe(screenButtons()[1]);
  });

  it('keeps the focus on a choice as it steps, and moves it on between screens', () => {
    const { menu, menuButtons, screenButtons, press } = setup();
    menu.showPlayMenu();
    screenButtons()[1].focus();
    screenButtons()[1].click(); // quick match
    expect(document.activeElement).toBe(screenButtons()[0]);

    press('ArrowDown');
    screenButtons()[1].click(); // difficulty, redrawing the setup
    expect(document.activeElement).toBe(screenButtons()[1]);

    press('End');
    screenButtons()[4].click(); // back to the PLAY menu
    expect(document.activeElement).toBe(screenButtons()[1]);
    screenButtons()[3].click(); // back to the main menu
    expect(document.activeElement).toBe(menuButtons()[0]);
  });
});
