import { afterEach, describe, expect, it, Mock, vi } from 'vitest';
import { COURT } from '@/match/config';
import { Background } from '@/render/backgrounds/Background';
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
    const scenes: SceneId[] = ['lasers', 'memphis', 'outrun', 'neonCity', 'fuji', 'jungle'];
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
    const backgrounds = (['lasers', 'memphis', 'outrun', 'neonCity'] as SceneId[]).map((scene) =>
      fakeBackground(0.1, false, scene),
    );
    const renderer = new BackgroundRenderer(backgrounds);
    const target = renderer.switchChannel(true);
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
