import { afterEach, describe, expect, it, Mock, vi } from 'vitest';
import { COURT } from '@/match/config';
import { AudioSpectrum } from '@/render/backgrounds/AudioSpectrum';
import { Background } from '@/render/backgrounds/Background';
import { MysteryBackground } from '@/render/backgrounds/MysteryBackground';
import { BackgroundRenderer } from '@/render/BackgroundRenderer';
import { SceneId } from '@/shared/scenes';
import { fakeContext } from './helpers/fakeContext';

const MOOD = { laserIntensity: 1, climax: 0.2, celebration: 0.6 };

const fakeBackground = (
  overlayTint: number,
  withHooks = false,
  scene: SceneId = 'lasers',
): Background => ({
  scene,
  overlayTint,
  render: vi.fn(),
  ...(withHooks ? { advance: vi.fn(), triggerDrop: vi.fn() } : {}),
});

const draw = (renderer: BackgroundRenderer, time: number) => {
  const { ctx } = fakeContext();
  renderer.render(ctx, null, time, 0, false, MOOD);
  return ctx;
};

describe('BackgroundRenderer', () => {
  it('draws only the active background and switches on request', () => {
    const backgrounds = [fakeBackground(0.1), fakeBackground(0.2)];
    const renderer = new BackgroundRenderer(backgrounds);

    draw(renderer, 0);
    const first = backgrounds.findIndex((b) => vi.mocked(b.render).mock.calls.length === 1);
    expect(first).toBeGreaterThanOrEqual(0);

    renderer.switchChannel(false);
    draw(renderer, 0.016);

    const second = backgrounds[(first + 1) % 2];
    expect(second.render).toHaveBeenCalledTimes(1);
    expect(backgrounds[first].render).toHaveBeenCalledTimes(1);
  });

  it('names the backdrop each switch brings up', () => {
    const renderer = new BackgroundRenderer([
      fakeBackground(0.1, false, 'lasers'),
      fakeBackground(0.1, false, 'neonCity'),
    ]);
    const first = renderer.scene;
    const next = renderer.switchChannel(false);

    expect(next).not.toBe(first);
    expect(renderer.scene).toBe(next);
  });

  it('deals every background once before any comes round again, never one twice running', () => {
    const scenes: SceneId[] = ['lasers', 'neonCity', 'fuji'];
    const renderer = new BackgroundRenderer(
      scenes.map((scene) => fakeBackground(0.1, false, scene)),
    );

    let previous = renderer.scene;
    for (let deck = 0; deck < 20; deck++) {
      const dealt = new Set<SceneId>();
      for (let i = 0; i < scenes.length; i++) {
        const scene = renderer.switchChannel(false);
        expect(scene).not.toBe(previous);
        dealt.add(scene);
        previous = scene;
      }
      expect(dealt.size).toBe(scenes.length);
    }
  });

  it('flicks through other channels in static before settling on the match’s own', () => {
    const backgrounds = (['lasers', 'fuji', 'neonCity'] as SceneId[]).map((scene) =>
      fakeBackground(0.1, false, scene),
    );
    const renderer = new BackgroundRenderer(backgrounds);
    const target = renderer.switchChannel(true);
    expect(renderer.isSurfing).toBe(true);
    const shown = (time: number) => {
      backgrounds.forEach((b) => vi.mocked(b.render).mockClear());
      draw(renderer, time);
      return backgrounds.find((b) => vi.mocked(b.render).mock.calls.length > 0)!.scene;
    };

    // Each frame shows one channel; over the surf more than one comes by
    const seen = new Set<SceneId>();
    for (let t = 0; t < 1.5; t += 0.05) seen.add(shown(t));
    expect(seen.size).toBeGreaterThan(1);
    // Once it is over, only the match's own is left
    expect(shown(1.6)).toBe(target);
    expect(shown(1.7)).toBe(target);
    expect(renderer.isSurfing).toBe(false);
  });

  it('keeps a pinned background through every match', () => {
    const scenes: SceneId[] = ['lasers', 'fuji', 'neonCity'];
    const renderer = new BackgroundRenderer(
      scenes.map((scene) => fakeBackground(0.1, false, scene)),
    );

    expect(renderer.pin('fuji')).toBe(true);
    expect(renderer.isPinned).toBe(true);
    expect(renderer.switchChannel(true)).toBe('fuji');
    expect(renderer.switchChannel(false)).toBe('fuji');
  });

  it('switches to the background the player chose, every match, until they choose random', () => {
    const scenes: SceneId[] = ['lasers', 'fuji', 'neonCity'];
    const renderer = new BackgroundRenderer(
      scenes.map((scene) => fakeBackground(0.1, false, scene)),
    );

    renderer.choose('neonCity');
    expect(renderer.switchChannel(true)).toBe('neonCity');
    for (let t = 0; t < 2; t += 0.05) draw(renderer, t);
    // Already on it: no surf, it stays
    expect(renderer.switchChannel(true)).toBe('neonCity');
    expect(renderer.isSurfing).toBe(false);
    expect(renderer.switchChannel(false)).toBe('neonCity');

    renderer.choose(null);
    expect(renderer.switchChannel(false)).not.toBe('neonCity');
  });

  it('gives way to a developer’s pin over the player’s choice', () => {
    const renderer = new BackgroundRenderer([
      fakeBackground(0.1, false, 'lasers'),
      fakeBackground(0.1, false, 'fuji'),
    ]);

    renderer.pin('fuji');
    renderer.choose('lasers');
    expect(renderer.switchChannel(false)).toBe('fuji');
  });

  it('refuses to pin a background it does not have', () => {
    const renderer = new BackgroundRenderer([fakeBackground(0.1, false, 'lasers')]);
    expect(renderer.pin('fuji')).toBe(false);
    expect(renderer.isPinned).toBe(false);
  });

  it('tints with the active background’s own overlay', () => {
    const renderer = new BackgroundRenderer([fakeBackground(0.42)]);
    expect(draw(renderer, 0).fillStyle).toBe('rgba(10, 2, 32, 0.42)');
  });

  it('advances and bursts every background that has the hooks, shown or not', () => {
    const plain = fakeBackground(0.1);
    const lively = fakeBackground(0.3, true);
    const renderer = new BackgroundRenderer([plain, lively]);

    draw(renderer, 0);
    draw(renderer, 0.05);
    renderer.triggerDrop();

    // Heat is the stronger of climax and celebration
    expect(lively.advance).toHaveBeenLastCalledWith(expect.closeTo(0.05), 0, 0.6);
    expect(lively.triggerDrop).toHaveBeenCalledOnce();
  });

  describe('with a layer of its own', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    /** Lets the layer's canvas hand out a (fake) 2D context. */
    const withLayerContext = () => {
      const layer = fakeContext();
      const createElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const element = createElement(tag);
        if (tag === 'canvas') {
          vi.spyOn(element as HTMLCanvasElement, 'getContext').mockReturnValue(layer.ctx);
        }
        return element;
      });
      return layer;
    };

    it('draws the background into the layer at its scale and copies it onto the scene', () => {
      const layer = withLayerContext();

      const background = fakeBackground(0.42);
      const renderer = new BackgroundRenderer([background]);
      renderer.setScale(0.5);
      const scene = draw(renderer, 0);

      expect(vi.mocked(background.render).mock.calls[0][0].ctx).toBe(layer.ctx);
      expect(layer.spies.setTransform).toHaveBeenCalledWith(0.5, 0, 0, 0.5, 0, 0);
      expect(layer.ctx.fillStyle).toBe('rgba(10, 2, 32, 0.42)');

      const [image, ...rect] = (scene.drawImage as unknown as Mock).mock.calls[0];
      expect(image).toBeInstanceOf(HTMLCanvasElement);
      expect([image.width, image.height]).toEqual([COURT.WIDTH / 2, COURT.HEIGHT / 2]);
      expect(rect).toEqual([0, 0, COURT.WIDTH, COURT.HEIGHT]);
    });

    it('reallocates the layer at the same size when asked to rebuild it', () => {
      withLayerContext();
      const renderer = new BackgroundRenderer([fakeBackground(0.42)]);
      renderer.setScale(0.5);

      const widthSetter = vi.spyOn(HTMLCanvasElement.prototype, 'width', 'set');
      renderer.rebuildLayer();

      expect(widthSetter).toHaveBeenCalledWith(COURT.WIDTH / 2);
    });
  });
});

describe('the unknown channel (random picked)', () => {
  const setup = () => {
    const backgrounds = (['lasers', 'fuji', 'neonCity'] as SceneId[]).map((scene) =>
      fakeBackground(0.1, false, scene),
    );
    const renderer = new BackgroundRenderer(backgrounds);
    const drawn = () => backgrounds.filter((b) => vi.mocked(b.render).mock.calls.length > 0);
    // A context that hands out gradients, which the unknown channel paints its sky with
    const draw = (time: number) => {
      const { ctx, spies } = fakeContext();
      (spies.createLinearGradient as Mock).mockReturnValue(spies);
      renderer.render(ctx, null, time, 0, false, MOOD);
    };
    return { renderer, backgrounds, drawn, draw };
  };

  it('stands in for the background until a real one is switched to', () => {
    const { renderer, backgrounds, drawn, draw } = setup();
    renderer.showMystery();
    expect(renderer.isShowingMystery).toBe(true);
    draw(0);
    expect(drawn()).toEqual([]);

    // Dealt at random for the match: a real backdrop, the unknown channel gone
    const scene = renderer.switchChannel(false);
    draw(0.016);
    expect(renderer.isShowingMystery).toBe(false);
    expect(drawn().map((b) => b.scene)).toEqual([scene]);
    expect(backgrounds.map((b) => b.scene)).toContain(scene);
  });

  it('gives way to the chosen background even when that one was on screen before', () => {
    const { renderer } = setup();
    const scene = renderer.scene;
    renderer.choose(scene);
    renderer.showMystery();

    expect(renderer.switchChannel(false)).toBe(scene);
    expect(renderer.isShowingMystery).toBe(false);
  });

  it('does not cover a developer’s pinned background', () => {
    const { renderer } = setup();
    renderer.pin('fuji');
    renderer.showMystery();
    expect(renderer.isShowingMystery).toBe(false);
  });

  it('draws in both orientations, with and without the glitch', () => {
    const mystery = new MysteryBackground();
    for (const isRotated of [false, true]) {
      for (const time of [0.05, 1.5]) {
        const { ctx, spies } = fakeContext();
        (spies.createLinearGradient as Mock).mockReturnValue(spies);
        mystery.render({
          ...MOOD,
          ctx: ctx as unknown as CanvasRenderingContext2D,
          spectrum: new AudioSpectrum(),
          pulse: 0.5,
          time,
          isRotated,
        });
        expect(spies.arc).toHaveBeenCalled();
      }
    }
  });

  describe('dissolving behind the menus', () => {
    afterEach(() => vi.restoreAllMocks());

    /** A renderer drawing into a layer of its own, as the game's does, so its frame can be held. */
    const layered = () => {
      const { ctx } = fakeContext();
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        ctx as unknown as RenderingContext,
      );
      const backgrounds = (['lasers', 'fuji', 'neonCity'] as SceneId[]).map((scene) =>
        fakeBackground(0.1, false, scene),
      );
      const renderer = new BackgroundRenderer(backgrounds);
      renderer.setScale(1);
      return { renderer, backgrounds };
    };
    it('melts the old backdrop’s held frame over the next one, then lets it go', () => {
      const { renderer, backgrounds } = layered();
      draw(renderer, 0);
      const before = renderer.scene;
      const next = renderer.dissolve();
      expect(next).not.toBe(before);
      expect(renderer.isDissolving).toBe(true);
      // The new backdrop plays live underneath from the first frame
      backgrounds.forEach((b) => vi.mocked(b.render).mockClear());
      draw(renderer, 0.05);
      const live = backgrounds.find((b) => vi.mocked(b.render).mock.calls.length > 0)!;
      expect(live.scene).toBe(next);
      for (let t = 0.1; t < 3.2; t += 0.1) draw(renderer, t);
      expect(renderer.isDissolving).toBe(false);
    });

    it('never dissolves over a developer’s pin or the unknown channel', () => {
      const { renderer } = layered();
      renderer.showMystery();
      expect(renderer.dissolve()).toBe(renderer.scene);
      expect(renderer.isDissolving).toBe(false);
      renderer.pin('fuji');
      expect(renderer.dissolve()).toBe('fuji');
      expect(renderer.isDissolving).toBe(false);
    });

    it('gives way to a channel switch on its way', () => {
      const { renderer } = layered();
      renderer.dissolve();
      renderer.switchChannel(true);
      expect(renderer.isDissolving).toBe(false);
    });
  });
});
