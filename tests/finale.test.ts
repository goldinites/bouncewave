import { describe, expect, it } from 'vitest';
import { GAME_WIDTH } from '@/constants/game.constants';
import {
  FINAL_SIGN_DELAY,
  FINAL_SIGN_IGNITE,
  FIREWORK_INTERVAL,
  FIREWORK_SHOTS,
} from '@/constants/visual.constants';
import { VictoryFireworks } from '@/fx/VictoryFireworks';
import { FinalScoreRenderer } from '@/render/FinalScoreRenderer';

const COLORS = ['#19f0ff', '#ffffff', '#ffe53b'];

describe('VictoryFireworks', () => {
  it('fires the first shot immediately at the goal height', () => {
    const fireworks = new VictoryFireworks(1, 200, COLORS, () => 0.5);
    const [first] = fireworks.update(0);

    expect(first.y).toBe(200);
    expect(first.x).toBeGreaterThan(GAME_WIDTH * 0.9);
    expect(first.color).toBe(COLORS[0]);
  });

  it('spaces shots out and walks them toward center court', () => {
    const fireworks = new VictoryFireworks(1, 200, COLORS, () => 0.5);
    const shots = [];

    for (let t = 0; t <= FIREWORK_INTERVAL * FIREWORK_SHOTS; t += 0.01) {
      shots.push(...fireworks.update(0.01));
    }

    expect(shots).toHaveLength(FIREWORK_SHOTS);
    expect(shots[shots.length - 1].x).toBeCloseTo(GAME_WIDTH / 2);
    expect(fireworks.isDone).toBe(true);
  });

  it('launches from the left goal when the ball went in there', () => {
    const fireworks = new VictoryFireworks(-1, 200, COLORS, () => 0.5);
    const [first] = fireworks.update(0);

    expect(first.x).toBeLessThan(GAME_WIDTH * 0.1);
  });

  it('never fires a shot twice', () => {
    const fireworks = new VictoryFireworks(1, 200, COLORS);
    const firstFrame = fireworks.update(0);
    const sameFrameAgain = fireworks.update(0);

    expect(firstFrame).toHaveLength(1);
    expect(sameFrameAgain).toHaveLength(0);
  });
});

describe('FinalScoreRenderer.getBrightness', () => {
  it('stays dark until the ignition delay', () => {
    expect(FinalScoreRenderer.getBrightness(0, true)).toBe(0);
    expect(FinalScoreRenderer.getBrightness(FINAL_SIGN_DELAY * 0.9, true)).toBe(0);
  });

  it('flickers while igniting: both lit and dark moments', () => {
    const samples = Array.from({ length: 50 }, (_, i) =>
      FinalScoreRenderer.getBrightness(FINAL_SIGN_DELAY + (i / 50) * FINAL_SIGN_IGNITE, true),
    );

    expect(samples.some((b) => b === 0)).toBe(true);
    expect(samples.some((b) => b >= 0.8)).toBe(true);
  });

  it('burns steadily after ignition on a win', () => {
    for (let age = 1.2; age < 3; age += 0.05) {
      expect(FinalScoreRenderer.getBrightness(age, true)).toBeGreaterThan(0.85);
    }
  });

  it('keeps sputtering after ignition on a loss', () => {
    const samples = Array.from({ length: 200 }, (_, i) =>
      FinalScoreRenderer.getBrightness(1.2 + i * 0.01, false),
    );

    expect(samples.some((b) => b < 0.5)).toBe(true);
    expect(samples.some((b) => b > 0.85)).toBe(true);
  });
});
