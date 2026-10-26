import { describe, expect, it, vi } from 'vitest';
import { MatchReplay } from '@/app/MatchReplay';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';
import type { Renderer } from '@/render/Renderer';
import type { RenderFrame } from '@/render/scene';

/** Every renderer call the replay's effects make, answered and forgotten. */
const renderer = new Proxy({}, { get: () => vi.fn() }) as unknown as Renderer;

const hit = (rally: number, isPerfect = false): MatchEvent => ({
  type: 'paddleHit',
  paddleIndex: rally % 2,
  isPerfect,
  x: 100,
  y: 250,
  speed: 600,
  angle: 0,
  heading: 0,
  rally,
  isPowerShot: false,
  chargedOverdrive: false,
});
const FINALE: MatchEvent = {
  type: 'finaleStart',
  winnerIndex: 0,
  ballY: 250,
  scores: [10, 3],
  reason: 'points',
};

const setup = (isEnabled = true) => {
  let time = 0;
  const paddles = [
    new Paddle(0, PADDLE.OFFSET_X, '#19f0ff'),
    new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6'),
  ];
  const ball = new Ball();
  const replay = new MatchReplay({
    renderer,
    paddles: () => paddles,
    time: () => time,
    isEnabled: () => isEnabled,
    label: () => 'REPLAY',
  });
  const published: MatchEvent[] = [];
  const publish = (event: MatchEvent) => published.push(event);
  const flow = {
    isDemo: false,
    phase: 'rally',
    get time() {
      return time;
    },
    balls: [ball],
    rally: 0,
  } as unknown as MatchFlow;

  /** Plays `seconds` of a point at 60 frames a second, the ball crossing the court. */
  const play = (seconds: number) => {
    for (let t = 0; t < seconds; t += 1 / 60) {
      time += 1 / 60;
      ball.drawX = (time * 400) % COURT.WIDTH;
      replay.record(flow);
    }
  };

  /** Ends the point with a goal after a rally of `hits`, the last one perfect if asked. */
  const win = (hits: number, isLastPerfect = false) => {
    replay.route({ type: 'serve' }, publish);
    for (let i = 1; i <= hits; i++) {
      play(0.3);
      replay.route(hit(i, isLastPerfect && i === hits), publish);
    }
    play(0.3);
    replay.route({ type: 'score', scoringPlayerIndex: 0, y: 250, isDemo: false }, publish);
    replay.route(FINALE, publish);
  };

  return { replay, published, win };
};

const finales = (events: MatchEvent[]) => events.filter((e) => e.type === 'finaleStart');

describe('MatchReplay', () => {
  it('passes everything the match reports straight on', () => {
    const { published, win } = setup();
    win(2);
    expect(published.map((e) => e.type)).toEqual([
      'serve',
      'paddleHit',
      'paddleHit',
      'score',
      'finaleStart',
    ]);
  });

  it('holds the finale back for a long rally won, plays it again slowed, then lets it go on', () => {
    const { replay, published, win } = setup();
    win(6);
    expect(finales(published)).toHaveLength(0);
    expect(replay.isHolding).toBe(true);

    // The goal's beat, then about 4 s of replay
    let shown = 0;
    for (let t = 0; t < 6 && replay.isHolding; t += 1 / 60) {
      replay.update(1 / 60);
      if (replay.isShowing) shown += 1 / 60;
    }
    expect(shown).toBeGreaterThan(3.5);
    expect(shown).toBeLessThan(5);
    expect(finales(published)).toHaveLength(1);
    expect(replay.isShowing).toBe(false);
  });

  it('replays a short point won off a perfect hit, but not a plain one', () => {
    const perfect = setup();
    perfect.win(2, true);
    expect(perfect.replay.isHolding).toBe(true);

    const plain = setup();
    plain.win(2);
    expect(plain.replay.isHolding).toBe(false);
  });

  it('shows nothing again where it may not (the classic look, the tutorial)', () => {
    const { replay, published, win } = setup(false);
    win(8);
    expect(replay.isHolding).toBe(false);
    expect(finales(published)).toHaveLength(1);
  });

  it('skips to the finale at a press', () => {
    const { replay, published, win } = setup();
    win(6);
    for (let i = 0; i < 60; i++) replay.update(1 / 60);
    expect(replay.isShowing).toBe(true);
    expect(replay.skip()).toBe(true);
    expect(finales(published)).toHaveLength(1);
    expect(replay.skip()).toBe(false);
  });

  it('draws the court from its recording, in cinema bars, zoomed on the ball', () => {
    const { replay, win } = setup();
    win(6);
    for (let i = 0; i < 60; i++) replay.update(1 / 60);
    const live = {
      court: { balls: [], paddles: [], ball: new Ball() },
      hud: { overdriveCharges: [3, null], overdriveStreaks: [3, null] },
      drama: { climax: 0 },
      replay: null,
    } as unknown as RenderFrame;
    const frame = replay.frame(live);
    expect(frame.replay).toEqual({ label: 'REPLAY' });
    expect(frame.court.balls).toHaveLength(1);
    expect(frame.drama.zoom).toBeGreaterThan(1);
    expect(frame.hud.overdriveCharges).toEqual([null, null]);
  });
});
