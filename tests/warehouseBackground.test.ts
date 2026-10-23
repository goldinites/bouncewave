import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioSpectrum } from '@/render/backgrounds/AudioSpectrum';
import { WarehouseBackground } from '@/render/backgrounds/WarehouseBackground';
import { BackgroundRenderer } from '@/render/BackgroundRenderer';
import { isPickableScene } from '@/shared/scenes';
import { fakeContext } from './helpers/fakeContext';

const renderFrame = (background: WarehouseBackground, isRotated = false, climax = 0) => {
  const { ctx, spies } = fakeContext();
  const gradient = { addColorStop: vi.fn() };
  spies.createLinearGradient.mockReturnValue(gradient);
  spies.createRadialGradient.mockReturnValue(gradient);
  const spectrum = new AudioSpectrum();
  spectrum.update(null);
  background.render({
    ctx,
    spectrum,
    pulse: 0.5,
    time: 3,
    isRotated,
    laserIntensity: 1,
    climax,
    celebration: 0,
  });
  return spies;
};

/** The y of the top of the tallest raised arm (the crowd's thin rects), higher with the heat. */
const highestReach = (spies: ReturnType<typeof renderFrame>) =>
  Math.min(
    ...spies.rect.mock.calls
      .filter(([, , width]) => (width as number) < 6)
      .map(([, y]) => y as number),
  );

describe('WarehouseBackground', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is the challenges’ first tier, never offered to the quick match', () => {
    const background = new WarehouseBackground();
    expect(background.scene).toBe('warehouse');
    expect(isPickableScene(background.scene)).toBe(false);
    expect(new BackgroundRenderer().scenes).toContain('warehouse');
  });

  it('draws in both orientations', () => {
    const background = new WarehouseBackground();
    for (const isRotated of [false, true]) {
      const spies = renderFrame(background, isRotated);
      expect(spies.rect).toHaveBeenCalled(); // wall ribs, crowd, sign
      expect(spies.rotate).toHaveBeenCalledTimes(isRotated ? 1 : 0);
    }
  });

  it('draws its sign as hollow tubes, never filled, so nothing on it passes for a paddle or the ball', () => {
    const spies = renderFrame(new WarehouseBackground());
    // The sign's three tubes and its square are strokes; roundRect is used by the sign alone
    expect(spies.roundRect).toHaveBeenCalledTimes(2);
    const roundRectThenFill = spies.roundRect.mock.invocationCallOrder.some((order) =>
      spies.fill.mock.invocationCallOrder.some((fill) => fill === order + 1),
    );
    expect(roundRectThenFill).toBe(false);
  });

  it('raises the crowd’s arms with the heat', () => {
    const background = new WarehouseBackground();
    expect(highestReach(renderFrame(background, false, 1))).toBeLessThan(
      highestReach(renderFrame(background, false, 0)),
    );
  });

  it('sends the sign’s square across on a beat, and holds everything still with reduced motion', () => {
    const background = new WarehouseBackground();
    const square = (b: WarehouseBackground) => (b as unknown as { signBall: number }).signBall;
    background.advance(0.1, 0, 0);
    background.advance(0.1, 1, 0); // a beat
    for (let i = 0; i < 10; i++) background.advance(0.05, 0.2, 0);
    expect(square(background)).toBeCloseTo(1);

    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const still = new WarehouseBackground();
    still.advance(0.1, 0, 0);
    still.advance(0.1, 1, 0);
    for (let i = 0; i < 10; i++) still.advance(0.05, 0.2, 0);
    expect(square(still)).toBe(0);
  });
});
