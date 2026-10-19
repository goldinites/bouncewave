import { describe, expect, it } from 'vitest';
import { BackdropMood } from '@/render/BackdropMood';

/** Runs the mood for `seconds` at 60 frames a second. */
const run = (
  mood: BackdropMood,
  seconds: number,
  gameState: 'menu' | 'play' = 'play',
  climax = 0,
  serveTime = 0,
) => {
  for (let t = 0; t < seconds; t += 1 / 60) mood.update(1 / 60, gameState, serveTime, climax);
  return mood.current(climax);
};

describe('BackdropMood', () => {
  it('burns full behind the menus and while a point is served, low in play', () => {
    const mood = new BackdropMood();
    expect(run(mood, 3, 'menu').laserIntensity).toBeCloseTo(1, 2);
    expect(run(mood, 3, 'play').laserIntensity).toBeCloseTo(0.12, 2);
    expect(run(mood, 3, 'play', 0, 0.5).laserIntensity).toBeCloseTo(1, 2);
  });

  it('lifts with the climax, only part-way so the court stays readable', () => {
    const mood = new BackdropMood();
    const lights = run(mood, 4, 'play', 1).laserIntensity;
    expect(lights).toBeCloseTo(0.6, 2);
    expect(mood.current(1).climax).toBe(1);
  });

  it('swells when the climax peaks, and settles again', () => {
    const mood = new BackdropMood();
    const calm = run(mood, 4);
    mood.swell();
    expect(run(mood, 0.5).laserIntensity).toBeGreaterThan(calm.laserIntensity + 0.05);
    expect(run(mood, 6).laserIntensity).toBeCloseTo(calm.laserIntensity, 2);
  });

  it('celebrates a victory all the way up, then calms down, at once when the match is put away', () => {
    const mood = new BackdropMood();
    run(mood, 4);
    mood.celebrate();
    const height = run(mood, 1);
    expect(height.celebration).toBeGreaterThan(0.5);
    expect(height.laserIntensity).toBeGreaterThan(0.6);

    mood.calm();
    expect(mood.current(0).celebration).toBe(0);
  });
});
