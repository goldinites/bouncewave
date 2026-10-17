import { describe, expect, it, vi } from 'vitest';
import { AudioSpectrum } from '@/render/backgrounds/AudioSpectrum';
import { ShrineBackground } from '@/render/backgrounds/ShrineBackground';
import { fakeContext } from './helpers/fakeContext';

const renderFrame = (background: ShrineBackground, isRotated: boolean) => {
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

describe('ShrineBackground', () => {
  it('draws the gate, the moon and the petals in both orientations', () => {
    const background = new ShrineBackground();

    for (const isRotated of [false, true]) {
      const spies = renderFrame(background, isRotated);
      expect(spies.quadraticCurveTo).toHaveBeenCalled(); // the gate's upswept lintel
      expect(spies.arc).toHaveBeenCalled(); // the moon
      expect(spies.ellipse).toHaveBeenCalled(); // petals
      expect(spies.rotate).toHaveBeenCalledTimes(isRotated ? 1 : 0);
    }
  });

  it('bursts a gust of petals out of the gate on a drop, which then dies away', () => {
    const background = new ShrineBackground();
    const petals = () => renderFrame(background, false).ellipse.mock.calls.length;
    const before = petals();

    background.triggerDrop();
    expect(petals()).toBeGreaterThan(before);

    background.advance(3, 0, 0);
    expect(petals()).toBe(before);
  });

  it('keeps every falling petal on screen as it advances', () => {
    const background = new ShrineBackground();
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
