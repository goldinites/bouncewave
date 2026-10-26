/*
 * The impact stand (served by the dev server, never built): a scripted rally on the real
 * simulation, effects and Renderer, filmed frame by frame around each kind of hit, for
 * scripts/impact.mjs (`npm run render:impact`) to write into renders/impact/ (ROADMAP 6.1).
 *
 * The left (cyan) paddle plays the player's side with Overdrive on: plain hits while the ball
 * speeds up, three perfect hits that charge the meter, then the power shot, which the right
 * (pink) paddle lets past for the goal. The goal wins the match, and its replay (app/MatchReplay)
 * is filmed too, a frame in every REPLAY_EVERY. Each paddle meets the ball at the spot on its face
 * the script asks for. The randomness is seeded, so every run films the same frames.
 *
 * Exposes `window.renderImpact({ scene })`, which plays the rally on that background and resolves
 * to one contact sheet per moment (close up around the contact, and the whole screen) and a short
 * report of what each moment was.
 */
import '@fontsource-variable/tektur/wght.css';

// A fixed seed for everything at random, the effects' sparks included, as on the visual stand.
// Set before anything is imported, so module-level randomness is seeded too
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
const MAX_FRAMES = 60 * 60; // a rally that never gets there is a broken script, not a long film

// Frames filmed around each moment: PRE before the first frame showing it, POST from it on
const FILM = { PRE: 3, POST: 13, COLUMNS: 4 } as const;
// The close-up around the contact, court px, and the whole screen's scale on the sheet
const CLOSE_UP = { WIDTH: 300, HEIGHT: 190 } as const;
const WHOLE_SCALE = 0.5;
const LABEL = { HEIGHT: 18, FONT: '12px monospace' } as const;
// The replay is filmed a frame in this many, as long as it runs
const REPLAY_EVERY = 16;

// Where on its face each paddle meets the ball, in [-1, 1] of its half-height: within the
// perfect zone (STANDARD_PADDLE.perfectZone, 0.2) a perfect hit, off it a plain one at an angle
const PLAIN_OFFSET = 0.55;
const PERFECT_OFFSET = 0.05;
// The left paddle's hits: PLAIN_HITS plain ones, then perfect ones up to the power shot
const PLAIN_HITS = 6;
const POWER_HIT = PLAIN_HITS + 4;

type MatchEvent = import('@/match/MatchFlow').MatchEvent;
type RenderFrame = import('@/render/scene').RenderFrame;
type Paddle = import('@/match/Paddle').Paddle;
type Ball = import('@/match/Ball').Ball;
type PaddleController = import('@/match/PaddleController').PaddleController;

/** One moment filmed: what it was, and where on court it happened. */
interface Moment {
  id: string;
  title: string;
  x: number;
  y: number;
  /** Whole-screen frames, the PRE before it first, in order. */
  frames: HTMLCanvasElement[];
  /** Frames apart on the sheet (the replay's), and how many come before it; 1 and FILM.PRE if not said. */
  step?: number;
  pre?: number;
}

export interface ImpactResult {
  markdown: string;
  /** File name → PNG data URL. */
  images: Record<string, string>;
}

declare global {
  interface Window {
    renderImpact?: (options: { scene: string }) => Promise<ImpactResult>;
  }
}

const { Ball } = await import('@/match/Ball');
const { COURT, PADDLE } = await import('@/match/config');
const { DifficultyLevel } = await import('@/match/difficulty');
const { MatchFlow } = await import('@/match/MatchFlow');
const { Paddle } = await import('@/match/Paddle');
const { predictArrival } = await import('@/match/AiController');
const { firstTo, STANDARD_RULES } = await import('@/match/rules');
const { MatchReplay } = await import('@/app/MatchReplay');
const { EffectsDirector } = await import('@/fx/EffectsDirector');
const { ParticleSystem } = await import('@/fx/ParticleSystem');
const { Renderer } = await import('@/render/Renderer');
const { gameFont } = await import('@/shared/fonts');
const { COLORS } = await import('@/shared/palette');

await document.fonts.load(gameFont(700, 16));

/** Silence that answers anything: the effects' every call to the audio does nothing. */
const silence: object = new Proxy(() => undefined, {
  get: (_target, key) => (key === 'then' ? undefined : silence),
  apply: () => undefined,
});

/** Meets the ball at the spot on the paddle's face that `offsetFor` asks for, hit by hit. */
class ScriptedController implements PaddleController {
  constructor(private readonly offsetFor: () => number | null) {}

  public steer(paddle: Paddle, ball: Ball): void {
    const isComing = paddle.side === 0 ? ball.vx < 0 : ball.vx > 0;
    if (!isComing) {
      paddle.setTargetY(COURT.HEIGHT / 2);
      return;
    }
    // Where the ball's centre will be as its edge touches the face
    const face =
      paddle.side === 0 ? paddle.x + paddle.spec.width + ball.radius : paddle.x - ball.radius;
    const arrival = predictArrival(face, ball.x, ball.y, ball.vx, ball.vy, ball.radius);
    const offset = this.offsetFor();
    // No offset: the paddle lets the ball past, as far from it as it can get
    const target =
      offset === null
        ? arrival.y < COURT.HEIGHT / 2
          ? COURT.HEIGHT
          : 0
        : // The paddle takes the ball on its side away from the nearer wall, never pinned to it
          arrival.y - (Math.sign(arrival.y - COURT.HEIGHT / 2) * offset * paddle.spec.height) / 2;
    paddle.setTargetY(target);
  }

  public topSpeed(paddle: Paddle): number {
    return PADDLE.KEYBOARD_SPEED * paddle.spec.speed;
  }

  public onServe(): void {}
  public onIncomingShot(): void {}
  public onPoint(): void {}
  public reset(): void {}
}

/** Plays the scripted rally on `scene` and films its moments. */
async function renderImpact({ scene }: { scene: string }): Promise<ImpactResult> {
  const canvas = document.querySelector('canvas')!;
  const renderer = new Renderer(canvas);
  if (!renderer.pinBackground(scene as never)) throw new Error(`No background called ${scene}`);

  const paddles = [
    new Paddle(0, PADDLE.OFFSET_X, COLORS.CYAN),
    new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, COLORS.PINK),
  ];
  const particles = new ParticleSystem();
  const effects = new EffectsDirector({
    renderer,
    audio: silence as never,
    particles,
    paddles,
    translate: () => '',
    // The backdrop pinned stays: no channels flicking over as the match starts
    isRestart: () => true,
  });

  let leftHits = 0;
  let isRallyOver = false;
  const left = new ScriptedController(() => {
    const next = leftHits + 1;
    return next <= PLAIN_HITS ? PLAIN_OFFSET : PERFECT_OFFSET;
  });
  const right = new ScriptedController(() => (leftHits >= POWER_HIT ? null : PLAIN_OFFSET));

  const pending: MatchEvent[] = [];
  const random = Math.random;
  const replay = new MatchReplay({
    renderer,
    paddles: () => paddles,
    time: () => flow.time,
    isEnabled: () => true,
    label: () => 'REPLAY',
  });
  const flow: InstanceType<typeof MatchFlow> = new MatchFlow({
    paddles,
    ball: new Ball(),
    input: { pollPlayerMovement: () => {} },
    getDifficulty: () => DifficultyLevel.HARD,
    onEvent: (event) =>
      replay.route(event, (published) => {
        effects.handle(published);
        pending.push(published);
      }),
    random,
  });
  flow.startMatch({ ...STANDARD_RULES, winningScores: firstTo(1), rallyPressure: false }, [
    { controller: left, overdrive: true },
    { controller: right, overdrive: false },
  ]);

  /** What a match event is worth filming as, if anything. */
  let hasFilmedWall = false;
  const hits: string[] = [];
  const momentOf = (event: MatchEvent): Omit<Moment, 'frames'> | null => {
    if (event.type === 'paddleHit') {
      const kind = event.isPowerShot ? 'power' : event.isPerfect ? 'perfect' : 'plain';
      const charged = event.chargedOverdrive ? ', charged' : '';
      hits.push(`${event.rally}. ${event.paddleIndex === 0 ? 'left' : 'right'} ${kind}${charged}`);
      if (event.paddleIndex === 1) return null;
      leftHits++;
      const about = `speed ${Math.round(event.speed)} px/s, rally ${event.rally}`;
      const at = { x: event.x, y: event.y };
      if (event.isPowerShot) return { id: 'power', title: `Overdrive power shot, ${about}`, ...at };
      if (event.chargedOverdrive) {
        return { id: 'perfect-charge', title: `Perfect hit filling Overdrive, ${about}`, ...at };
      }
      if (leftHits === 1) return { id: 'plain-slow', title: `Plain hit, slow: ${about}`, ...at };
      if (leftHits === PLAIN_HITS) {
        return { id: 'plain-fast', title: `Plain hit, fast: ${about}`, ...at };
      }
      if (leftHits === PLAIN_HITS + 1)
        return { id: 'perfect', title: `Perfect hit, ${about}`, ...at };
    }
    if (event.type === 'wallBounce' && leftHits >= PLAIN_HITS && !hasFilmedWall) {
      hasFilmedWall = true;
      const ball = flow.leadBall;
      return {
        id: 'wall',
        title: `Wall bounce, speed ${Math.round(ball.speed)} px/s`,
        x: ball.x,
        y: ball.y,
      };
    }
    if (event.type === 'score') {
      isRallyOver = true;
      // At the goal it went in: the ball itself is already back in the middle for the serve
      const x = event.scoringPlayerIndex === 0 ? COURT.WIDTH : 0;
      return { id: 'goal', title: 'Goal after the power shot', x, y: event.y };
    }
    return null;
  };

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
      timeWarp: null,
      shotReads: [],
      modifiers: [],
      conditions: flow.court,
    },
    hud: {
      readyText: 'GET READY',
      condition: null,
      isConditionOnCourt: false,
      sideLabels: null,
      overtimeText: null,
      perfectZoneMark: null,
      overdriveCharges: flow.overdriveCharges,
      overdriveStreaks: flow.overdriveStreaks,
    },
    drama: {
      climax: 0,
      vignette: 0,
      zoom: 1,
      paddleGlow: effects.paddleGlow,
      paddleTilt: effects.paddleTilt,
      meterSpent: effects.meterSpent,
      paddleRecoil: effects.paddleRecoil,
      ballSquash: effects.ballSquash,
      ballWhiteHot: effects.ballWhiteHot,
      paddleOut: effects.paddleOut,
    },
    particles,
    analyser: null,
    isRotated: false,
    replay: null,
  };

  /** The frame as the game builds it (app/Game.ts, buildRenderFrame), for the state now. */
  const refreshFrame = () => {
    Object.assign(frame.court, {
      gameState: flow.gameState,
      scores: flow.scores,
      balls: flow.balls,
      ball: flow.leadBall,
      time: flow.time,
      serveTime: flow.serveTime,
      rally: flow.rally,
      conditions: flow.court,
    });
    Object.assign(frame.hud, {
      overdriveCharges: flow.overdriveCharges,
      overdriveStreaks: flow.overdriveStreaks,
    });
    Object.assign(frame.drama, {
      climax: effects.climaxLevel,
      vignette: effects.vignette,
      zoom: effects.cameraZoom,
      paddleGlow: effects.paddleGlow,
      paddleTilt: effects.paddleTilt,
      meterSpent: effects.meterSpent,
      paddleRecoil: effects.paddleRecoil,
      ballSquash: effects.ballSquash,
      ballWhiteHot: effects.ballWhiteHot,
      paddleOut: effects.paddleOut,
    });
  };

  const copyOf = (source: HTMLCanvasElement) => {
    const copy = document.createElement('canvas');
    copy.width = source.width;
    copy.height = source.height;
    copy.getContext('2d')!.drawImage(source, 0, 0);
    return copy;
  };

  const recent: HTMLCanvasElement[] = [];
  const filming: Moment[] = [];
  const filmed: Moment[] = [];
  const replayed: Moment = {
    id: 'replay',
    title: 'Replay of the winning point',
    x: 0,
    y: 0,
    frames: [],
    step: REPLAY_EVERY,
    pre: 0,
  };
  let replayFrame = 0;
  for (let i = 0; i < MAX_FRAMES; i++) {
    effects.beforeSimulation(FRAME, flow);
    const dt = FRAME * effects.timeScale;
    if (!replay.isHolding) {
      for (let s = 0; s < Math.round(dt / STEP); s++) flow.update(STEP);
    }
    effects.afterSimulation(dt, flow);
    flow.interpolate(1);
    replay.record(flow);
    replay.update(FRAME);

    for (const event of pending.splice(0)) {
      const moment = momentOf(event);
      if (moment) filming.push({ ...moment, frames: [...recent] });
    }

    refreshFrame();
    const shown = replay.isShowing ? replay.frame(frame) : frame;
    renderer.update(FRAME, shown);
    renderer.render(shown, FRAME);

    const shot = copyOf(canvas);
    if (replay.isShowing && replayFrame++ % REPLAY_EVERY === 0) replayed.frames.push(shot);
    recent.push(shot);
    if (recent.length > FILM.PRE) recent.shift();
    for (const moment of [...filming]) {
      moment.frames.push(shot);
      if (moment.frames.length >= FILM.PRE + FILM.POST) {
        filming.splice(filming.indexOf(moment), 1);
        filmed.push(moment);
      }
    }
    if (isRallyOver && filming.length === 0 && !replay.isHolding) break;
  }
  if (replayed.frames.length > 0) filmed.push(replayed);
  renderer.dispose();
  if (!isRallyOver) throw new Error(`The scripted rally on ${scene} never reached its goal`);

  const scale = canvas.width / COURT.WIDTH;
  const images: Record<string, string> = {};
  const lines = [`# Impact on ${scene}`, ''];
  for (const moment of filmed) {
    if (moment.id !== 'replay') images[`${moment.id}-close.png`] = sheet(moment, scale, true);
    images[`${moment.id}-whole.png`] = sheet(moment, scale, false);
    lines.push(`- **${moment.id}**: ${moment.title}`);
  }
  lines.push(
    '',
    `Hits: ${hits.join(' · ')}`,
    '',
    `Frames ${-FILM.PRE}…+${FILM.POST - 1} at 60 fps; 0 is the first frame drawn after it happened.`,
  );
  return { markdown: lines.join('\n') + '\n', images };
}

/**
 * A moment's frames on one contact sheet, numbered from the first frame showing it: close up
 * around the contact at full size, or the whole screen at WHOLE_SCALE.
 */
function sheet(moment: Moment, scale: number, isCloseUp: boolean): string {
  const [cellWidth, cellHeight] = isCloseUp
    ? [CLOSE_UP.WIDTH * scale, CLOSE_UP.HEIGHT * scale]
    : [COURT.WIDTH * scale * WHOLE_SCALE, COURT.HEIGHT * scale * WHOLE_SCALE];
  const rows = Math.ceil(moment.frames.length / FILM.COLUMNS);
  const out = document.createElement('canvas');
  out.width = cellWidth * FILM.COLUMNS;
  out.height = (cellHeight + LABEL.HEIGHT) * rows + LABEL.HEIGHT;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.font = LABEL.FONT;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(moment.title, 6, LABEL.HEIGHT / 2);

  // The close-up keeps the contact in its middle, as far as the court's edges let it
  const left = Math.min(Math.max(0, moment.x - CLOSE_UP.WIDTH / 2), COURT.WIDTH - CLOSE_UP.WIDTH);
  const top = Math.min(Math.max(0, moment.y - CLOSE_UP.HEIGHT / 2), COURT.HEIGHT - CLOSE_UP.HEIGHT);

  moment.frames.forEach((frame, index) => {
    const x = (index % FILM.COLUMNS) * cellWidth;
    const y = LABEL.HEIGHT + Math.floor(index / FILM.COLUMNS) * (cellHeight + LABEL.HEIGHT);
    const number = (index - (moment.pre ?? FILM.PRE)) * (moment.step ?? 1);
    ctx.fillStyle = number === 0 ? '#ffe53b' : '#aaa';
    ctx.fillText(
      `${number > 0 ? '+' : ''}${number}  ${Math.round(number * FRAME * 1000)} ms`,
      x + 6,
      y + LABEL.HEIGHT / 2,
    );
    if (isCloseUp) {
      ctx.drawImage(
        frame,
        left * scale,
        top * scale,
        cellWidth,
        cellHeight,
        x,
        y + LABEL.HEIGHT,
        cellWidth,
        cellHeight,
      );
    } else {
      ctx.drawImage(frame, x, y + LABEL.HEIGHT, cellWidth, cellHeight);
    }
  });
  return out.toDataURL('image/png');
}

window.renderImpact = renderImpact;
