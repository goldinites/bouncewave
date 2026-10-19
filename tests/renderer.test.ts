import { Mock, afterEach, describe, expect, it, vi } from 'vitest';
import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { Paddle } from '@/match/Paddle';
import { ParticleSystem } from '@/fx/ParticleSystem';
import { EntityRenderer } from '@/render/EntityRenderer';
import { Renderer, RenderFrame } from '@/render/Renderer';
import { COLORS } from '@/shared/palette';
import { fakeContext } from './helpers/fakeContext';

/**
 * A canvas context that additionally survives gradient creation: Renderer's constructor and
 * every background build at least one CanvasGradient and call .addColorStop on it, which a
 * plain fakeContext() can't return (its auto-vivified spies resolve to undefined when called).
 * Returning the same self-vivifying proxy as the "gradient" lets those calls through harmlessly.
 */
const makeGradientSafeContext = () => {
  const { ctx, spies } = fakeContext();
  (spies.createLinearGradient as Mock).mockReturnValue(spies);
  (spies.createRadialGradient as Mock).mockReturnValue(spies);
  return { ctx, spies };
};

/** @param width the canvas's laid-out width in CSS pixels; happy-dom lays nothing out itself */
const makeRenderer = (width = 800) => {
  const { ctx, spies } = makeGradientSafeContext();

  const stage = document.createElement('div');
  stage.id = 'gameStage';
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: width });
  Object.defineProperty(canvas, 'clientHeight', { value: (width * 5) / 8 });
  stage.appendChild(canvas);
  document.body.appendChild(stage);

  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);

  const renderer = new Renderer(canvas);
  return { renderer, ctx, spies, stage, canvas };
};

const baseFrame = (overrides: Partial<RenderFrame> = {}): RenderFrame => {
  const ball = new Ball();
  return {
    gameState: 'play',
    // Demo mode skips the HUD, keeping the canvas call trace free of its own translate/fillText
    isDemo: true,
    paddles: [
      new Paddle(0, PADDLE.OFFSET_X, COLORS.CYAN),
      new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, COLORS.PINK),
    ],
    scores: [0, 0],
    balls: [ball],
    ball,
    particles: new ParticleSystem(),
    analyser: null,
    time: 0,
    serveTime: 0,
    rally: 0,
    readyText: '',
    condition: null,
    isRotated: false,
    vignette: 0,
    zoom: 1,
    climax: 0,
    paddleGlow: [0, 0],
    overdriveCharges: [0, null],
    sideLabels: null,
    ...overrides,
  };
};

describe('Renderer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('draws nothing on a canvas laid out at no size', () => {
    const { renderer, spies } = makeRenderer(0);

    renderer.render(baseFrame(), 0.016);
    expect(spies.drawImage).not.toHaveBeenCalled();
    expect(spies.stroke).not.toHaveBeenCalled();
  });

  it('draws the flat classic scene instead of the neon one once classic mode is on', () => {
    const { renderer, ctx, spies } = makeRenderer();
    const strokeStyles: unknown[] = [];
    (spies.stroke as Mock).mockImplementation(() => strokeStyles.push(ctx.strokeStyle));

    renderer.render(baseFrame(), 0.016);
    expect(strokeStyles).toContain('rgba(255, 255, 255, 0.3)'); // the neon net line

    strokeStyles.length = 0;
    renderer.setClassicMode(true);
    renderer.render(baseFrame(), 0.016);
    expect(strokeStyles).toContain('#ffffff'); // the flat classic net line
    expect(strokeStyles).not.toContain('rgba(255, 255, 255, 0.3)');
  });

  it('reports back whatever classic mode was last set to', () => {
    const { renderer } = makeRenderer();
    expect(renderer.classicMode).toBe(false);

    renderer.setClassicMode(true);
    expect(renderer.classicMode).toBe(true);
  });

  it('shows a screen flash normally', () => {
    const { renderer, ctx } = makeRenderer();

    renderer.addFlash(1.0);
    renderer.render(baseFrame(), 0.016);

    expect(ctx.fillStyle).toMatch(/^rgba\(255, 255, 255,/);
  });

  describe('with reduced motion asked for', () => {
    /** Answers the reduced-motion media query as `reduce`, everything else as no match. */
    const preferReducedMotion = () =>
      vi
        .spyOn(window, 'matchMedia')
        .mockImplementation(
          (query: string) =>
            ({ matches: query.includes('reduced-motion: reduce'), media: query }) as MediaQueryList,
        );

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("doesn't flash the screen", () => {
      preferReducedMotion();
      const { renderer, ctx } = makeRenderer();

      renderer.addFlash(1.0);
      renderer.render(baseFrame(), 0.016);
      expect(ctx.fillStyle).not.toMatch(/^rgba\(255, 255, 255,/);
    });

    it("doesn't shake or zoom the camera", () => {
      const normal = makeRenderer();
      preferReducedMotion();
      const reduced = makeRenderer();

      // A shake of 20 then moves the scene by exactly (10, 10); the zoom scales it by 1.2
      vi.spyOn(Math, 'random').mockReturnValue(1);
      const shakeAndZoom = ({ renderer, spies }: typeof normal) => {
        renderer.addShake(20);
        renderer.render(baseFrame({ zoom: 1.2 }), 0.016);
        return [
          spies.translate.mock.calls.some(([x, y]) => x === 10 && y === 10),
          spies.scale.mock.calls.some(([x, y]) => x === 1.2 && y === 1.2),
        ];
      };

      expect(shakeAndZoom(normal)).toEqual([true, true]);
      expect(shakeAndZoom(reduced)).toEqual([false, false]);
    });
  });

  it("doesn't leave a flash that only shows up once classic mode is switched off again", () => {
    const { renderer, ctx } = makeRenderer();

    // A hit lands while classic mode is on...
    renderer.setClassicMode(true);
    renderer.addFlash(1.0);

    // ...then the player switches back to the normal view
    renderer.setClassicMode(false);
    renderer.render(baseFrame(), 0.016);

    // The flash from the classic-mode event must not suddenly appear here
    expect(ctx.fillStyle).not.toMatch(/^rgba\(255, 255, 255,/);
  });

  it('plays the CRT-glitch stage effect, but not while classic mode is on', () => {
    const { renderer, stage } = makeRenderer();

    renderer.triggerCrtGlitch();
    expect(stage.classList.contains('crt-glitch-active')).toBe(true);

    stage.classList.remove('crt-glitch-active');
    renderer.setClassicMode(true);
    renderer.triggerCrtGlitch();
    expect(stage.classList.contains('crt-glitch-active')).toBe(false);
  });

  it('plays the victory-burst stage effect, but not while classic mode is on', () => {
    const { renderer, stage } = makeRenderer();

    renderer.triggerVictoryEffect();
    expect(stage.classList.contains('victory-burst-active')).toBe(true);

    stage.classList.remove('victory-burst-active');
    renderer.setClassicMode(true);
    renderer.triggerVictoryEffect();
    expect(stage.classList.contains('victory-burst-active')).toBe(false);
  });

  it('renders both modes without throwing across a full frame, demo or not', () => {
    const { renderer } = makeRenderer();

    expect(() => renderer.render(baseFrame({ isDemo: false }), 0.016)).not.toThrow();

    renderer.setClassicMode(true);
    expect(() => renderer.render(baseFrame({ isDemo: false }), 0.016)).not.toThrow();
  });

  it("shows the player's Overdrive meter in a match, unless its rules have no Overdrive", () => {
    const meter = vi.spyOn(EntityRenderer, 'renderOverdriveMeter');
    const { renderer } = makeRenderer();

    renderer.render(baseFrame({ isDemo: false, overdriveCharges: [1, null] }), 0.016);
    expect(meter).toHaveBeenCalledTimes(1);

    renderer.render(baseFrame({ isDemo: false, overdriveCharges: [null, null] }), 0.016);
    expect(meter).toHaveBeenCalledTimes(1);
    meter.mockRestore();
  });

  it('gives each of two players their own Overdrive meter', () => {
    const meter = vi.spyOn(EntityRenderer, 'renderOverdriveMeter');
    const { renderer } = makeRenderer();

    renderer.render(baseFrame({ isDemo: false, overdriveCharges: [1, 2] }), 0.016);
    expect(meter.mock.calls.map(([, , charge]) => charge)).toEqual([1, 2]);
    meter.mockRestore();
  });

  it('draws every ball on court, in both looks', () => {
    const neon = vi.spyOn(EntityRenderer, 'renderBall');
    const classic = vi.spyOn(EntityRenderer, 'renderClassicBall');
    const { renderer } = makeRenderer();
    const balls = [new Ball(), new Ball()];

    renderer.render(baseFrame({ balls, ball: balls[0] }), 0.016);
    expect(neon.mock.calls.map((call) => call[1])).toEqual(balls);

    renderer.setClassicMode(true);
    renderer.render(baseFrame({ balls, ball: balls[0] }), 0.016);
    expect(classic.mock.calls.map((call) => call[1])).toEqual(balls);
    neon.mockRestore();
    classic.mockRestore();
  });
});
