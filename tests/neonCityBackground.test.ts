import { describe, expect, it, vi } from 'vitest';
import { AudioSpectrum } from '@/render/backgrounds/AudioSpectrum';
import { NeonCityBackground } from '@/render/backgrounds/NeonCityBackground';
import { fakeContext } from './helpers/fakeContext';

const renderFrame = (background: NeonCityBackground, isRotated: boolean, celebration = 0) => {
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
    celebration,
  });
  return spies;
};

describe('NeonCityBackground', () => {
  it('draws the skyline in both orientations', () => {
    const background = new NeonCityBackground();

    for (const isRotated of [false, true]) {
      const spies = renderFrame(background, isRotated);
      expect(spies.rect).toHaveBeenCalled(); // buildings and windows
      expect(spies.rotate).toHaveBeenCalledTimes(isRotated ? 1 : 0);
    }
  });

  it('lights more windows during a victory drop', () => {
    const background = new NeonCityBackground();
    const before = renderFrame(background, false).rect.mock.calls.length;

    background.triggerDrop();
    const during = renderFrame(background, false).rect.mock.calls.length;
    expect(during).toBeGreaterThan(before);

    background.advance(1, 0, 0);
    expect(renderFrame(background, false).rect.mock.calls.length).toBeLessThan(during);
  });
});
