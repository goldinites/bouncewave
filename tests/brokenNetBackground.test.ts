import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioSpectrum } from '@/render/backgrounds/AudioSpectrum';
import { BrokenNetBackground } from '@/render/backgrounds/BrokenNetBackground';
import { BackgroundRenderer } from '@/render/BackgroundRenderer';
import { isPickableScene } from '@/shared/scenes';
import { fakeContext } from './helpers/fakeContext';

const renderFrame = (background: BrokenNetBackground, isRotated = false, climax = 0) => {
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
    climax,
    celebration: 0,
  });
  return { spies, texts: spies.fillText.mock.calls.map(([text]) => text as string) };
};

/** Runs the background's own clock for a while, as the frames do. */
const run = (background: BrokenNetBackground, seconds: number, pulse = 0) => {
  for (let t = 0; t < seconds; t += 1 / 60) background.advance(1 / 60, pulse, 0);
};

const windowsOf = (background: BrokenNetBackground) =>
  (background as unknown as { windows: { error: number; age: number; life: number }[] }).windows;

/** Runs the clock until two errors are open and neither is coming or going (broken up). */
const runUntilTwoOpen = (background: BrokenNetBackground) => {
  const isWhole = (w: { age: number; life: number }) => w.age > 0.5 && w.life - w.age > 0.5;
  for (let t = 0; t < 120; t += 1 / 60) {
    const windows = windowsOf(background);
    if (windows.length === 2 && windows.every(isWhole)) return;
    background.advance(1 / 60, 0, 0);
  }
  throw new Error('Never two errors open at once');
};

describe('BrokenNetBackground', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.lang = '';
  });

  it('is the challenges’ last tier, never offered to the quick match', () => {
    const background = new BrokenNetBackground();
    expect(background.scene).toBe('brokenNet');
    expect(isPickableScene(background.scene)).toBe(false);
    expect(new BackgroundRenderer().scenes).toContain('brokenNet');
  });

  it('draws in both orientations', () => {
    const background = new BrokenNetBackground();
    run(background, 3);
    for (const isRotated of [false, true]) {
      const { spies } = renderFrame(background, isRotated);
      expect(spies.rotate).toHaveBeenCalledTimes(isRotated ? 1 : 0);
      expect(spies.fillRect).toHaveBeenCalled();
    }
  });

  it('opens real network errors, in English whatever the language, never one twice', () => {
    const background = new BrokenNetBackground();
    runUntilTwoOpen(background);

    document.documentElement.lang = 'ru';
    expect(renderFrame(background).texts).toContain('Network error');
    const errors = windowsOf(background).map((w) => w.error);
    expect(new Set(errors).size).toBe(errors.length);
  });

  it('brings the signal back on a victory: the errors close', () => {
    const background = new BrokenNetBackground();
    runUntilTwoOpen(background);
    background.triggerDrop();
    expect(windowsOf(background)).toHaveLength(0);
    run(background, 1);
    expect(windowsOf(background)).toHaveLength(0);
  });

  it('holds everything still with reduced motion, a couple of errors open', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const still = new BrokenNetBackground();
    const travel = () => (still as unknown as { travel: number }).travel;
    run(still, 2, 1);
    expect(travel()).toBe(0);
    expect(windowsOf(still)).toHaveLength(2);
    expect((still as unknown as { tearAge: number }).tearAge).toBe(Infinity);
  });

  it('opens more errors at the height of a rally', () => {
    // The most open at once over half a minute, at a climax
    const mostOpen = (climax: number) => {
      const background = new BrokenNetBackground();
      renderFrame(background, false, climax);
      let most = 0;
      for (let t = 0; t < 30; t += 1 / 60) {
        background.advance(1 / 60, 0, climax);
        most = Math.max(most, windowsOf(background).length);
      }
      return most;
    };
    expect(mostOpen(0)).toBeLessThanOrEqual(2);
    expect(mostOpen(1)).toBeGreaterThan(3);
  });

  describe('the range breaking with the rally', () => {
    /** A frame at a climax, on a canvas that can report its transform, as a browser's does. */
    const breakFrame = (background: BrokenNetBackground, climax: number) => {
      const { ctx, spies } = fakeContext();
      spies.createLinearGradient.mockReturnValue({ addColorStop: vi.fn() });
      spies.getTransform.mockReturnValue({ transformPoint: (point: DOMPointInit) => point });
      const strokes: string[] = [];
      spies.stroke.mockImplementation(() => strokes.push(String(ctx.strokeStyle)));
      const spectrum = new AudioSpectrum();
      spectrum.update(null);
      const frame = { ctx, spectrum, pulse: 0, time: 3, isRotated: false, laserIntensity: 1 };
      background.render({ ...frame, climax, celebration: 0 });
      return {
        corrupted: strokes.filter((color) => color === '#ff8ae6').length,
        holes: spies.fill.mock.calls.length,
        slabs: spies.drawImage.mock.calls.length,
      };
    };
    const ran = () => {
      const background = new BrokenNetBackground();
      run(background, 3);
      return background;
    };

    it('corrupts a few peaks at rest, and only at the height of a rally slides apart', () => {
      const calm = breakFrame(ran(), 0);
      const hot = breakFrame(ran(), 1);
      expect(calm.corrupted).toBeGreaterThan(0);
      expect(calm.slabs).toBe(0);
      // Pieces of the slopes fall into the void, and bands down the edges slide apart
      expect(hot.holes).toBeGreaterThan(calm.holes);
      expect(hot.slabs).toBeGreaterThan(0);
    });

    it('holds whole for a moment when a point is won', () => {
      const background = ran();
      background.triggerDrop();
      expect(breakFrame(background, 1)).toMatchObject({ corrupted: 0, slabs: 0 });
    });

    it('never slides apart with reduced motion', () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
      expect(breakFrame(ran(), 1).slabs).toBe(0);
    });
  });
});
