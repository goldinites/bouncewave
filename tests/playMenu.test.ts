import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { h } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { I18nManager } from '@/i18n/I18nManager';
import { TRANSLATIONS } from '@/i18n/translations';
import { MATCH_POINTS, MODE_IDS, quickMatchRules } from '@/match/modes';
import { STANDARD_RULES } from '@/match/rules';
import { SettingsStore } from '@/settings/SettingsStore';
import { getDefaultSettings, SETTINGS } from '@/settings/UserSettings';
import { BACKGROUND_CHOICES, SCENES } from '@/shared/scenes';
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
    expect(quickMatchRules(7)).toEqual({ ...STANDARD_RULES, winningScores: [7, 7] });
  });

  it('steps through the lengths and the backgrounds either way, wrapping around', () => {
    const { matchPoints, matchBackground } = SETTINGS;
    expect(MATCH_POINTS.map((points) => matchPoints.next(points))).toEqual([5, 7, 3]);
    expect(MATCH_POINTS.map((points) => matchPoints.previous(points))).toEqual([7, 3, 5]);
    expect(matchBackground.next('random')).toBe(SCENES[0]);
    expect(matchBackground.previous('random')).toBe(SCENES[SCENES.length - 1]);
    expect(matchBackground.next(SCENES[SCENES.length - 1])).toBe('random');
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

  const setupProps = () => {
    const option = {
      id: 'matchPoints',
      name: 'POINTS',
      value: '5',
      color: 'pink' as const,
      onNext: vi.fn(),
      onPrevious: vi.fn(),
    };
    return {
      option,
      props: {
        options: [option],
        previousLabel: 'Previous',
        nextLabel: 'Next',
        startLabel: 'START',
        backLabel: 'BACK',
        onStart: vi.fn(),
        onBack: vi.fn(),
      },
    };
  };

  it('shows each choice as its name and value, between arrows kept off the keyboard', () => {
    render(h(QuickMatchSetup, setupProps().props));

    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      'Previous',
      'Next',
      'START',
      'BACK',
    ]);
    expect(buttons.map((b) => b.tabIndex)).toEqual([-1, -1, 0, 0]);
    expect(buttons[0].className).toBe('game-button game-button--pink option-row__arrow');

    // The value itself is no button: the keyboard reaches it, and reads it out as a spin button
    const value = screen.getByRole('spinbutton', { name: 'POINTS' });
    expect(value.getAttribute('aria-valuetext')).toBe('5');
    expect(value.tabIndex).toBe(0);
    // Its name over its value, as two lines
    expect(value.querySelector('.option-row__name')?.textContent).toBe('POINTS');
    expect(value.querySelector('.option-row__current > span')?.textContent).toBe('5');
  });

  it('steps a choice back or on by its arrows and the left and right keys, not by its value', () => {
    const { option, props } = setupProps();
    render(h(QuickMatchSetup, props));
    const value = screen.getByRole('spinbutton', { name: 'POINTS' });

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(value);
    fireEvent.keyDown(value, { code: 'ArrowLeft' });
    fireEvent.keyDown(value, { code: 'KeyD' });
    fireEvent.keyDown(value, { code: 'ArrowDown' }); // the menu's, not the choice's

    expect(option.onPrevious).toHaveBeenCalledTimes(2);
    expect(option.onNext).toHaveBeenCalledTimes(2);
  });

  it('starts or goes back', () => {
    const { props } = setupProps();
    render(h(QuickMatchSetup, props));

    fireEvent.click(screen.getByRole('button', { name: 'START' }));
    fireEvent.click(screen.getByRole('button', { name: 'BACK' }));
    expect(props.onStart).toHaveBeenCalledOnce();
    expect(props.onBack).toHaveBeenCalledOnce();
  });
});

describe('the PLAY menu and the setup, in the menus', () => {
  const managers: UIManager[] = [];

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="gameUI"></div><h1 id="gameTitle"></h1><p id="gameSubtitle"></p>
      <div id="gameButtons"></div><div id="gameScreen"></div><button id="pauseButton"></button>`;
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
      onStartGame: vi.fn(() => calls.push('again')),
      onStartQuickMatch: vi.fn(() => calls.push('start')),
      onStartChallenge: vi.fn(),
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
    // The buttons the keyboard walks: on the setup, the values without their arrows
    // What the keyboard walks: on the setup, the choices' values without their arrows
    const keyButtons = () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '#gameScreen button, #gameScreen [data-menu-item]',
        ),
      ].filter((item) => item.tabIndex >= 0);
    // A choice reads "NAME: value", as a screen reader would put it
    const labels = () =>
      keyButtons().map((item) =>
        item.getAttribute('role') === 'spinbutton'
          ? `${item.getAttribute('aria-label')}: ${item.getAttribute('aria-valuetext')}`
          : item.textContent,
      );
    const arrows = (label: 'Previous' | 'Next') =>
      screenButtons().filter((b) => b.getAttribute('aria-label') === label);
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
      keyButtons,
      arrows,
      labels,
      title,
      subtitle,
      press,
    };
  };

  it('opens from PLAY: the story switched off, the quick match and the challenges on', () => {
    const { menu, menuButtons, screenButtons, labels, title } = setup('ru');
    menu.showMainMenu();
    menuButtons()[0].click();

    expect(title()).toBe('РЕЖИМ ИГРЫ');
    expect(menuButtons()).toEqual([]);
    expect(labels()).toEqual(['СЮЖЕТ', 'БЫСТРЫЙ МАТЧ', 'ИСПЫТАНИЕ', 'НАЗАД']);
    expect(screenButtons().map((b) => b.disabled)).toEqual([true, false, false, false]);
  });

  it('sets up the quick match: background, difficulty and points, as last chosen', () => {
    const { menu, screenButtons, arrows, labels, title, subtitle, store } = setup();
    menu.showPlayMenu();
    screenButtons()[1].click(); // quick match

    expect(title()).toBe('QUICK MATCH');
    expect(subtitle()).toBe('Opponent: balanced');
    expect(labels()).toEqual([
      'BACKGROUND: RANDOM',
      'DIFFICULTY: NORMAL',
      'POINTS: 5',
      'START',
      'BACK',
    ]);

    arrows('Next')[0].click();
    arrows('Next')[1].click();
    arrows('Next')[2].click();
    expect(store.current).toMatchObject({
      matchBackground: SCENES[0],
      difficulty: getDefaultSettings().difficulty + 1,
      matchPoints: 7,
    });
    expect(labels().slice(0, 3)).toEqual(['BACKGROUND: LASERS', 'DIFFICULTY: HARD', 'POINTS: 7']);
    expect(subtitle()).toBe('Opponent: fast and accurate');
  });

  it('keeps every value’s room in its row, so the row never jumps as the choice steps', () => {
    const { menu } = setup('ru');
    menu.showQuickMatchSetup();
    const sizers = (name: string) =>
      [...document.querySelectorAll(`[aria-label="${name}"] .option-row__sizer`)].map(
        (sizer) => sizer.textContent,
      );

    expect(sizers('ФОН')).toEqual(
      BACKGROUND_CHOICES.map((choice) => TRANSLATIONS.ru.backgrounds[choice]),
    );
    expect(sizers('ОЧКИ')).toEqual(['3', '5', '7']);
    expect(
      [...document.querySelectorAll('.option-row__sizer')].every(
        (sizer) => sizer.getAttribute('aria-hidden') === 'true',
      ),
    ).toBe(true);
  });

  it('steps each choice back and on by its arrows, wrapping around', () => {
    const { menu, arrows, labels, store } = setup();
    menu.showQuickMatchSetup();

    arrows('Previous')[0].click();
    arrows('Previous')[2].click();
    expect(labels().slice(0, 3)).toEqual(['BACKGROUND: JUNGLE', 'DIFFICULTY: NORMAL', 'POINTS: 3']);
    arrows('Next')[0].click();
    arrows('Previous')[1].click();
    arrows('Previous')[1].click(); // below the easiest, round to the hardest
    expect(store.current).toMatchObject({ matchBackground: 'random', matchPoints: 3 });
    expect(labels()[1]).toBe('DIFFICULTY: INSANE');
  });

  it('starts the match from START once the audio is unlocked, and again from PLAY AGAIN', () => {
    const { menu, actions, calls, keyButtons, menuButtons } = setup();
    menu.showQuickMatchSetup();

    keyButtons()[3].click(); // start
    expect(calls).toEqual(['unlock', 'start']);

    menu.showGameOverMenu(1, [2, 5]);
    menuButtons()[0].click(); // play again
    expect(calls).toEqual(['unlock', 'start', 'unlock', 'again']);
    expect(actions.onStartQuickMatch).toHaveBeenCalledOnce();
  });

  it('steps back on Esc: setup, PLAY menu, main menu', () => {
    const { menu, menuButtons, title } = setup();
    menu.showQuickMatchSetup();

    expect(menu.goBack()).toBe(true);
    expect(title()).toBe('GAME MODE');
    expect(menu.goBack()).toBe(true);
    expect(menuButtons().map((b) => b.textContent)).toEqual([
      'PLAY',
      'MULTIPLAYER',
      'STATISTICS',
      'SETTINGS',
    ]);
    expect(menu.goBack()).toBe(false);
  });

  it('walks the keyboard past the modes that are switched off', () => {
    const { menu, menuButtons, screenButtons, press } = setup();
    menu.showMainMenu();

    menuButtons()[0].focus();
    menuButtons()[0].click(); // play
    expect(document.activeElement).toBe(screenButtons()[1]); // quick match, the first on

    press('ArrowDown');
    expect(document.activeElement).toBe(screenButtons()[2]); // challenges
    press('ArrowDown');
    expect(document.activeElement).toBe(screenButtons()[3]); // back
    press('ArrowDown');
    expect(document.activeElement).toBe(screenButtons()[1]);
    press('Home');
    expect(document.activeElement).toBe(screenButtons()[1]);
  });

  it('keeps the focus on a choice as it steps, and moves it on between screens', () => {
    const { menu, menuButtons, screenButtons, keyButtons, arrows, labels, press } = setup();
    menu.showPlayMenu();
    screenButtons()[1].focus();
    screenButtons()[1].click(); // quick match
    expect(document.activeElement).toBe(keyButtons()[0]);

    press('ArrowDown');
    // Difficulty: the right key steps it on, redrawing the setup around the focus
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }),
    );
    expect(labels()[1]).toBe('DIFFICULTY: HARD');
    expect(document.activeElement).toBe(keyButtons()[1]);
    arrows('Next')[1].click(); // its arrow leaves the focus on the value
    expect(document.activeElement).toBe(keyButtons()[1]);

    press('End');
    keyButtons()[4].click(); // back to the PLAY menu
    expect(document.activeElement).toBe(screenButtons()[1]);
    screenButtons()[3].click(); // back to the main menu
    expect(document.activeElement).toBe(menuButtons()[0]);
  });
});

describe('telling the game the quick match setup is on screen', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="gameUI"></div><h1 id="gameTitle"></h1><p id="gameSubtitle"></p>
      <div id="gameButtons"></div><div id="gameScreen"></div><button id="pauseButton"></button>`;
  });

  it('says so as it opens and as it gives way, not as it is redrawn', () => {
    const ui = new UIManager(new I18nManager('en'));
    const onQuickMatchSetup = vi.fn();
    const store = new SettingsStore({ load: getDefaultSettings, save: () => {} });
    const menu = new MenuController(ui, new I18nManager('en'), {} as SoundEffects, store, {
      onStartGame: vi.fn(),
      onStartQuickMatch: vi.fn(),
      onStartChallenge: vi.fn(),
      onResumeGame: vi.fn(),
      onReturnToMainMenu: vi.fn(),
      onUnlockAudio: vi.fn(),
      onQuickMatchSetup,
    });

    menu.showPlayMenu();
    menu.showQuickMatchSetup();
    store.cycle('matchBackground'); // redraws the setup
    menu.showQuickMatchSetup();
    menu.showPlayMenu();
    expect(onQuickMatchSetup.mock.calls).toEqual([[true], [false]]);
    ui.dispose();
  });
});
