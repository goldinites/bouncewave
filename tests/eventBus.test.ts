import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '@/audio/AudioEngine';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { EffectsDirector } from '@/fx/EffectsDirector';
import { ParticleSystem } from '@/fx/ParticleSystem';
import { I18nManager } from '@/i18n/I18nManager';
import { MatchEvent } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';
import { Renderer } from '@/render/Renderer';
import { SettingsStore } from '@/settings/SettingsStore';
import { getDefaultSettings } from '@/settings/UserSettings';
import { EventBus } from '@/shared/EventBus';
import { MenuController } from '@/ui/MenuController';
import { UIManager } from '@/ui/UIManager';

type TestEvent = { type: 'ping'; n: number } | { type: 'pong' };

describe('EventBus', () => {
  it('hands every event to every listener, in the order they subscribed', () => {
    const bus = new EventBus<TestEvent>();
    const heard: string[] = [];
    bus.subscribe((event) => heard.push(`first ${event.type}`));
    bus.subscribe((event) => heard.push(`second ${event.type}`));

    bus.emit({ type: 'ping', n: 1 });
    bus.emit({ type: 'pong' });

    expect(heard).toEqual(['first ping', 'second ping', 'first pong', 'second pong']);
  });

  it('hands a listener of one type only those events', () => {
    const bus = new EventBus<TestEvent>();
    const pings: number[] = [];
    bus.on('ping', (event) => pings.push(event.n));

    bus.emit({ type: 'pong' });
    bus.emit({ type: 'ping', n: 7 });

    expect(pings).toEqual([7]);
  });

  it('stops a listener once it unsubscribes, without skipping the others mid-event', () => {
    const bus = new EventBus<TestEvent>();
    const heard: string[] = [];
    const unsubscribeFirst = bus.subscribe(() => {
      heard.push('first');
      unsubscribeFirst();
    });
    bus.subscribe(() => heard.push('second'));

    bus.emit({ type: 'pong' });
    bus.emit({ type: 'pong' });

    expect(heard).toEqual(['first', 'second', 'second']);
  });

  it('reports a failing listener and still lets the others hear the event', () => {
    const errors: unknown[] = [];
    const bus = new EventBus<TestEvent>((error) => errors.push(error));
    const after = vi.fn();
    bus.subscribe(() => {
      throw new Error('broken effect');
    });
    bus.subscribe(after);

    bus.emit({ type: 'pong' });

    expect(errors).toEqual([new Error('broken effect')]);
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('rethrows a listener’s error when nobody takes errors', () => {
    const bus = new EventBus<TestEvent>();
    bus.subscribe(() => {
      throw new Error('loud');
    });

    expect(() => bus.emit({ type: 'pong' })).toThrow('loud');
  });

  it('drops every listener when cleared', () => {
    const bus = new EventBus<TestEvent>();
    const listener = vi.fn();
    bus.subscribe(listener);

    bus.clear();
    bus.emit({ type: 'pong' });

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('listening to the match', () => {
  const managers: UIManager[] = [];

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="gameUI"></div><h1 id="gameTitle"></h1><p id="gameSubtitle"></p>
      <div id="gameButtons"></div><div id="gameScreen"></div><button id="pauseButton"></button>`;
  });

  afterEach(() => {
    managers.splice(0).forEach((manager) => manager.dispose());
  });

  it('lets the effects react to whatever the match reports', () => {
    const bus = new EventBus<MatchEvent>();
    const renderer = { addShake: vi.fn() };
    const effects = new EffectsDirector({
      renderer: renderer as unknown as Renderer,
      audio: { sfx: { playWallBounce: vi.fn() } } as unknown as AudioEngine,
      particles: new ParticleSystem(),
      paddles: [new Paddle(0, 34, '#19f0ff'), new Paddle(1, 752, '#ff2bd6')],
      translate: () => '',
    });

    const stop = effects.listenTo(bus);
    bus.emit({ type: 'wallBounce', x: 100, y: 14 });
    stop();
    bus.emit({ type: 'wallBounce', x: 100, y: 14 });

    expect(renderer.addShake).toHaveBeenCalledTimes(1);
  });

  it('opens the game-over menu and puts the pause button away when a match ends', () => {
    const bus = new EventBus<MatchEvent>();
    const i18n = new I18nManager('en');
    const ui = new UIManager(i18n);
    managers.push(ui);
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
    );
    ui.hideMenu();
    ui.setPauseButtonVisibility(true);

    menu.listenTo(bus);
    bus.emit({ type: 'serve' });
    expect(ui.isMenuVisible).toBe(false);

    bus.emit({ type: 'gameOver', winnerIndex: 0, scores: [10, 7] });
    expect(ui.isMenuVisible).toBe(true);
    expect(document.getElementById('gameTitle')?.textContent).toBe('YOU WIN');
    expect(document.getElementById('pauseButton')?.classList).toContain('game-pause--hidden');
    menu.dispose();
  });
});
