/*
 * The frame bench (served by the dev server, never built): plays a match on the real Renderer
 * and simulation and times both, for e2e/perf.spec.ts to hold to the budget in e2e/frameBudget.ts.
 *
 * Every background in turn: AI against AI, two balls, sparks on every hit, the rally's heat
 * rising to full and falling again, the canvas at a phone's pixel ratio. The randomness is
 * seeded, so every run plays the same frames. Sets `window.benchResult` when done.
 *
 * What it times is the script's side of a frame: the calls that draw, and whatever the browser
 * makes them wait for (a canvas drawn into itself, a layer rebuilt). The pixels themselves are
 * filled later, on the GPU on a phone; reading one back to time them would time the wait for the
 * GPU instead.
 *
 * ?scenes=lasers,brokenNet limits it to those backgrounds; ?frames=300 sets how many each gets.
 */
import '@fontsource-variable/tektur/wght.css';

// A fixed seed for everything the backgrounds scatter at random, as on the visual stand
let seed = 0x5eed;
Math.random = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const FRAME = 1 / 60;
const STEP = 1 / 240; // the match's fixed step (app/FixedStep)
const WARM_UP = 30; // frames drawn first and not timed: sprites and layers are built then
const SPARKS = 18; // particles a hit throws, about what the effects throw

/**
 * ms per frame. The browser's clock ticks in 0.1 ms, so a quick part (the simulation) is read
 * from its mean over many frames; its 95th percentile would only say 0 or 0.1.
 */
export interface PartTimes {
  p95: number;
  mean: number;
}

export interface BenchResult {
  scenes: Record<string, { render: PartTimes; simulation: PartTimes }>;
  pixelRatio: number;
}

declare global {
  interface Window {
    benchResult?: BenchResult;
  }
}

const { Ball } = await import('@/match/Ball');
const { COURT, PADDLE } = await import('@/match/config');
const { DifficultyLevel } = await import('@/match/difficulty');
const { MatchFlow } = await import('@/match/MatchFlow');
const { Paddle } = await import('@/match/Paddle');
const { AiPaddleController } = await import('@/match/PaddleController');
const { firstTo, STANDARD_RULES } = await import('@/match/rules');
const { ParticleSystem } = await import('@/fx/ParticleSystem');
const { Renderer } = await import('@/render/Renderer');
const { gameFont } = await import('@/shared/fonts');
const { COLORS } = await import('@/shared/palette');
type MatchEvent = import('@/match/MatchFlow').MatchEvent;
type RenderFrame = import('@/render/scene').RenderFrame;

await document.fonts.load(gameFont(700, 16));

const params = new URLSearchParams(location.search);
const frames = Number(params.get('frames') ?? 300);
const canvas = document.querySelector('canvas')!;
const renderer = new Renderer(canvas);
const scenes = params.get('scenes')?.split(',') ?? renderer.scenes;

const summarize = (times: number[]): PartTimes => {
  const sorted = [...times].sort((a, b) => a - b);
  return {
    p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
    mean: times.reduce((sum, t) => sum + t, 0) / times.length,
  };
};

/** Times one background: a fresh match on it, its frames simulated and drawn. */
function bench(scene: string) {
  const paddles = [
    new Paddle(0, PADDLE.OFFSET_X, COLORS.CYAN),
    new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, COLORS.PINK),
  ];
  const particles = new ParticleSystem();
  const events: MatchEvent[] = [];
  const random = Math.random;
  const flow = new MatchFlow({
    paddles,
    ball: new Ball(),
    input: { pollPlayerMovement: () => {} },
    getDifficulty: () => DifficultyLevel.HARD,
    onEvent: (event) => events.push(event),
    random,
  });
  // Both play with every skill prototype, so their forecasts and layers are in the measure
  const lineup = paddles.map(() => ({
    controller: new AiPaddleController(random, () => DifficultyLevel.HARD),
    overdrive: true,
    skills: ['arc', 'analyzer', 'reflex'] as const,
  }));
  // The drawn modifiers' layers in the measure too (Hard's level of everything at once)
  const modifiers = ['wind', 'darkness', 'bumpers', 'invisibleBand', 'slipperyRain'] as const;
  flow.startMatch({ ...STANDARD_RULES, winningScores: firstTo(99), balls: 2, modifiers }, lineup);
  renderer.pinBackground(scene as never);

  const render: number[] = [];
  const simulation: number[] = [];
  for (let i = 0; i < WARM_UP + frames; i++) {
    // The heat rises to full and falls back over the run, so every background shows it all
    const climax = (1 - Math.cos((i / (WARM_UP + frames)) * 2 * Math.PI)) / 2;

    const simStart = performance.now();
    for (let s = 0; s < FRAME / STEP; s++) flow.update(STEP);
    flow.interpolate(1);
    const simEnd = performance.now();

    for (const event of events.splice(0)) {
      if (event.type === 'paddleHit') particles.burst(event.x, event.y, COLORS.PINK, SPARKS);
    }
    particles.update(FRAME);

    const frame: RenderFrame = {
      court: {
        gameState: flow.gameState,
        isDemo: false,
        paddles,
        scores: flow.scores,
        balls: flow.balls,
        ball: flow.leadBall,
        time: flow.time,
        serveTime: flow.serveTime,
        rally: flow.rally,
        timeWarp: flow.timeWarp,
        shotReads: flow.shotReads,
        modifiers: flow.activeModifiers,
        conditions: flow.court,
      },
      hud: {
        readyText: 'GET READY',
        condition: null,
        isConditionOnCourt: false,
        sideLabels: null,
        overdriveCharges: flow.overdriveCharges,
        overdriveStreaks: flow.overdriveStreaks,
      },
      drama: {
        climax,
        vignette: climax,
        zoom: 1 + 0.1 * climax,
        paddleGlow: [climax, climax],
        paddleTilt: [0, 0],
        meterSpent: [0, 0],
      },
      particles,
      analyser: null,
      isRotated: false,
    };
    const renderStart = performance.now();
    renderer.update(FRAME, frame);
    renderer.render(frame, FRAME);
    const renderEnd = performance.now();

    if (i >= WARM_UP) {
      simulation.push(simEnd - simStart);
      render.push(renderEnd - renderStart);
    }
  }
  return { render: summarize(render), simulation: summarize(simulation) };
}

const result: BenchResult = { scenes: {}, pixelRatio: renderer.pixelRatio };
for (const scene of scenes) result.scenes[scene] = bench(scene);
window.benchResult = result;
