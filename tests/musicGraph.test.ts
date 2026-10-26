import { afterEach, describe, expect, it, vi } from 'vitest';
import { MusicGraph } from '@/audio/music/MusicGraph';
import { ROOMS } from '@/audio/music/rooms';
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
      graph.setBassGrit(10, i);
    }
    // Mute, tone, the echo's two ping-pong delays, and the bass's drive and its trim
    expect(targets() - before).toBe(6);

    graph.setMuted(true);
    graph.setToneFilter(450, 300);
    graph.setEchoTime(0.5, 300);
    graph.setBassGrit(0, 300);
    expect(targets() - before).toBe(12);
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

    graph.recover();

    const [gainRamp] = callsOf(calls, 'linearRampToValueAtTime').slice(-1);
    expect(gainRamp.args).toEqual([1, 10.6]);
  });

  it('thins the pads and the melody out on the deciding point, and brings them back', () => {
    const { ctx, calls } = fakeAudioContext(10);
    const graph = new MusicGraph(ctx);
    const fades = (level: number) =>
      callsOf(calls, 'setTargetAtTime').filter((c) => c.args[0] === level).length;

    graph.setDramaLevel(0.6);
    expect(fades(0)).toBe(2);
    // No filter muffles it: that is the pause's sound
    expect(callsOf(calls, 'setTargetAtTime').some((c) => (c.args[0] as number) > 1)).toBe(false);

    graph.setDramaLevel(0.25);
    expect(fades(0.5)).toBe(2);
    graph.setDramaLevel(0);
    expect(fades(1)).toBe(2);
  });

  it('brings the music back after a break, a lost signal and a rewind', () => {
    const { ctx, calls } = fakeAudioContext(10);
    const graph = new MusicGraph(ctx);

    // A break stops dead
    graph.cutOut(12, 0.5);
    const gainRamps = () => callsOf(calls, 'linearRampToValueAtTime');
    expect(gainRamps().map((c) => c.args)).toEqual([
      [0, 12.004],
      [1, 12.5],
    ]);

    // A lost signal sinks to a muffled trace, never to silence, and comes back open
    graph.dropSignal(13, 0.3);
    const [sink, comeBack] = gainRamps().slice(-2);
    expect(sink.args[0]).toBeGreaterThan(0);
    expect(comeBack.args).toEqual([1, 13.3]);
    const [muffle, open] = callsOf(calls, 'exponentialRampToValueAtTime').slice(-2);
    expect(muffle.args[0]).toBeLessThan(1000);
    expect(open.args).toEqual([20000, 13.3]);

    // The rewind bends the pitch and lands back on it, without a jump at either end
    graph.rewind(14, 1);
    const [curve] = callsOf(calls, 'setValueCurveAtTime').slice(-1);
    const values = curve.args[0] as Float32Array;
    expect(curve.args.slice(1)).toEqual([14, 1]);
    expect(values[0]).toBe(0);
    expect(values[values.length - 1]).toBeCloseTo(0);
    expect(Math.max(...values)).toBeGreaterThan(0.05);
    const steps = values.slice(1).map((v, i) => Math.abs(v - values[i]));
    expect(steps[0]).toBeLessThan(0.002);
    expect(steps[steps.length - 1]).toBeLessThan(0.002);
  });

  describe('rooms', () => {
    afterEach(() => vi.useRealTimers());

    const returnsTo = (calls: AudioCall[], level: number) =>
      callsOf(calls, 'setTargetAtTime').filter((c) => c.args[0] === level);

    it('fades the next song’s room in as the last one fades out', () => {
      const { ctx, calls } = fakeAudioContext();
      const graph = new MusicGraph(ctx);

      graph.setSongSpace('cathedral', 1, 1);
      expect(returnsTo(calls, ROOMS.cathedral.return).map((c) => c.args[1])).toEqual([1]);
      // The same room every step: nothing more is automated
      for (let i = 2; i < 50; i++) graph.setSongSpace('cathedral', 1, i);
      expect(callsOf(calls, 'createConvolver')).toHaveLength(1);

      graph.setSongSpace('studio', 0, 60);
      expect(returnsTo(calls, ROOMS.studio.return).map((c) => c.args[1])).toEqual([60]);
      expect(returnsTo(calls, 0).at(-1)!.args[1]).toBe(60);
      expect(callsOf(calls, 'createConvolver')).toHaveLength(2);
    });

    it('builds a room ahead off the scheduler’s tick, and frees one only once its tail has died', () => {
      vi.useFakeTimers();
      const { ctx, calls } = fakeAudioContext(0);
      const graph = new MusicGraph(ctx);
      const convolvers = () => callsOf(calls, 'createConvolver').length;
      const frees = () => callsOf(calls, 'disconnect').length;

      graph.setSongSpace('fog', 1, 0);
      graph.prepareRoom('valley');
      expect(convolvers()).toBe(1);
      vi.runAllTimers();
      expect(convolvers()).toBe(2);

      // The valley plays; the fog fades out, its long tail still ringing
      graph.setSongSpace('valley', 1, 10);
      expect(convolvers()).toBe(2);
      ctx.currentTime = 11;
      graph.prepareRoom('valley');
      expect(frees()).toBe(0);
      ctx.currentTime = 10 + 2 + ROOMS.fog.decay;
      graph.prepareRoom('valley');
      expect(frees()).toBeGreaterThan(0);
    });

    it('stops building rooms ahead once disposed', () => {
      vi.useFakeTimers();
      const { ctx, calls } = fakeAudioContext();
      const graph = new MusicGraph(ctx);
      graph.prepareRoom('stone');
      graph.dispose();
      vi.runAllTimers();
      expect(callsOf(calls, 'createConvolver')).toHaveLength(0);
    });
  });

  it('beats with the kicks as they sound: the last one sounding, as hard as it was, fading', () => {
    const { ctx } = fakeAudioContext();
    const graph = new MusicGraph(ctx);
    expect(graph.beatAt(1)).toBe(0);

    graph.pump(1, 0.75);
    graph.pump(1.5, 0.375);
    // Before the first kick sounds there is no beat; at it, full; it fades until the next
    expect(graph.beatAt(0.9)).toBe(0);
    expect(graph.beatAt(1)).toBeCloseTo(1);
    expect(graph.beatAt(1.2)).toBeLessThan(0.5);
    expect(graph.beatAt(1.2)).toBeGreaterThan(0);
    // The next kick, played half as hard, lands half as hard
    expect(graph.beatAt(1.5)).toBeCloseTo(0.5);
  });
});
