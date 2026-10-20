import { Mock, afterEach, describe, expect, it, vi } from 'vitest';
import { Ball } from '@/match/Ball';
import { CourtConditions } from '@/match/court';
import { COURT, PADDLE } from '@/match/config';
import { Paddle } from '@/match/Paddle';
import { ParticleSystem } from '@/fx/ParticleSystem';
import { EntityRenderer } from '@/render/EntityRenderer';
import { Renderer } from '@/render/Renderer';
import { ModifierRenderer } from '@/render/ModifierRenderer';
import { SkillRenderer } from '@/render/SkillRenderer';
import { CourtView, DramaView, HudView, RenderFrame } from '@/render/scene';
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

/** A frame's parts to change from the base one, each group on its own. */
interface FrameOverrides {
  court?: Partial<CourtView>;
  hud?: Partial<HudView>;
  drama?: Partial<DramaView>;
}

const baseFrame = ({ court, hud, drama }: FrameOverrides = {}): RenderFrame => {
  const ball = new Ball();
  return {
    court: {
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
      time: 0,
      serveTime: 0,
      rally: 0,
      timeWarp: null,
      shotReads: [],
      modifiers: [],
      conditions: new CourtConditions(),
      ...court,
    },
    hud: {
      readyText: '',
      condition: null,
      isConditionOnCourt: false,
      sideLabels: null,
      overdriveCharges: [0, null],
      ...hud,
      // No core: the streak is the charges
      overdriveStreaks: hud?.overdriveStreaks ?? hud?.overdriveCharges ?? [0, null],
    },
    drama: {
      climax: 0,
      vignette: 0,
      zoom: 1,
      paddleGlow: [0, 0],
      paddleTilt: [0, 0],
      meterSpent: [0, 0],
      ...drama,
    },
    particles: new ParticleSystem(),
    analyser: null,
    isRotated: false,
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

  it('draws the flat classic scene instead of the neon one in the classic look', () => {
    const { renderer, ctx, spies } = makeRenderer();
    const strokeStyles: unknown[] = [];
    (spies.stroke as Mock).mockImplementation(() => strokeStyles.push(ctx.strokeStyle));

    renderer.render(baseFrame(), 0.016);
    expect(strokeStyles).toContain('rgba(255, 255, 255, 0.3)'); // the neon net line

    strokeStyles.length = 0;
    renderer.setLook('classic');
    renderer.render(baseFrame(), 0.016);
    expect(strokeStyles).toContain('#ffffff'); // the flat classic net line
    expect(strokeStyles).not.toContain('rgba(255, 255, 255, 0.3)');
  });

  it('shows its effects in the neon look only', () => {
    const { renderer } = makeRenderer();
    expect(renderer.showsEffects).toBe(true);

    renderer.setLook('classic');
    expect(renderer.showsEffects).toBe(false);
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
        renderer.render(baseFrame({ drama: { zoom: 1.2 } }), 0.016);
        return [
          spies.translate.mock.calls.some(([x, y]) => x === 10 && y === 10),
          spies.scale.mock.calls.some(([x, y]) => x === 1.2 && y === 1.2),
        ];
      };

      expect(shakeAndZoom(normal)).toEqual([true, true]);
      expect(shakeAndZoom(reduced)).toEqual([false, false]);
    });
  });

  it("doesn't leave a flash that only shows up once the classic look is switched off again", () => {
    const { renderer, ctx } = makeRenderer();

    // A hit lands in the classic look...
    renderer.setLook('classic');
    renderer.addFlash(1.0);

    // ...then the player switches back to the normal view
    renderer.setLook('neon');
    renderer.render(baseFrame(), 0.016);

    // The flash from the classic look's event must not suddenly appear here
    expect(ctx.fillStyle).not.toMatch(/^rgba\(255, 255, 255,/);
  });

  it('plays the CRT-glitch stage effect, but not in the classic look', () => {
    const { renderer, stage } = makeRenderer();

    renderer.triggerCrtGlitch();
    expect(stage.classList.contains('crt-glitch-active')).toBe(true);

    stage.classList.remove('crt-glitch-active');
    renderer.setLook('classic');
    renderer.triggerCrtGlitch();
    expect(stage.classList.contains('crt-glitch-active')).toBe(false);
  });

  it('plays the victory-burst stage effect, but not in the classic look', () => {
    const { renderer, stage } = makeRenderer();

    renderer.triggerVictoryEffect();
    expect(stage.classList.contains('victory-burst-active')).toBe(true);

    stage.classList.remove('victory-burst-active');
    renderer.setLook('classic');
    renderer.triggerVictoryEffect();
    expect(stage.classList.contains('victory-burst-active')).toBe(false);
  });

  it('renders both looks without throwing across a full frame, demo or not', () => {
    const { renderer } = makeRenderer();

    expect(() => renderer.render(baseFrame({ court: { isDemo: false } }), 0.016)).not.toThrow();

    renderer.setLook('classic');
    expect(() => renderer.render(baseFrame({ court: { isDemo: false } }), 0.016)).not.toThrow();
  });

  it("shows the player's Overdrive meter in a match, unless its rules have no Overdrive", () => {
    const meter = vi.spyOn(EntityRenderer, 'renderOverdriveMeter');
    const { renderer } = makeRenderer();

    renderer.render(
      baseFrame({ court: { isDemo: false }, hud: { overdriveCharges: [1, null] } }),
      0.016,
    );
    expect(meter).toHaveBeenCalledTimes(1);

    renderer.render(
      baseFrame({ court: { isDemo: false }, hud: { overdriveCharges: [null, null] } }),
      0.016,
    );
    expect(meter).toHaveBeenCalledTimes(1);
    meter.mockRestore();
  });

  it('gives each of two players their own Overdrive meter', () => {
    const meter = vi.spyOn(EntityRenderer, 'renderOverdriveMeter');
    const { renderer } = makeRenderer();

    renderer.render(
      baseFrame({ court: { isDemo: false }, hud: { overdriveCharges: [1, 2] } }),
      0.016,
    );
    expect(meter.mock.calls.map(([, , charge]) => charge)).toEqual([1, 2]);
    meter.mockRestore();
  });

  it('shows a spinning ball and a slowed world only while they last', () => {
    const spin = vi.spyOn(SkillRenderer, 'renderSpin');
    const tint = vi.spyOn(SkillRenderer, 'renderTint');
    const { renderer } = makeRenderer();
    const ball = new Ball();

    renderer.render(baseFrame({ court: { isDemo: false, balls: [ball], ball } }), 0.016);
    expect(tint).not.toHaveBeenCalled();

    ball.spin = -0.3;
    const warp = { paddleIndex: 0, scale: 0.4 };
    renderer.render(
      baseFrame({ court: { isDemo: false, balls: [ball], ball, timeWarp: warp } }),
      0.016,
    );
    expect(spin).toHaveBeenCalledWith(expect.anything(), ball, expect.any(Number));
    expect(tint).toHaveBeenCalledOnce();

    // The paddle that slowed it leaves afterimages, which outlast it a moment
    const afterimages = vi.spyOn(SkillRenderer, 'renderAfterimages');
    renderer.render(
      baseFrame({ court: { isDemo: false, balls: [ball], ball, timeWarp: warp } }),
      0.05,
    );
    expect(afterimages.mock.calls.at(-1)![1].length).toBeGreaterThan(0);

    // Back to speed, the cast is gone a moment later
    renderer.render(baseFrame({ court: { isDemo: false, balls: [ball], ball } }), 1);
    renderer.render(baseFrame({ court: { isDemo: false, balls: [ball], ball } }), 0.016);
    expect(tint).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });

  it('shows each shot read ahead over the paddle reading it, and a spent charge flaring', () => {
    const read = vi.spyOn(SkillRenderer, 'renderShotRead');
    const meter = vi.spyOn(EntityRenderer, 'renderOverdriveMeter');
    const { renderer } = makeRenderer();
    const shot = {
      paddleIndex: 0,
      path: [
        { x: 400, y: 250 },
        { x: 56, y: 120 },
      ],
      age: 0.1,
    };

    renderer.render(
      baseFrame({
        court: { isDemo: false, shotReads: [shot] },
        hud: { overdriveCharges: [0, null] },
        drama: { meterSpent: [0.8, 0] },
      }),
      0.016,
    );
    expect(read).toHaveBeenCalledWith(
      expect.anything(),
      shot,
      expect.objectContaining({ side: 0 }),
      expect.any(Boolean),
    );
    expect(meter.mock.calls[0][5]).toBe(0.8);
    vi.restoreAllMocks();
  });

  it('keeps the middle dark with Darkness, and flashes where a ball bounces', () => {
    const dark = vi.spyOn(ModifierRenderer, 'renderDarkness');
    const { renderer } = makeRenderer();
    const ball = new Ball();
    Object.assign(ball, { drawX: 400, drawY: 30, vx: 300, vy: -200 });
    const frame = () =>
      baseFrame({ court: { isDemo: false, balls: [ball], ball, modifiers: ['darkness'] } });

    renderer.render(frame(), 0.016);
    expect(dark.mock.calls.at(-1)![1]).toHaveLength(0);
    // Off the top wall: it turns around, and there is a flash where it did
    ball.vy = 200;
    renderer.render(frame(), 0.016);
    expect(dark.mock.calls.at(-1)![1]).toEqual([{ x: 400, y: 30, age: 0 }]);

    renderer.render(baseFrame({ court: { isDemo: false, balls: [ball], ball } }), 0.016);
    expect(dark).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });

  it('draws every ball on court, in both looks', () => {
    const neon = vi.spyOn(EntityRenderer, 'renderBall');
    const { renderer, spies } = makeRenderer();
    const balls = [new Ball(), new Ball()];

    renderer.render(baseFrame({ court: { balls, ball: balls[0] } }), 0.016);
    expect(neon.mock.calls.map((call) => call[1])).toEqual(balls);

    renderer.setLook('classic');
    (spies.fillRect as Mock).mockClear();
    renderer.render(baseFrame({ court: { balls, ball: balls[0] } }), 0.016);
    // A classic ball is a white square as wide as the ball
    const size = balls[0].radius * 2;
    const squares = (spies.fillRect as Mock).mock.calls.filter(
      ([, , width, height]) => width === size && height === size,
    );
    expect(squares).toHaveLength(balls.length);
    neon.mockRestore();
  });
});
