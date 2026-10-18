import { readFileSync } from 'node:fs';
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from '@/app/Game';
import { fakeContext } from './helpers/fakeContext';

// The real page, so the game finds every element it expects
const BODY = /<body>([\s\S]*)<\/body>/
  .exec(readFileSync('index.html', 'utf8'))![1]
  .replace(/<script[\s\S]*?<\/script>/g, '');

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('#gameButtons button')];
const labels = () => buttons().map((button) => button.textContent);
const isMenuOpen = () => !$('#gameUI').classList.contains('game__ui--hidden');
const isPauseButtonShown = () => !$('#pauseButton').classList.contains('game-pause--hidden');
const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }));
/** PLAY, then the first mode on the mode screen. */
const play = () => {
  buttons()[0].click();
  $<HTMLButtonElement>('#gameScreen .mode-card').click();
};

describe('Game', () => {
  let game: Game;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = BODY;

    // A canvas context that also hands out gradients, which the renderer builds up front
    const { ctx, spies } = fakeContext();
    (spies.createLinearGradient as Mock).mockReturnValue(spies);
    (spies.createRadialGradient as Mock).mockReturnValue(spies);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as RenderingContext,
    );

    game = new Game($<HTMLCanvasElement>('#gameCanvas'));
    game.init();
  });

  afterEach(() => {
    game.dispose();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('opens on the main menu, with the title the page shows', () => {
    expect(isMenuOpen()).toBe(true);
    expect($('#gameTitle').textContent).toBe('BOUNCEWAVE');
    expect(labels()).toEqual(['PLAY', 'SETTINGS']);
    expect(isPauseButtonShown()).toBe(false);
  });

  it('opens the mode screen from PLAY, and goes back to the main menu on Esc', () => {
    buttons()[0].click();
    expect($('#gameTitle').textContent).toBe('GAME MODE');
    expect(isMenuOpen()).toBe(true);

    press('Escape');
    expect($('#gameTitle').textContent).toBe('BOUNCEWAVE');
    expect(labels()).toEqual(['PLAY', 'SETTINGS']);
    expect($('#gameScreen').childElementCount).toBe(0);
  });

  it('starts a match from PLAY, and pauses and resumes it with Esc', () => {
    play();
    expect(isMenuOpen()).toBe(false);
    expect(isPauseButtonShown()).toBe(true);

    press('Escape');
    expect(isMenuOpen()).toBe(true);
    expect($('#gameTitle').textContent).toBe('PAUSED');

    press('Escape');
    expect(isMenuOpen()).toBe(false);
  });

  it('steps back from the settings to the pause menu on Esc', () => {
    play();
    press('Escape'); // pause
    buttons()[1].click(); // settings
    expect($('#gameTitle').textContent).toBe('SETTINGS');

    press('Escape');
    expect($('#gameTitle').textContent).toBe('PAUSED');
    expect(isMenuOpen()).toBe(true);
  });

  it('switches every text outside the menus to the language picked', () => {
    buttons()[1].click(); // settings
    buttons()[3].click(); // language

    expect(document.documentElement.lang).toBe('ru');
    expect($('#pauseButton').getAttribute('aria-label')).toBe('Пауза');
    expect($('#gameHint').textContent).toMatch(/пауза/);
  });

  it('stops answering the keyboard once disposed', () => {
    play();
    game.dispose();

    press('Escape');
    expect(isMenuOpen()).toBe(false);
  });
});
