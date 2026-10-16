import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ps1MusicEngine } from '@/audio/music/Ps1MusicEngine';
import { StepScheduler } from '@/audio/music/StepScheduler';
import { fakeAudioContext } from './helpers/fakeAudioContext';

const STEP = 0.1;

const makeScheduler = (canRun = () => true) => {
  const { ctx } = fakeAudioContext(0);
  const steps: number[] = [];
  const scheduler = new StepScheduler(ctx, {
    playStep: (time) => {
      steps.push(time);
      return STEP;
    },
    canRun,
  });
  return { ctx, steps, scheduler };
};

describe('StepScheduler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules the steps due in the look-ahead window, each once', () => {
    const { ctx, steps, scheduler } = makeScheduler();

    scheduler.tick();
    expect(steps.map((t) => +t.toFixed(2))).toEqual([0, 0.1]);

    ctx.currentTime = 0.1;
    scheduler.tick();
    expect(steps.map((t) => +t.toFixed(2))).toEqual([0, 0.1, 0.2]);
    scheduler.dispose();
  });

  it('resyncs to the present after falling behind instead of replaying what it missed', () => {
    let running = false;
    const { ctx, steps, scheduler } = makeScheduler(() => running);

    scheduler.tick();
    expect(steps).toHaveLength(0);

    ctx.currentTime = 60;
    running = true;
    scheduler.tick();

    expect(steps.length).toBeLessThanOrEqual(2);
    expect(Math.min(...steps)).toBeGreaterThanOrEqual(60);
    scheduler.dispose();
  });

  it('ticks on its own timer until disposed', () => {
    vi.useFakeTimers();
    const { ctx, steps, scheduler } = makeScheduler();

    vi.advanceTimersByTime(25);
    const afterFirstTick = steps.length;
    expect(afterFirstTick).toBeGreaterThan(0);

    scheduler.dispose();
    ctx.currentTime = 1;
    vi.advanceTimersByTime(100);
    expect(steps).toHaveLength(afterFirstTick);
  });
});

describe('Ps1MusicEngine', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("doesn't fire a burst of notes when switched on long after it started", () => {
    vi.useFakeTimers();
    const { ctx, calls } = fakeAudioContext(0);
    const engine = new Ps1MusicEngine();
    engine.init(ctx);

    // Classic mode switched on a minute later
    ctx.currentTime = 60;
    engine.setActive(true);
    const before = calls.length;
    vi.advanceTimersByTime(25);

    const starts = calls
      .slice(before)
      .filter((call) => call.method === 'start')
      .map((call) => call.args[0] as number);
    expect(starts.length).toBeGreaterThan(0);
    expect(starts.length).toBeLessThan(30);
    expect(Math.min(...starts)).toBeGreaterThanOrEqual(60);
    engine.dispose();
  });
});
