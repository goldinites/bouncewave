import { readFileSync } from 'node:fs';
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from '@/app/Game';
import { MatchEvent } from '@/match/MatchFlow';
import { EventBus } from '@/shared/EventBus';
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
const screenButton = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('#gameScreen button')].find(
    (button) => (button.getAttribute('aria-label') ?? button.textContent) === label,
  )!;
/** The value a quick match choice shows, by its name. */
const choice = (name: string) =>
  document
    .querySelector(`[role="spinbutton"][aria-label="${name}"]`)
    ?.getAttribute('aria-valuetext');
/** PLAY, QUICK MATCH, then START as it is set up. */
const play = () => {
  buttons()[0].click();
  screenButton('QUICK MATCH').click();
  screenButton('START').click();
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
    expect(labels()).toEqual(['PLAY', 'MULTIPLAYER', 'STATISTICS', 'SETTINGS']);
    expect(isPauseButtonShown()).toBe(false);
  });

  it('opens the modes from PLAY, and steps back through them on Esc', () => {
    buttons()[0].click();
    expect($('#gameTitle').textContent).toBe('GAME MODE');
    screenButton('QUICK MATCH').click();
    expect($('#gameTitle').textContent).toBe('QUICK MATCH');
    expect(isMenuOpen()).toBe(true);

    press('Escape');
    expect($('#gameTitle').textContent).toBe('GAME MODE');
    press('Escape');
    expect($('#gameTitle').textContent).toBe('BOUNCEWAVE');
    expect(labels()).toEqual(['PLAY', 'MULTIPLAYER', 'STATISTICS', 'SETTINGS']);
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
    buttons()[2].click(); // settings
    expect($('#gameTitle').textContent).toBe('SETTINGS');

    press('Escape');
    expect($('#gameTitle').textContent).toBe('PAUSED');
    expect(isMenuOpen()).toBe(true);
  });

  it('keeps the quick match set up as it was left for the next visit', () => {
    buttons()[0].click();
    screenButton('QUICK MATCH').click();
    const nextArrows = () => document.querySelectorAll<HTMLButtonElement>('[aria-label="Next"]');
    nextArrows()[2].click(); // points
    nextArrows()[0].click(); // background
    expect(choice('POINTS')).toBe('7');
    game.dispose();

    document.body.innerHTML = BODY;
    game = new Game($<HTMLCanvasElement>('#gameCanvas'));
    game.init();
    buttons()[0].click();
    screenButton('QUICK MATCH').click();
    expect(choice('POINTS')).toBe('7');
    expect(choice('BACKGROUND')).toBe('LASERS');
  });

  it('restarts the match from the pause', () => {
    play();
    press('Escape'); // pause
    expect(labels()).toEqual(['RESUME', 'RESTART', 'SETTINGS', 'MAIN MENU']);

    buttons()[1].click(); // restart
    expect(isMenuOpen()).toBe(false);
    expect(isPauseButtonShown()).toBe(true);
    press('Escape');
    expect($('#gameTitle').textContent).toBe('PAUSED');
  });

  it('plays a challenge from its card, keeps it passed and opens the next one', () => {
    buttons()[0].click(); // play
    screenButton('CHALLENGE').click();
    expect(screenButton('BLITZ').disabled).toBe(true);
    screenButton('WARM-UP').click();
    screenButton('START').click();
    expect(isMenuOpen()).toBe(false);

    // The match ends in the player's win: the attempt's result comes instead of the game-over menu
    const { matchEvents } = game as unknown as { matchEvents: EventBus<MatchEvent> };
    matchEvents.emit({ type: 'gameOver', winnerIndex: 0, scores: [3, 0] });
    expect($('#gameTitle').textContent).toBe('PASSED!');
    expect($('.challenge-result__message').textContent).toBe('UNLOCKED: BLITZ');
    expect(JSON.parse(localStorage.getItem('bouncewave_profile')!).challenges).toEqual({
      passed: ['warmUp'],
    });

    screenButton('ALL CHALLENGES').click();
    expect($('#gameSubtitle').textContent).toBe('PASSED: 1 / 9');
    expect(screenButton('BLITZ').disabled).toBe(false);

    // A quick match after it is a quick match again: its end is the game-over menu
    press('Escape');
    screenButton('QUICK MATCH').click();
    screenButton('START').click();
    matchEvents.emit({ type: 'gameOver', winnerIndex: 1, scores: [1, 5] });
    expect($('#gameTitle').textContent).toBe('GAME OVER');
  });

  it('switches every text outside the menus to the language picked', () => {
    buttons()[3].click(); // settings
    document.querySelector<HTMLButtonElement>('#gameScreen [aria-label="Next"]')!.click(); // language

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
