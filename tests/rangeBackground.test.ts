import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioSpectrum } from '@/render/backgrounds/AudioSpectrum';
import { RangeBackground } from '@/render/backgrounds/RangeBackground';
import { BackgroundRenderer } from '@/render/BackgroundRenderer';
import { seededRandom } from '@/shared/random';
import { EXCLUSIVE_SCENES, isPickableScene } from '@/shared/scenes';
import { fakeContext } from './helpers/fakeContext';

const renderFrame = (background: RangeBackground, isRotated = false) => {
  const { ctx, spies } = fakeContext();
  spies.createLinearGradient.mockReturnValue({ addColorStop: vi.fn() });
  const spectrum = new AudioSpectrum();
  spectrum.update(null);
  background.render({
    ctx,
    spectrum,
    pulse: 0.5,
    time: 3,
    isRotated,
    laserIntensity: 1,
    climax: 0,
    celebration: 0,
  });
  return spies;
};

/** Runs the background's own clock for a while, as the frames do. */
const run = (background: RangeBackground, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) {
    background.advance(1 / 60, 0, 0);
    renderFrame(background);
  }
};

type Inside = { scanAge: number; paths: { age: number }[] };
const inside = (background: RangeBackground) => background as unknown as Inside;

describe('RangeBackground', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is the tutorial’s own, never offered to the quick match', () => {
    const background = new RangeBackground();
    expect(background.scene).toBe('range');
    expect(EXCLUSIVE_SCENES.tutorial).toContain('range');
    expect(isPickableScene(background.scene)).toBe(false);
    expect(new BackgroundRenderer().scenes).toContain('range');
  });

  it('draws in both orientations', () => {
    const background = new RangeBackground(seededRandom(3));
    run(background, 2);
    for (const isRotated of [false, true]) {
      const spies = renderFrame(background, isRotated);
      expect(spies.rotate).toHaveBeenCalledTimes(isRotated ? 1 : 0);
      expect(spies.fillRect).toHaveBeenCalled();
      expect(spies.stroke).toHaveBeenCalled();
    }
  });

  it('dots the ball’s paths on, one after another, a new one as each fades', () => {
    const background = new RangeBackground(seededRandom(5));
    renderFrame(background);
    const first = inside(background).paths[0];
    run(background, 6);
    expect(inside(background).paths[0]).not.toBe(first);
    expect(inside(background).paths).toHaveLength(2);
  });

  it('holds everything still with reduced motion, the paths drawn whole', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const still = new RangeBackground(seededRandom(7));
    renderFrame(still);
    const paths = [...inside(still).paths];
    run(still, 10);
    expect(inside(still).scanAge).toBe(0);
    expect(inside(still).paths).toEqual(paths);
  });
});
