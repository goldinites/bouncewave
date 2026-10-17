import { describe, expect, it, vi } from 'vitest';
import { AudioSpectrum } from '@/render/backgrounds/AudioSpectrum';
import { JungleBackground } from '@/render/backgrounds/JungleBackground';
import { fakeContext } from './helpers/fakeContext';

const renderFrame = (background: JungleBackground, isRotated: boolean, climax = 0, pulse = 0.5) => {
  const { ctx, spies } = fakeContext();
  spies.createLinearGradient.mockReturnValue({ addColorStop: vi.fn() });
  spies.createRadialGradient.mockReturnValue({ addColorStop: vi.fn() });
  const spectrum = new AudioSpectrum();
  spectrum.update(null);
  background.render({
    ctx,
    spectrum,
    pulse,
    time: 3,
    isRotated,
    laserIntensity: 1,
    climax,
    celebration: 0,
  });
  return spies;
};

describe('JungleBackground', () => {
  it('draws the guardian, its halo, its reflection and the leaves in both orientations', () => {
    const background = new JungleBackground();

    for (const isRotated of [false, true]) {
      const spies = renderFrame(background, isRotated);
      expect(spies.quadraticCurveTo).toHaveBeenCalled(); // tower crowns, leaves
      expect(spies.arc).toHaveBeenCalled(); // the halo
      expect(spies.scale).toHaveBeenCalledWith(1, expect.any(Number)); // the water's mirror
      // Only the portrait frame turns a quarter; the halo turns by its own small angles
      const quarterTurns = spies.rotate.mock.calls.filter(([angle]) => angle === Math.PI / 2);
      expect(quarterTurns).toHaveLength(isRotated ? 1 : 0);
    }
  });

  it('runs a light round the halo only while a rally heats up', () => {
    const background = new JungleBackground();
    expect(renderFrame(background, false).setLineDash).not.toHaveBeenCalled();
    expect(renderFrame(background, false, 0.6).setLineDash).toHaveBeenCalled();
  });

  it('lights every firefly at once on a drop, then lets them blink again', () => {
    const background = new JungleBackground();
    const lit = () => renderFrame(background, false, 0, 0).rect.mock.calls.length;

    background.triggerDrop();
    const during = lit();
    expect(during).toBeGreaterThan(30);

    background.advance(3, 0, 0);
    expect(lit()).toBeLessThan(during);
  });
});
