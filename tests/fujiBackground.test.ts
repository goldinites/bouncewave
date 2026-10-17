import { describe, expect, it, vi } from 'vitest';
import { AudioSpectrum } from '@/render/backgrounds/AudioSpectrum';
import { FujiBackground } from '@/render/backgrounds/FujiBackground';
import { fakeContext } from './helpers/fakeContext';

const renderFrame = (background: FujiBackground, isRotated: boolean) => {
  const { ctx, spies } = fakeContext();
  spies.createLinearGradient.mockReturnValue({ addColorStop: vi.fn() });
  spies.createRadialGradient.mockReturnValue({ addColorStop: vi.fn() });
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

describe('FujiBackground', () => {
  it('draws the mountain, its reflection, the gate and the petals in both orientations', () => {
    const background = new FujiBackground();

    for (const isRotated of [false, true]) {
      const spies = renderFrame(background, isRotated);
      expect(spies.quadraticCurveTo).toHaveBeenCalled(); // slopes and the gate's lintel
      expect(spies.scale).toHaveBeenCalledWith(1, expect.any(Number)); // the lake's mirror
      expect(spies.ellipse).toHaveBeenCalled(); // petals
      expect(spies.rotate).toHaveBeenCalledTimes(isRotated ? 1 : 0);
    }
  });

  it('bursts a gust of petals from the branch on a drop, which then dies away', () => {
    const background = new FujiBackground();
    const petals = () => renderFrame(background, false).ellipse.mock.calls.length;
    const before = petals();

    background.triggerDrop();
    expect(petals()).toBeGreaterThan(before);

    background.advance(3, 0, 0);
    expect(petals()).toBe(before);
  });

  it('keeps every falling petal on screen as it advances', () => {
    const background = new FujiBackground();
    for (let i = 0; i < 600; i++) background.advance(0.05, 0, 1);

    const spies = renderFrame(background, false);
    for (const [x, y] of spies.ellipse.mock.calls) {
      expect(x).toBeGreaterThan(-60);
      expect(x).toBeLessThan(860);
      expect(y).toBeGreaterThan(-60);
      expect(y).toBeLessThan(560);
    }
  });
});
