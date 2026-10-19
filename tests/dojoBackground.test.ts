import { afterEach, describe, expect, it, vi } from 'vitest';
import { SONGS } from '@/audio/music/songs';
import { AudioSpectrum } from '@/render/backgrounds/AudioSpectrum';
import { DojoBackground } from '@/render/backgrounds/DojoBackground';
import { BackgroundRenderer } from '@/render/BackgroundRenderer';
import { isPickableScene } from '@/shared/scenes';
import { fakeContext } from './helpers/fakeContext';

const renderFrame = (background: DojoBackground, isRotated = false, pulse = 0.5) => {
  const { ctx, spies } = fakeContext();
  const gradient = { addColorStop: vi.fn() };
  spies.createLinearGradient.mockReturnValue(gradient);
  spies.createRadialGradient.mockReturnValue(gradient);
  const alphas: number[] = [];
  spies.arc.mockImplementation(() => alphas.push(ctx.globalAlpha));
  const spectrum = new AudioSpectrum();
  spectrum.update(null);
  background.render({
    ctx,
    spectrum,
    pulse,
    time: 3,
    isRotated,
    laserIntensity: 1,
    climax: 0,
    celebration: 0,
  });
  return { spies, alphas };
};

describe('DojoBackground', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is the challenges’ second tier, never offered to the quick match', () => {
    const background = new DojoBackground();
    expect(background.scene).toBe('dojo');
    expect(isPickableScene(background.scene)).toBe(false);
    expect(new BackgroundRenderer().scenes).toContain('dojo');
  });

  it('draws in both orientations, the scroll reading 試練', () => {
    const background = new DojoBackground();
    for (const isRotated of [false, true]) {
      const { spies } = renderFrame(background, isRotated);
      expect(spies.rotate).toHaveBeenCalledTimes(isRotated ? 1 : 0);
      expect(spies.fillText.mock.calls.map(([text]) => text)).toEqual(['試', '練']);
    }
  });

  it('lights the taiko’s skin with the beat', () => {
    // The drum's skin is the arc drawn at the alpha that follows the pulse
    const skin = (pulse: number) =>
      Math.max(...renderFrame(new DojoBackground(), false, pulse).alphas);
    expect(skin(1)).toBeGreaterThan(skin(0));
  });

  it('holds the lanterns, the bamboo and the smoke still with reduced motion', () => {
    const phases = (b: DojoBackground) => [
      ...(b as unknown as { lanternPhases: number[] }).lanternPhases,
    ];
    const moving = new DojoBackground();
    const before = phases(moving);
    moving.advance(0.5, 0, 0);
    expect(phases(moving)).not.toEqual(before);

    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const still = new DojoBackground();
    const at = phases(still);
    still.advance(0.5, 0, 0);
    expect(phases(still)).toEqual(at);
  });

  it('has its own song, which plays only behind it', () => {
    expect(SONGS.filter((song) => song.scene === 'dojo').map((song) => song.title)).toEqual([
      'Black Belt',
    ]);
  });
});
