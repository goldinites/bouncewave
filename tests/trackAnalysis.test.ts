import { describe, expect, it } from 'vitest';
import { STEPS_PER_BAR } from '@/audio/music/score';
import {
  ANALYSIS,
  bandPowers,
  centroidHz,
  formatReport,
  hitMargin,
  levelChange,
  levels,
  levelTrack,
  longestGap,
  logEdges,
  longestStill,
  melodyStats,
  novelty,
  overlap,
  powerSpectrum,
  selfSimilarity,
  textureChanges,
  TrackReport,
  worstJump,
} from '../e2e/render/analysis';

const RATE = 48000;

const sine = (hz: number, seconds: number, amplitude = 1) =>
  Float32Array.from(
    { length: Math.round(seconds * RATE) },
    (_, i) => amplitude * Math.sin((2 * Math.PI * hz * i) / RATE),
  );

describe('track analysis', () => {
  it('reads a full-scale sine at -3 dB, its peak at 0', () => {
    const { rms, peak } = levels(sine(1000, 1));
    expect(rms).toBeCloseTo(-3.01, 1);
    expect(peak).toBeCloseTo(0, 1);
  });

  it('puts a tone’s power in its own band, as much as its mean square', () => {
    const power = powerSpectrum(sine(440, 0.1), 0);
    const edges = [20, 300, 600, 20000];
    const [below, at, above] = bandPowers(power, RATE, edges);
    expect(at).toBeCloseTo(0.5, 1);
    expect(below + above).toBeLessThan(at / 1000);
  });

  it('leaves no band of a fine picture empty below the first bins', () => {
    const power = powerSpectrum(sine(60, 0.2), 0);
    const bands = bandPowers(power, RATE, logEdges(40, 80, 40));
    expect(bands.every((band) => band > 0)).toBe(true);
  });

  it('finds a spectrum’s pitch centre and how much two spectra share', () => {
    const edges = logEdges(100, 1600, 4); // 100, 200, 400, 800, 1600
    expect(centroidHz([0, 1, 0, 0], edges)).toBeCloseTo(Math.sqrt(200 * 400), 5);
    expect(overlap([1, 1, 0, 0], [2, 2, 0, 0])).toBeCloseTo(1);
    expect(overlap([1, 0, 0, 0], [0, 0, 0, 1])).toBe(0);
    expect(overlap([1, 1, 0, 0], [0, 1, 1, 0])).toBeCloseTo(0.5);
  });

  it('sees a change of texture where one sound gives way to another, and none inside either', () => {
    // Eight bars low and dark, then eight high and bright, each bar a little different
    const bars = Array.from({ length: 16 }, (_, bar) =>
      bar < 8 ? [10, 5 + (bar % 2), 1, 0.1] : [0.1, 1, 5 + (bar % 2), 10],
    );
    const similarity = selfSimilarity(bars);
    expect(similarity[0][7]).toBeGreaterThan(0.9);
    expect(similarity[0][8]).toBeLessThan(0);
    const changes = textureChanges(novelty(similarity));
    expect(changes).toEqual([8]);
    expect(longestStill(changes, 16)).toEqual({ from: 0, length: 8 });
  });

  it('finds no change in a track that never changes', () => {
    const bars = Array.from({ length: 32 }, () => [10, 5, 1, 0.1]);
    const changes = textureChanges(novelty(selfSimilarity(bars)));
    expect(changes).toEqual([]);
    expect(longestStill(changes, 32)).toEqual({ from: 0, length: 32 });
  });

  it('measures how far a hit stands above the music, and where', () => {
    const music = sine(200, 0.5, 0.3);
    const withHit = music.slice();
    const at = 0.2;
    const hit = sine(2000, ANALYSIS.HIT_WINDOW, 0.1);
    hit.forEach((value, i) => (withHit[Math.round(at * RATE) + i] += value));
    const margin = hitMargin(music, withHit, RATE, at);
    // Little of the 200 Hz tone reaches the hit's band (only what leaks from cutting out a short
    // window): the hit stands far above it there
    expect(margin.best).toBeGreaterThan(25);
    expect(margin.inBand).toBeGreaterThan(25);
    expect(margin.bestHz).toBeGreaterThan(1000);
    expect(margin.bestHz).toBeLessThan(4000);

    // The same hit under music in its own band, ten times louder: buried
    const loud = sine(2000, 0.5, 1);
    const loudWithHit = loud.slice();
    hit.forEach((value, i) => (loudWithHit[Math.round(at * RATE) + i] += value));
    expect(hitMargin(loud, loudWithHit, RATE, at).best).toBeLessThan(0);
  });

  it('counts a melody’s notes per bar, its quick runs and its held notes', () => {
    const lead = new Array(STEPS_PER_BAR * 2).fill(null);
    // Bar 1: three sixteenths in a row, then a held half bar; bar 2: one quarter
    lead[0] = { note: 60, steps: 1 };
    lead[1] = { note: 62, steps: 1 };
    lead[2] = { note: 64, steps: 2 };
    lead[4] = { note: 65, steps: 8 };
    lead[16] = { note: 67, steps: 4 };
    expect(melodyStats({ bars: 2, lead })).toEqual({ perBar: [4, 1], quick: 3 / 5, held: 1 / 5 });
    expect(melodyStats({ bars: 2, lead: null })).toBeNull();
  });

  it('turns a measured loudness into the level change to the target, to half a dB', () => {
    expect(levelChange(ANALYSIS.TARGET_DB)).toBe(0);
    expect(levelChange(ANALYSIS.TARGET_DB - 3)).toBe(4);
    expect(levelChange(ANALYSIS.TARGET_DB + 1)).toBe(-1.5);
  });

  it('writes the report with every part, every hit and the suggested level', () => {
    const report: TrackReport = {
      title: 'Test Song',
      id: 'test-song',
      bpm: 120,
      level: -1,
      options: '',
      parts: [
        {
          name: 'verse',
          tier: 'groove',
          bar: 0,
          bars: 8,
          rms: -27,
          peak: -12,
          bands: [-5, -3, -8, -15, -24, -30],
          phoneLoss: 6.5,
          leadHz: 600,
          arpHz: 1200,
          leadArpOverlap: 0.3,
          melody: { perBar: [4, 2], quick: 0.5, held: 0.25 },
        },
      ],
      loudness: -27,
      hitPart: 'verse',
      hits: [{ kind: 'player', margins: [{ inBand: 2, best: 8, bestHz: 2000 }] }],
      hitResidual: -100,
      novelty: [0, 0.2],
      bars: 8,
      changes: [],
      still: { from: 0, length: 8 },
      moments: [
        {
          name: 'win',
          events: 'sting 2.0',
          levels: [-30, -28],
          jump: { ratio: 2.5, at: 2.4 },
          gap: 0,
        },
      ],
      renderSeconds: 10,
    };
    const markdown = formatReport(report);
    expect(markdown).toContain('# Test Song');
    expect(markdown).toContain('| verse · groove | 1–8 | -27.0 | -12.0 |');
    expect(markdown).toContain('level -1.0 → **+1.5** (+2.5)');
    expect(markdown).toContain('| player | +8.0 | 2000 | +8.0 | yes | +2.0 |');
    expect(markdown).not.toContain('unreliable');
    expect(markdown).toContain('| win | sting 2.0 | **×2.5 at 2.40 s** | 0.00 | -30 -28 |');
  });

  describe('match moments', () => {
    const rate = 1000;
    // A steady tone: the music a click is measured against
    const tone = (seconds: number) =>
      Float32Array.from({ length: seconds * rate }, (_, i) => 0.1 * Math.sin(i / 5));

    it('finds a click as a jump far steeper than the music before it', () => {
      const samples = tone(4);
      samples[3000] = 0.9;
      const jump = worstJump(samples, tone(4), rate, 2);
      expect(jump.ratio).toBeGreaterThan(ANALYSIS.JUMP_SUSPECT);
      expect(jump.at).toBeCloseTo(3, 1);
      expect(worstJump(tone(4), tone(4), rate, 2).ratio).toBeLessThanOrEqual(1);
    });

    it('measures the longest drop-out, and the level as it goes', () => {
      const samples = tone(4);
      samples.fill(0, 2500, 3000);
      expect(longestGap(samples, rate, 2)).toBeCloseTo(0.5, 1);
      expect(levelTrack(samples, rate, 1)).toHaveLength(4);
    });
  });
});
