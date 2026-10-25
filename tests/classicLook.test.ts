import { signal } from '@preact/signals-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '@/audio/AudioEngine';
import { MusicState } from '@/audio/music/intensity';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { ClassicSwitch } from '@/easterEgg/ClassicSwitch';
import { I18nManager } from '@/i18n/I18nManager';
import { SettingsStore } from '@/settings/SettingsStore';
import { getDefaultSettings } from '@/settings/UserSettings';
import { Look } from '@/shared/look';
import { MenuController } from '@/ui/MenuController';
import { UIManager } from '@/ui/UIManager';

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA',
];
const enterCode = () =>
  KONAMI.forEach((code) => window.dispatchEvent(new KeyboardEvent('keydown', { code })));

describe('the classic look’s switch', () => {
  it('switches with the Konami code, and back, only where it may', () => {
    let canSwitch = true;
    const classic = new ClassicSwitch(() => canSwitch, null);

    enterCode();
    expect(classic.look.value).toBe('classic');

    // Outside the main menu (in a match, on another screen) the code does nothing
    canSwitch = false;
    enterCode();
    expect(classic.look.value).toBe('classic');

    canSwitch = true;
    enterCode();
    expect(classic.look.value).toBe('neon');
    classic.dispose();
  });

  it('switches with five quick taps on the title on a phone', () => {
    const title = document.createElement('h1');
    const classic = new ClassicSwitch(() => true, title);
    for (let i = 0; i < 5; i++) title.dispatchEvent(new Event('pointerdown'));
    expect(classic.look.value).toBe('classic');
    classic.dispose();
  });
});

describe('the menus in the classic look', () => {
  const managers: UIManager[] = [];

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="gameUI"></div><h1 id="gameTitle">BOUNCEWAVE</h1><p id="gameSubtitle"></p>
      <div id="gameScreen"></div><button id="pauseButton"></button>`;
  });

  afterEach(() => {
    managers.splice(0).forEach((manager) => manager.dispose());
  });

  const setup = (initial: Look) => {
    const i18n = new I18nManager('en');
    const ui = new UIManager(i18n);
    managers.push(ui);
    const look = signal<Look>(initial);
    const actions = {
      onStartGame: vi.fn(),
      onStartQuickMatch: vi.fn(),
      onStartChallenge: vi.fn(),
      onStartTwoPlayers: vi.fn(),
      onResumeGame: vi.fn(),
      onReturnToMainMenu: vi.fn(),
      onUnlockAudio: vi.fn(),
    };
    const store = new SettingsStore({ load: getDefaultSettings, save: () => {} });
    const menu = new MenuController(
      ui,
      i18n,
      {
        playMenuBack: vi.fn(),
        playMenuMove: vi.fn(),
        playMenuSelect: vi.fn(),
      } as unknown as SoundEffects,
      store,
      actions,
      undefined,
      undefined,
      look,
    );
    const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('#gameScreen button')];
    const labels = () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '#gameScreen button, #gameScreen [data-menu-item]',
        ),
      ]
        .filter((item) => item.tabIndex >= 0)
        .map((item) => item.getAttribute('aria-label') ?? item.textContent);
    return { menu, look, actions, buttons, labels };
  };

  it('offers only a quick match and a match of two, straight from the main menu', () => {
    const { menu, labels } = setup('classic');
    menu.showMainMenu();
    expect(labels()).toEqual(['QUICK MATCH', '2 PLAYERS', 'STATISTICS', 'SETTINGS']);
  });

  it('sets either match up without a backdrop to choose', () => {
    const { menu, buttons, labels, actions } = setup('classic');
    menu.showMainMenu();
    buttons()[0].click();
    expect(labels()).toEqual(['DIFFICULTY', 'POINTS', 'START', 'BACK']);
    buttons()
      .find((b) => b.textContent === 'START')!
      .click();
    expect(actions.onStartQuickMatch).toHaveBeenCalledOnce();

    menu.showTwoPlayerSetup();
    expect(labels()).toEqual(['POINTS', 'START', 'BACK']);
  });

  it('draws the main menu again when the look changes on it', () => {
    const { menu, look, labels } = setup('neon');
    menu.showMainMenu();
    expect(labels()[0]).toBe('PLAY');
    expect(menu.isOnMainMenu).toBe(true);

    look.value = 'classic';
    expect(labels()[0]).toBe('QUICK MATCH');
    look.value = 'neon';
    expect(labels()[0]).toBe('PLAY');
  });

  it('counts only the main menu as the place to switch', () => {
    const { menu, buttons } = setup('neon');
    menu.showMainMenu();
    buttons()[0].click();
    expect(menu.isOnMainMenu).toBe(false);
  });
});

describe('the music in the classic look', () => {
  const state = (isMuted: boolean) => ({ isMuted }) as MusicState;

  it('plays the classic loop with the synthwave mix kept silent, unless the music is off', () => {
    const audio = new AudioEngine(
      () => false,
      () => true,
    );
    const mix = vi.spyOn(audio.music, 'setState');
    const loop = vi.spyOn(
      (audio as unknown as { classicMusic: { setActive: (on: boolean) => void } }).classicMusic,
      'setActive',
    );

    audio.playMusic(state(false));
    expect(mix).toHaveBeenLastCalledWith(state(false));
    expect(loop).toHaveBeenLastCalledWith(false);

    audio.setLook('classic');
    audio.playMusic(state(false));
    expect(mix).toHaveBeenLastCalledWith(state(true));
    expect(loop).toHaveBeenLastCalledWith(true);

    audio.playMusic(state(true));
    expect(loop).toHaveBeenLastCalledWith(false);
    audio.dispose();
  });
});
