import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { I18nManager } from '@/i18n/I18nManager';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { DifficultyLevel } from '@/match/difficulty';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';
import { Side } from '@/match/side';
import { loadProfile } from '@/profile/migrations';
import { ProfileStore } from '@/profile/ProfileStore';
import { getEmptyStatistics, MatchRecord, recordMatch } from '@/profile/Statistics';
import { StatsRecorder } from '@/profile/StatsRecorder';
import { SettingsStore } from '@/settings/SettingsStore';
import { getDefaultSettings } from '@/settings/UserSettings';
import { EventBus } from '@/shared/EventBus';
import { MenuController } from '@/ui/MenuController';
import { UIManager } from '@/ui/UIManager';

const match = (overrides: Partial<MatchRecord> = {}): MatchRecord => ({
  difficulty: DifficultyLevel.NORMAL,
  isWin: true,
  longestRally: 6,
  perfectHits: 3,
  powerShots: 1,
  ...overrides,
});

describe('counting a match in', () => {
  it('adds up a win: the tallies, the points, the hits and the streak', () => {
    const stats = recordMatch(getEmptyStatistics(), match({ difficulty: DifficultyLevel.HARD }));

    expect(stats).toMatchObject({
      played: 1,
      won: 1,
      longestRally: 6,
      perfectHits: 3,
      powerShots: 1,
      streak: 1,
      bestStreak: 1,
    });
    expect(stats.byDifficulty[DifficultyLevel.HARD]).toEqual({ played: 1, won: 1 });
    expect(stats.byDifficulty[DifficultyLevel.NORMAL]).toEqual({ played: 0, won: 0 });
  });

  it('keeps the longest rally, and ends a streak with a loss but keeps the best', () => {
    let stats = getEmptyStatistics();
    stats = recordMatch(stats, match({ longestRally: 12 }));
    stats = recordMatch(stats, match({ longestRally: 4 }));
    stats = recordMatch(stats, match({ isWin: false, longestRally: 8 }));

    expect(stats).toMatchObject({ played: 3, won: 2, longestRally: 12, streak: 0, bestStreak: 2 });
    expect(stats.byDifficulty[DifficultyLevel.NORMAL]).toEqual({ played: 3, won: 2 });
  });

  it('loads saved statistics count by count, a bad one back to 0', () => {
    const { stats } = loadProfile({
      version: 2,
      stats: {
        played: 4,
        won: -1,
        longestRally: 3.5,
        perfectHits: 'many',
        byDifficulty: { [DifficultyLevel.HARD]: { played: 2, won: 1 } },
      },
    });

    expect(stats).toMatchObject({ played: 4, won: 0, longestRally: 0, perfectHits: 0 });
    expect(stats.byDifficulty[DifficultyLevel.HARD]).toEqual({ played: 2, won: 1 });
    expect(stats.byDifficulty[DifficultyLevel.INSANE]).toEqual({ played: 0, won: 0 });
  });
});

describe('recording matches from their events', () => {
  const setup = (playerSide: Side | null = 0) => {
    const profile = new ProfileStore(null);
    const events = new EventBus<MatchEvent>();
    new StatsRecorder({
      profile,
      match: { isPlayerPaddle: (i) => playerSide !== null && i === 0, playerSide },
      getDifficulty: () => DifficultyLevel.INSANE,
    }).listenTo(events);
    const hit = (paddleIndex: number, rally: number, isPerfect = false, isPowerShot = false) =>
      events.emit({
        type: 'paddleHit',
        paddleIndex,
        isPerfect,
        x: 0,
        y: 0,
        speed: 400,
        rally,
        isPowerShot,
        chargedOverdrive: false,
      });
    const score = (side: Side) =>
      events.emit({ type: 'score', scoringPlayerIndex: side, y: 0, isDemo: false });
    const gameOver = (winnerIndex: Side, scores: [number, number]) =>
      events.emit({ type: 'gameOver', winnerIndex, scores });
    return { profile, events, hit, score, gameOver };
  };

  it("counts the player's finished match: their hits, the rally and the win", () => {
    const { profile, events, hit, score, gameOver } = setup();
    events.emit({ type: 'matchStart' });
    hit(0, 1, true);
    hit(1, 2, true); // the CPU's perfect hit is not the player's
    hit(0, 3, true, true);
    score(0);
    score(1);
    score(0);
    gameOver(0, [2, 1]);

    expect(profile.current.stats).toMatchObject({
      played: 1,
      won: 1,
      perfectHits: 2,
      powerShots: 1,
      longestRally: 3,
      streak: 1,
    });
    expect(profile.current.stats.byDifficulty[DifficultyLevel.INSANE]).toEqual({
      played: 1,
      won: 1,
    });
  });

  it('counts nothing of a match left for the menu, or restarted halfway', () => {
    const { profile, events, hit, score, gameOver } = setup();
    events.emit({ type: 'matchStart' });
    hit(0, 9, true);
    score(1);
    events.emit({ type: 'returnToMenu' });
    gameOver(1, [0, 3]); // stray: no match on

    events.emit({ type: 'matchStart' });
    score(1);
    events.emit({ type: 'matchStart' }); // restart
    score(0);
    gameOver(0, [1, 0]);

    expect(profile.current.stats).toMatchObject({
      played: 1,
      won: 1,
      perfectHits: 0,
      longestRally: 0,
    });
  });

  it('counts a loss on the player side, wherever they play', () => {
    const { profile, events, gameOver } = setup(1);
    events.emit({ type: 'matchStart' });
    gameOver(0, [3, 1]);
    expect(profile.current.stats).toMatchObject({ played: 1, won: 0, streak: 0 });
  });

  it('leaves the demo out: no one plays it', () => {
    const { profile, events, hit, gameOver } = setup(null);
    events.emit({ type: 'matchStart' });
    hit(0, 5, true);
    gameOver(0, [3, 0]);
    expect(profile.current.stats).toEqual(getEmptyStatistics());
  });

  it('knows who plays: the player in a match, no one in the demo', () => {
    const flow = new MatchFlow({
      paddles: [
        new Paddle(0, PADDLE.OFFSET_X, '#19f0ff'),
        new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6'),
      ],
      ball: new Ball(),
      input: { pollPlayerMovement: () => {} },
      getDifficulty: () => DifficultyLevel.NORMAL,
      onEvent: () => {},
      random: () => 0.25,
    });

    flow.startAttract();
    expect(flow.playerSide).toBeNull();
    flow.startMatch();
    expect(flow.playerSide).toBe(0);
    expect([0, 1].map((i) => flow.isPlayerPaddle(i))).toEqual([true, false]);
  });
});

describe('the statistics screen', () => {
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
    let stats = getEmptyStatistics();
    stats = recordMatch(stats, match({ difficulty: DifficultyLevel.HARD }));
    stats = recordMatch(stats, match({ isWin: false, longestRally: 14 }));
    stats = recordMatch(stats, match());
    const menu = new MenuController(
      ui,
      i18n,
      {} as SoundEffects,
      new SettingsStore({ load: getDefaultSettings, save: () => {} }),
      {
        onStartGame: vi.fn(),
        onStartQuickMatch: vi.fn(),
        onStartChallenge: vi.fn(),
        onResumeGame: vi.fn(),
        onReturnToMainMenu: vi.fn(),
        onUnlockAudio: vi.fn(),
      },
      {
        get: () => stats,
        reset: () => {
          stats = getEmptyStatistics();
        },
      },
      { get: () => ({ passed: ['warmUp', 'blitz'] }) },
    );
    const rows = () =>
      [...document.querySelectorAll('#gameScreen .stats__row')].map(
        (row) => `${row.querySelector('dt')?.textContent} ${row.querySelector('dd')?.textContent}`,
      );
    return { menu, rows };
  };

  it('opens from the main menu, under the multiplayer still switched off', () => {
    const { menu } = setup();
    menu.showMainMenu();
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('#gameButtons button')];
    expect(buttons.map((b) => b.textContent)).toEqual([
      'PLAY',
      'MULTIPLAYER',
      'STATISTICS',
      'SETTINGS',
    ]);
    expect(buttons.map((b) => b.disabled)).toEqual([false, true, false, false]);

    // The keyboard walks past the multiplayer
    buttons[0].focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }));
    expect(document.activeElement).toBe(buttons[2]);

    buttons[2].click();
    expect(document.getElementById('gameTitle')?.textContent).toBe('STATISTICS');
  });

  it('shows the record, then the wins at each difficulty, then the challenges passed', () => {
    const { menu, rows } = setup();
    menu.showStatistics();

    expect(rows()).toEqual([
      'MATCHES 3',
      'WINS 2 (67%)',
      'WIN STREAK 1',
      'BEST STREAK 1',
      'LONGEST RALLY 14',
      'PERFECT HITS 9',
      'OVERDRIVE SHOTS 3',
      'EASY 0 / 0',
      'NORMAL 1 / 2',
      'HARD 1 / 1',
      'INSANE 0 / 0',
      'PASSED 2 / 9',
    ]);
    expect([...document.querySelectorAll('.stats__heading')].map((h) => h.textContent)).toEqual([
      'WINS BY DIFFICULTY',
      'CHALLENGES',
    ]);
  });

  it('wipes the statistics only on a second press of RESET', () => {
    const { menu, rows } = setup();
    menu.showStatistics();
    const reset = () =>
      [...document.querySelectorAll<HTMLButtonElement>('#gameScreen button')].find((b) =>
        /RESET/.test(b.textContent ?? ''),
      )!;

    act(() => reset().click());
    expect(reset().textContent).toBe('SURE? RESET');
    expect(rows()[0]).toBe('MATCHES 3');

    act(() => reset().click());
    expect(rows()[0]).toBe('MATCHES 0');
    expect(rows()[1]).toBe('WINS 0 (0%)');
    expect(reset().textContent).toBe('RESET');
  });

  it('speaks the language, and goes back to the main menu on Esc', () => {
    const { menu, rows } = setup('ru');
    menu.showStatistics();
    expect(rows()[0]).toBe('МАТЧИ 3');

    expect(menu.goBack()).toBe(true);
    expect(document.querySelectorAll('#gameScreen .stats__row')).toHaveLength(0);
  });
});
