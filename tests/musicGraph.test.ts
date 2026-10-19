import { describe, expect, it } from 'vitest';
import { MusicGraph } from '@/audio/music/MusicGraph';
import { AudioCall, fakeAudioContext } from './helpers/fakeAudioContext';

const callsOf = (calls: AudioCall[], method: string) => calls.filter((c) => c.method === method);

describe('MusicGraph', () => {
  it('automates parameters only when their value changes', () => {
    const { ctx, calls } = fakeAudioContext();
    const graph = new MusicGraph(ctx);
    const targets = () => callsOf(calls, 'setTargetAtTime').length;
    const before = targets();

    // What the scheduler does many times a second for as long as the game runs
    for (let i = 0; i < 200; i++) {
      graph.setMuted(false);
      graph.setToneFilter(16000, i);
      graph.setEchoTime(0.4 + (i % 2) * 0.0005, i); // tempo drifting by a hair
    }
    expect(targets() - before).toBe(3);

    graph.setMuted(true);
    graph.setToneFilter(450, 300);
    graph.setEchoTime(0.5, 300);
    expect(targets() - before).toBe(6);
  });

  it('lets a running tape stop finish before recovering, instead of overlapping it', () => {
    const { ctx, calls } = fakeAudioContext(10);
    const graph = new MusicGraph(ctx);

    graph.tapeStop(1.1);
    graph.recover(); // the finale was skipped while the tape was still stopping
    const tapeStopEnd = 10 + 1.1;

    const [delayReset] = callsOf(calls, 'setValueAtTime').slice(-1);
    expect(delayReset.args).toEqual([0, tapeStopEnd]);
    const [gainRamp] = callsOf(calls, 'linearRampToValueAtTime').slice(-1);
    expect(gainRamp.args[0]).toBe(1);
    expect(gainRamp.args[1]).toBeCloseTo(tapeStopEnd + 0.6);
  });

  it('recovers right away when no tape stop is running', () => {
    const { ctx, calls } = fakeAudioContext(10);
    const graph = new MusicGraph(ctx);

    graph.duck();
    graph.recover();

    const [gainRamp] = callsOf(calls, 'linearRampToValueAtTime').slice(-1);
    expect(gainRamp.args).toEqual([1, 10.6]);
  });

  it('brings the music back after a drop-out, and a rewind back to its pitch', () => {
    const { ctx, calls } = fakeAudioContext(10);
    const graph = new MusicGraph(ctx);

    graph.cutOut(12, 0.5);
    const [comeBack] = callsOf(calls, 'linearRampToValueAtTime').slice(-1);
    expect(comeBack.args).toEqual([1, 12.5]);

    graph.rewind(13, 1);
    const [curve] = callsOf(calls, 'setValueCurveAtTime').slice(-1);
    const values = curve.args[0] as Float32Array;
    expect(curve.args.slice(1)).toEqual([13, 1]);
    expect(values[0]).toBe(0);
    expect(values[values.length - 1]).toBeCloseTo(0);
    expect(Math.max(...values)).toBeGreaterThan(0.1);
  });
});
