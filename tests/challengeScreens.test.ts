import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { I18nManager } from '@/i18n/I18nManager';
import { ChallengeVerdict } from '@/match/ChallengeJudge';
import { CHALLENGE_IDS, ChallengeId } from '@/match/challenges';
import { MatchEvent } from '@/match/MatchFlow';
import {
  ChallengeProgress,
  challengeState,
  isEveryChallengePassed,
  markPassed,
  nextChallenge,
} from '@/profile/ChallengeProgress';
import { loadProfile } from '@/profile/migrations';
import { SettingsStore } from '@/settings/SettingsStore';
import { getDefaultSettings } from '@/settings/UserSettings';
import { EventBus } from '@/shared/EventBus';
import { describeShortfall } from '@/ui/challengeTexts';
import { MenuController } from '@/ui/MenuController';
import { UIManager } from '@/ui/UIManager';

const progressOf = (...passed: ChallengeId[]): ChallengeProgress => ({ passed });

describe('progress through the challenges', () => {
  it('has every challenge open from the start, in any order', () => {
    const states = (progress: ChallengeProgress) =>
      CHALLENGE_IDS.slice(0, 4).map((id) => challengeState(progress, id));

    expect(states(progressOf())).toEqual(['open', 'open', 'open', 'open']);
    expect(states(progressOf('blitz', 'shutout'))).toEqual(['open', 'passed', 'open', 'passed']);
  });

  it('keeps the passed ones once each, in the order of the list', () => {
    let progress = progressOf();
    progress = markPassed(progress, 'insanity');
    progress = markPassed(progress, 'warmUp');
    expect(markPassed(progress, 'insanity')).toBe(progress);
    expect(progress.passed).toEqual(['warmUp', 'insanity']);
    expect(isEveryChallengePassed(progress)).toBe(false);
    expect(isEveryChallengePassed(progressOf(...CHALLENGE_IDS))).toBe(true);
  });

  it('knows which comes next, and that none comes after the last', () => {
    expect(nextChallenge('warmUp')).toBe('blitz');
    expect(nextChallenge(CHALLENGE_IDS[CHALLENGE_IDS.length - 1])).toBeNull();
  });

  it('loads the passed ones it knows, and forgets the rest', () => {
    const load = (challenges: unknown) => loadProfile({ version: 3, challenges }).challenges;

    expect(load({ passed: ['blitz', 'moon', 'warmUp', 'blitz', 7] })).toEqual({
      passed: ['warmUp', 'blitz'],
    });
    expect(load({ passed: 'warmUp' })).toEqual({ passed: [] });
    expect(load('everything')).toEqual({ passed: [] });
  });
});

describe('the challenges in words', () => {
  const en = new I18nManager('en');
  const ru = new I18nManager('ru');

  it('fills a text in, numbers as the language writes them', () => {
    expect(en.format('shortRally', { n: 1500, target: 2 })).toBe('RALLY: 1,500 OF 2');
    expect(ru.format('shortRally', { n: 1500, target: 2 })).toBe('РОЗЫГРЫШ: 1 500 ИЗ 2');
    expect(en.format('shortRally', { n: 18 })).toBe('RALLY: 18 OF {target}');
  });

  it('says what a failed attempt fell short by', () => {
    const verdict = (challenge: ChallengeId, progress: number, target: number) =>
      ({ challenge, isPassed: false, progress, target }) satisfies ChallengeVerdict;

    expect(describeShortfall(en, verdict('longRally', 18, 20))).toBe('RALLY: 18 OF 20');
    expect(describeShortfall(ru, verdict('survival', 7, 15))).toBe('ОЧКИ: 7 ИЗ 15');
    expect(describeShortfall(en, verdict('overload', 3, 5))).toBe('OVERDRIVE SHOTS: 3 OF 5');
    // The goal reached, the attempt spoilt another way
    expect(describeShortfall(en, verdict('overload', 5, 5))).toBe('THE MATCH WAS LOST');
    expect(describeShortfall(en, verdict('shutout', 3, 3))).toBe('A POINT WAS LOST');
    expect(describeShortfall(en, verdict('shutout', 1, 3))).toBe('POINTS: 1 OF 3');
  });
});

describe('the challenges in the menus', () => {
  const managers: UIManager[] = [];

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="gameUI"></div><h1 id="gameTitle"></h1><p id="gameSubtitle"></p>
      <div id="gameButtons"></div><div id="gameScreen"></div><p id="gameHint"></p><button id="pauseButton"></button>`;
  });

  afterEach(() => {
    managers.splice(0).forEach((manager) => manager.dispose());
  });

  const setup = (passed: ChallengeId[] = [], isChallengeMatch = true) => {
    const i18n = new I18nManager('en');
    const ui = new UIManager(i18n);
    managers.push(ui);
    const actions = {
      onStartGame: vi.fn(),
      onStartQuickMatch: vi.fn(),
      onStartChallenge: vi.fn(),
      onResumeGame: vi.fn(),
      onReturnToMainMenu: vi.fn(),
      onUnlockAudio: vi.fn(),
      isChallengeMatch: () => isChallengeMatch,
    };
    const store = new SettingsStore({ load: getDefaultSettings, save: () => {} });
    const menu = new MenuController(ui, i18n, {} as SoundEffects, store, actions, undefined, {
      get: () => ({ passed }),
    });
    const screenButtons = () => [
      ...document.querySelectorAll<HTMLButtonElement>('#gameScreen button'),
    ];
    const button = (label: string) => screenButtons().find((b) => b.textContent === label)!;
    const title = () => document.getElementById('gameTitle')?.textContent;
    const subtitle = () => document.getElementById('gameSubtitle')?.textContent;
    const text = (selector: string) => document.querySelector(selector)?.textContent;
    return { menu, actions, screenButtons, button, title, subtitle, text };
  };

  it('opens the list from PLAY: every challenge open, the passed ones ticked', () => {
    const { menu, screenButtons, button, title, subtitle } = setup(['warmUp', 'giant']);
    menu.showPlayMenu();
    button('CHALLENGE').click();

    expect(title()).toBe('CHALLENGE');
    expect(subtitle()).toBe('PASSED: 2 / 9');
    const items = screenButtons().slice(0, CHALLENGE_IDS.length);
    expect(items.map((b) => b.textContent)).toEqual([
      'WARM-UP',
      'BLITZ',
      'LONG RALLY',
      'SHUTOUT',
      'TWO BALLS',
      'SURVIVAL',
      'GIANT',
      'OVERLOAD',
      'INSANITY',
    ]);
    expect(items.every((b) => !b.disabled)).toBe(true);
    expect(items[0].classList).toContain('challenge-list__item--passed');
    expect(items[6].classList).toContain('challenge-list__item--passed');
    expect(items[8].classList).toContain('challenge-list__item--open');
    expect(screenButtons().at(-1)?.textContent).toBe('BACK');
  });

  it("shows a challenge's card, starts it, and steps back on Esc to the list and PLAY", () => {
    const { menu, actions, button, title, subtitle, text } = setup();
    menu.showChallengeList();
    button('GIANT').click();

    expect(title()).toBe('GIANT');
    expect(subtitle()).toBe(
      'Win to 5 against a Normal opponent whose paddle is half as long again',
    );
    expect(text('.challenge-card__passed')).toBeUndefined();

    button('START').click();
    expect(actions.onStartChallenge).toHaveBeenCalledWith('giant');
    expect(actions.onUnlockAudio).toHaveBeenCalled();

    expect(menu.goBack()).toBe(true);
    expect(title()).toBe('CHALLENGE');
    expect(menu.goBack()).toBe(true);
    expect(title()).toBe('GAME MODE');
  });

  it('marks a passed challenge on its card', () => {
    const { menu, text } = setup(['insanity']);
    menu.showChallengeCard('insanity');

    expect(text('.challenge-card__passed')).toBe('PASSED!');
  });

  it('shows a passed attempt in place of the game-over menu, then NEXT', () => {
    const { menu, actions, screenButtons, button, title, subtitle, text } = setup(['warmUp']);
    const events = new EventBus<MatchEvent>();
    menu.listenTo(events);
    events.emit({ type: 'gameOver', winnerIndex: 0, scores: [3, 1] });
    expect(document.querySelectorAll('#gameButtons button')).toHaveLength(0);

    menu.showChallengeResult({
      verdict: { challenge: 'warmUp', isPassed: true, progress: 3, target: 3 },
      isAllPassed: false,
    });
    expect(title()).toBe('PASSED!');
    expect(subtitle()).toBe('WARM-UP');
    expect(text('.challenge-result__message')).toBe('');
    expect(screenButtons().map((b) => b.textContent)).toEqual(['NEXT', 'ALL CHALLENGES']);

    button('NEXT').click();
    expect(actions.onReturnToMainMenu).toHaveBeenCalledOnce();
    expect(title()).toBe('BLITZ');
  });

  it('shows a failed attempt: what it fell short by, TRY AGAIN and the list', () => {
    const { menu, actions, screenButtons, button, title, text } = setup();
    menu.showChallengeResult({
      verdict: { challenge: 'longRally', isPassed: false, progress: 18, target: 20 },
      isAllPassed: false,
    });

    expect(title()).toBe('NOT PASSED');
    expect(text('.challenge-result__message')).toBe('RALLY: 18 OF 20');
    expect(document.querySelector('.challenge-result__message--celebration')).toBeNull();
    expect(screenButtons().map((b) => b.textContent)).toEqual(['TRY AGAIN', 'ALL CHALLENGES']);

    button('TRY AGAIN').click();
    expect(actions.onStartGame).toHaveBeenCalledOnce();
    button('ALL CHALLENGES').click();
    expect(actions.onReturnToMainMenu).toHaveBeenCalledOnce();
    expect(title()).toBe('CHALLENGE');
  });

  it('celebrates every challenge passed, whichever was the last to go', () => {
    const { menu, screenButtons, text } = setup([...CHALLENGE_IDS]);
    menu.showChallengeResult({
      verdict: { challenge: 'blitz', isPassed: true, progress: 5, target: 5 },
      isAllPassed: true,
    });
    expect(text('.challenge-result__message--celebration')).toBe('EVERY CHALLENGE PASSED');
    expect(screenButtons().map((b) => b.textContent)).toEqual(['NEXT', 'ALL CHALLENGES']);

    // After the last in the list there is no NEXT
    menu.showChallengeResult({
      verdict: { challenge: 'insanity', isPassed: true, progress: 5, target: 5 },
      isAllPassed: false,
    });
    expect(screenButtons().map((b) => b.textContent)).toEqual(['ALL CHALLENGES']);
  });

  it('still shows the game-over menu after a quick match', () => {
    const { menu } = setup([], false);
    const events = new EventBus<MatchEvent>();
    menu.listenTo(events);
    events.emit({ type: 'gameOver', winnerIndex: 0, scores: [5, 1] });

    expect(document.getElementById('gameTitle')?.textContent).toBe('YOU WIN');
  });
});
