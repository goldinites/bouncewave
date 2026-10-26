/*
 * The video stand (served by the dev server, never built; `npm run video`, scripts/video.mjs,
 * ROADMAP 7.3): a video of videos.ts filmed on the game's own simulation, effects and Renderer,
 * frame by frame at 60 fps, and its sound rendered offline through the game's own mixer — the
 * song as a match plays it, and every sound the effects asked for at the frame they asked.
 *
 * Shots are cut on the song's bar lines. The randomness is seeded, so every run films the same
 * video. The script calls `startVideo(id)`, then `nextFrame()` until it gives null (each a JPEG
 * data URL of the frame), then `renderAudio()` (a WAV, base64).
 */
import '@fontsource-variable/tektur/wght.css';

// A fixed seed for everything at random, as on the impact stand. Set before anything is
// imported, so module-level randomness is seeded too
let seed = 0x5eed;
const reseed = () => (seed = 0x5eed);
Math.random = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const FRAME = 1 / 60;
const RATE = 48000;
const TICK = 0.05; // s of audio between the music's scheduler ticks (it looks 0.15 s ahead)
const START_DELAY = 0.1; // s: the music engine's own delay before its first step
const TAIL = 1.5; // s of sound rendered past the last frame, faded out by the script
// The kick the backdrop breathes with: a beat's pulse, decaying over this many s
const BEAT_DECAY = 0.14;
// Where a stroke meets the ball on the paddle's face, in [-1, 1] of its half-height: within the
// perfect zone (0.2) a perfect hit, off it a plain one at an angle
const OFFSET = { plain: 0.55, perfect: 0.05 } as const;
const JPEG_QUALITY = 0.92;

/**
 * Each format's picture and the court filmed for it, px. The vertical one turns the court as a
 * portrait phone does (the stage turned -90°, the player's side at the bottom), the titles in the
 * band above it; the wide one sets the court between bars.
 */
const FORMATS = {
  vertical: { width: 1080, height: 1920, court: { width: 1920, height: 1200 }, band: 192 },
  wide: { width: 1920, height: 1080, court: { width: 1728, height: 1080 }, band: 0 },
} as const;
const TITLE = { SIZE: { vertical: 92, wide: 84 }, GLOW: 28, FADE: 0.08 } as const;

type MatchEvent = import('@/match/MatchFlow').MatchEvent;
type MusicState = import('@/audio/music/intensity').MusicState;
type RenderFrame = import('@/render/scene').RenderFrame;
type Shot = import('./videos').Shot;
type Video = import('./videos').Video;
type Stroke = import('./videos').Stroke;

declare global {
  interface Window {
    startVideo?: (id: string) => Promise<{ frames: number; width: number; height: number }>;
    nextFrame?: () => Promise<string | null>;
    renderAudio?: () => Promise<string>;
    videoReport?: () => string;
  }
}

const { Ball } = await import('@/match/Ball');
const { COURT, PADDLE } = await import('@/match/config');
const { DIFFICULTY_CONFIGS, DifficultyLevel } = await import('@/match/difficulty');
const { MatchFlow } = await import('@/match/MatchFlow');
const { Paddle } = await import('@/match/Paddle');
const { firstTo, STANDARD_RULES } = await import('@/match/rules');
const { FixedStep } = await import('@/app/FixedStep');
const { MatchReplay } = await import('@/app/MatchReplay');
const { EffectsDirector } = await import('@/fx/EffectsDirector');
const { ParticleSystem } = await import('@/fx/ParticleSystem');
const { Renderer } = await import('@/render/Renderer');
const { gameFont } = await import('@/shared/fonts');
const { COLORS } = await import('@/shared/palette');
const { Mixer } = await import('@/audio/Mixer');
const { MusicEngine } = await import('@/audio/music/MusicEngine');
const { soundsFor } = await import('@/audio/music/palette');
const { STEPS_PER_BAR } = await import('@/audio/music/score');
const { SONGS } = await import('@/audio/music/songs');
const { ACTION_PITCHED, ACTION_SAMPLES } = await import('@/audio/samples/actions');
const { SampleBank } = await import('@/audio/samples/SampleBank');
const { TRANSITION_SAMPLES } = await import('@/audio/samples/transitions');
const { SoundEffects } = await import('@/audio/sfx/SoundEffects');
const { ScriptedController } = await import('../shared/ScriptedController');
const { VIDEOS, wide } = await import('./videos');

await document.fonts.load(gameFont(900, 16));

const LEVELS = {
  easy: DifficultyLevel.EASY,
  normal: DifficultyLevel.NORMAL,
  hard: DifficultyLevel.HARD,
  insane: DifficultyLevel.INSANE,
} as const;

/** A call the effects made to the sound, to make again at its time in the offline render. */
interface SoundCall {
  at: number;
  target: 'sfx' | 'music';
  method: string;
  args: unknown[];
}

/** Everything one filming gathers, frame by frame. */
interface Filming {
  video: Video;
  format: (typeof FORMATS)[keyof typeof FORMATS];
  /** s a bar of the song takes, and a beat. */
  bar: number;
  beat: number;
  /** When each shot starts, s; the last entry is the video's end. */
  cuts: number[];
  frames: number;
  frame: number;
  shot: ShotPlay | null;
  calls: SoundCall[];
  states: { at: number; state: MusicState }[];
  /** What happened when, shot by shot, for the report. */
  log: string[];
  out: HTMLCanvasElement;
}

/** A shot being filmed: its match and everything that draws it. */
interface ShotPlay {
  index: number;
  def: Shot;
  start: number;
  renderer: InstanceType<typeof Renderer>;
  step: () => void;
  dispose: () => void;
}

let filming: Filming | null = null;
const canvas = document.querySelector('canvas')!;

/** The video by its id; a vertical video's id with `-wide` films it wide. */
function videoById(id: string): Video {
  const video = VIDEOS.find((v) => v.id === id || `${v.id}-wide` === id);
  if (!video) throw new Error(`No video called ${id} (e2e/video/videos.ts)`);
  return video.id === id ? video : wide(video);
}

async function startVideo(id: string) {
  const video = videoById(id);
  const song = SONGS.find((s) => s.id === video.song);
  if (!song) throw new Error(`No song called ${video.song}`);
  const format = FORMATS[video.format];
  canvas.style.width = `${format.court.width}px`;
  canvas.style.height = `${format.court.height}px`;
  const bar = (60 / song.bpm / 4) * STEPS_PER_BAR;
  // Cut on the bar lines: the first shot from the start, the music's first bar a moment in
  const cuts = [0];
  let bars = 0;
  for (const shot of video.shots) {
    bars += shot.bars;
    cuts.push(START_DELAY + bars * bar);
  }
  const out = document.createElement('canvas');
  out.width = format.width;
  out.height = format.height;
  reseed();
  filming = {
    video,
    format,
    bar,
    beat: bar / 4,
    cuts,
    frames: Math.ceil(cuts[cuts.length - 1] / FRAME),
    frame: 0,
    shot: null,
    calls: [],
    states: [],
    log: [],
    out,
  };
  return { frames: filming.frames, width: format.width, height: format.height };
}

/** Films the next frame, starting the shot it belongs to; null once the video is over. */
async function nextFrame(): Promise<string | null> {
  const f = filming;
  if (!f) throw new Error('startVideo first');
  if (f.frame >= f.frames) {
    f.shot?.dispose();
    f.shot = null;
    return null;
  }
  const time = f.frame * FRAME;
  const index = f.cuts.findIndex((cut, i) => time >= cut && time < f.cuts[i + 1]);
  if (f.shot?.index !== index) {
    f.shot?.dispose();
    f.shot = playShot(f, index);
  }
  f.shot.step();
  compose(f, f.shot, time);
  f.frame++;
  return f.out.toDataURL('image/jpeg', JPEG_QUALITY);
}

/** Sets a shot's match going, ready to be stepped frame by frame. */
function playShot(f: Filming, index: number): ShotPlay {
  const def = f.video.shots[index];
  const start = f.cuts[index];
  const renderer = new Renderer(canvas);
  if (!renderer.pinBackground(def.scene as never)) throw new Error(`No background ${def.scene}`);
  const now = () => f.frame * FRAME;

  // The sound the effects ask for, kept for the offline render with the time it was asked at
  const record = (target: SoundCall['target']) =>
    new Proxy(
      {},
      {
        get:
          (_target, method) =>
          (...args: unknown[]) => {
            f.calls.push({ at: now(), target, method: String(method), args: copy(args) });
          },
      },
    );
  const audio = { isMusicHeard: true, sfx: record('sfx'), music: record('music') };

  const paddles = [
    new Paddle(0, PADDLE.OFFSET_X, COLORS.CYAN),
    new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, COLORS.PINK),
  ];
  const particles = new ParticleSystem();
  const effects = new EffectsDirector({
    renderer,
    audio: audio as never,
    particles,
    paddles,
    translate: () => '',
    // The backdrop pinned stays: no channels flicking over as the match starts
    isRestart: () => true,
  });
  const hits = [0, 0];
  const strokeOf = (strokes: Stroke[], hit: number) => strokes[Math.min(hit, strokes.length - 1)];
  const offsetOf = (stroke: Stroke) => (stroke === 'miss' ? null : OFFSET[stroke]);
  const left = new ScriptedController(() => offsetOf(strokeOf(def.left, hits[0])));
  const ball = new Ball();
  const right = new ScriptedController(() =>
    def.finish === 'power' && ball.isPowerShot ? null : offsetOf(strokeOf(def.right, hits[1])),
  );
  const replay = new MatchReplay({
    renderer,
    paddles: () => paddles,
    time: () => flow.time,
    isEnabled: () => true,
    label: () => 'REPLAY',
  });
  const flow: InstanceType<typeof MatchFlow> = new MatchFlow({
    paddles,
    ball,
    input: { pollPlayerMovement: () => {} },
    getDifficulty: () => LEVELS[def.level ?? 'hard'],
    onEvent: (event: MatchEvent) =>
      replay.route(event, (published) => {
        if (published.type === 'paddleHit') hits[published.paddleIndex]++;
        const moment = momentOf(published);
        if (moment) f.log.push(`- ${now().toFixed(2)} s, shot ${index + 1}: ${moment}`);
        effects.handle(published);
      }),
    random: Math.random,
  });
  flow.startMatch(
    { ...STANDARD_RULES, winningScores: firstTo(def.win ? 1 : 99), rallyPressure: false },
    [
      { controller: left, overdrive: true },
      { controller: right, overdrive: false },
    ],
    LEVELS[def.level ?? 'hard'],
  );
  const simulation = new FixedStep();

  const step = () => {
    const local = now() - start;
    const slow = def.slow?.find((s) => local >= s.from && local < s.to)?.scale ?? 1;
    effects.beforeSimulation(FRAME, flow);
    const dt = FRAME * effects.timeScale * slow;
    if (!replay.isHolding) simulation.advance(dt, (s) => flow.update(s));
    effects.afterSimulation(dt, flow);
    flow.interpolate(simulation.alpha);
    replay.record(flow);
    replay.update(FRAME);
    const live = frameOf(f, flow, effects, particles, paddles, simulation.lag);
    const shown = replay.isHolding ? replay.frame(live) : live;
    renderer.update(FRAME, shown);
    renderer.render(shown, FRAME);
    f.states.push({
      at: now(),
      state: {
        // Muffled while the winning point is replayed, as behind the pause
        gameState: replay.isShowing ? 'paused' : flow.gameState,
        serveTime: flow.serveTime,
        ballSpeed: Math.max(...flow.balls.map((b) => b.speed)),
        maxBallSpeed: DIFFICULTY_CONFIGS[flow.difficulty].maxSpeed,
        rally: flow.rally,
        isOvertime: flow.isOvertime,
        scores: [...flow.scores] as [number, number],
        winningScores: flow.rules.winningScores,
        isMuted: false,
        difficulty: flow.difficulty,
      },
    });
  };
  return { index, def, start, renderer, step, dispose: () => renderer.dispose() };
}

/** What a match event is worth telling in the report, if anything. */
function momentOf(event: MatchEvent): string | null {
  if (event.type === 'paddleHit' && event.isPowerShot) return `power shot, rally ${event.rally}`;
  if (event.type === 'paddleHit' && event.chargedOverdrive) return 'Overdrive charged';
  if (event.type === 'score')
    return `goal for the ${event.scoringPlayerIndex === 0 ? 'left' : 'right'}`;
  if (event.type === 'finaleStart') return `the match won (${event.scores.join(':')})`;
  if (event.type === 'gameOver') return 'the finale over';
  return null;
}

/** When each shot starts and what happened in them: a script is tuned by it. */
function videoReport(): string {
  const f = filming;
  if (!f) throw new Error('startVideo first');
  const cuts = f.cuts
    .slice(0, -1)
    .map(
      (cut, i) =>
        `- shot ${i + 1}: ${cut.toFixed(2)}–${f.cuts[i + 1].toFixed(2)} s, ${f.video.shots[i].bars} bars`,
    );
  return [`# ${f.video.id}`, '', ...cuts, '', ...f.log, ''].join('\n');
}

/** The frame as the game builds it (app/Game.ts, buildRenderFrame), for the state now. */
function frameOf(
  f: Filming,
  flow: InstanceType<typeof MatchFlow>,
  effects: InstanceType<typeof EffectsDirector>,
  particles: InstanceType<typeof ParticleSystem>,
  paddles: InstanceType<typeof Paddle>[],
  lag: number,
): RenderFrame {
  const time = f.frame * FRAME;
  // The music's kick, which the backdrop breathes with: a pulse on every beat of the song
  const sinceBeat = (time - START_DELAY) % f.beat;
  return {
    court: {
      gameState: flow.gameState,
      isDemo: flow.isDemo,
      paddles,
      scores: flow.scores,
      balls: flow.balls,
      ball: flow.leadBall,
      time: Math.max(0, flow.time - lag),
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
      overtimeText: flow.isOvertime ? 'OVERTIME' : null,
      perfectZoneMark: null,
      overdriveCharges: flow.overdriveCharges,
      overdriveStreaks: flow.overdriveStreaks,
      overdriveCapacities: flow.overdriveCapacities,
    },
    drama: {
      climax: effects.climaxLevel,
      vignette: effects.vignette,
      zoom: effects.cameraZoom,
      paddleGlow: effects.paddleGlow,
      paddleTilt: effects.paddleTilt,
      paddleRecoil: effects.paddleRecoil,
      ballSquash: effects.ballSquash,
      ballWhiteHot: effects.ballWhiteHot,
      paddleOut: effects.paddleOut,
      meterSpent: effects.meterSpent,
    },
    particles,
    analyser: null,
    beat: time < START_DELAY ? 0 : Math.exp(-sinceBeat / BEAT_DECAY),
    isRotated: f.video.format === 'vertical',
    replay: null,
  };
}

/** The frame in the video's format: the court turned or between bars, and any title over it. */
function compose(f: Filming, shot: ShotPlay, time: number): void {
  const { format, out } = f;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, out.width, out.height);
  if (f.video.format === 'vertical') {
    // Turned as the stage is on a portrait phone: the court's left (the player) at the bottom
    const height = out.width * (format.court.width / format.court.height);
    ctx.save();
    ctx.translate(0, format.band + height);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(canvas, 0, 0, height, out.width);
    ctx.restore();
  } else {
    ctx.drawImage(canvas, (out.width - format.court.width) / 2, 0);
  }

  for (const title of shot.def.titles ?? []) {
    const from = shot.start + title.beat * f.beat;
    const to = from + title.beats * f.beat;
    if (time < from || time >= to) continue;
    const alpha = Math.min(1, (time - from) / TITLE.FADE, (to - time) / TITLE.FADE);
    const size = TITLE.SIZE[f.video.format];
    const y = f.video.format === 'vertical' ? format.band / 2 : out.height * 0.82;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = gameFont(900, size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Neon: a pink glow, then the white letters over it
    ctx.shadowColor = COLORS.PINK;
    ctx.shadowBlur = TITLE.GLOW;
    ctx.fillStyle = COLORS.PINK;
    ctx.fillText(title.text, out.width / 2, y);
    ctx.shadowBlur = TITLE.GLOW / 3;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title.text, out.width / 2, y);
    ctx.restore();
  }
}

/** Arguments kept as they were when asked: the effects may change the objects they pass. */
function copy(args: unknown[]): unknown[] {
  try {
    return structuredClone(args);
  } catch {
    return args;
  }
}

/** The video's sound: its song as the match played it, with every sound the effects asked for. */
async function renderAudio(): Promise<string> {
  const f = filming;
  if (!f) throw new Error('startVideo first');
  const song = SONGS.find((s) => s.id === f.video.song)!;
  const bank = new SampleBank();
  await bank.render(RATE, ACTION_SAMPLES);
  await bank.renderPitched(RATE, ACTION_PITCHED);
  await bank.render(RATE, TRANSITION_SAMPLES);
  const { pitched, oneShots } = soundsFor(song);
  await bank.renderPitched(RATE, pitched);
  await bank.render(RATE, oneShots);
  reseed();
  bank.rewind();

  const seconds = f.frames * FRAME + TAIL;
  const context = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
  // The game's audio is written for a live context; an offline one has all it uses
  const ac = context as unknown as AudioContext;
  const mixer = new Mixer(ac);
  const music = new MusicEngine();
  music.audition(song.id);
  music.init(ac, mixer.music, bank, 'manual');
  // The room is built off a timer, out of the scheduler's tick
  await new Promise((resolve) => setTimeout(resolve, 0));
  const sfx = new SoundEffects(
    () => ac,
    () => false,
    () => true,
    () => music.getHarmony(),
    () => mixer,
    () => bank,
    () => music.getHeat(),
  );

  // Every action at its render quantum (128 frames), where the context can be suspended
  const actions = new Map<number, (() => void)[]>();
  const at = (time: number, action: () => void) => {
    const frame = Math.max(128, Math.round((time * RATE) / 128) * 128);
    if (frame >= context.length) return;
    actions.set(frame, [...(actions.get(frame) ?? []), action]);
  };
  let s = 0;
  for (let time = TICK; time < seconds; time += TICK) {
    // The match's state as the frame nearest before this tick left it
    while (s + 1 < f.states.length && f.states[s + 1].at <= time) s++;
    const state = f.states[s]?.state;
    at(time, () => {
      if (state) music.setState(state);
      music.tick();
    });
  }
  for (const call of f.calls) {
    // The song is the video's: the backdrop's own song is not called in
    if (call.target === 'music' && call.method === 'enterScene') continue;
    const target = (call.target === 'sfx' ? sfx : music) as unknown as Record<
      string,
      (...args: unknown[]) => void
    >;
    at(call.at, () => target[call.method]?.(...call.args));
  }
  for (const [frame, run] of actions) {
    void context.suspend(frame / RATE).then(() => {
      for (const action of run) action();
      void context.resume();
    });
  }
  music.tick();
  const buffer = await context.startRendering();
  music.dispose();
  return wav(buffer);
}

/** 16-bit stereo WAV of the buffer, base64. */
function wav(buffer: AudioBuffer): string {
  const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
  const length = buffer.length;
  const bytes = new DataView(new ArrayBuffer(44 + length * 4));
  const text = (offset: number, value: string) =>
    [...value].forEach((c, i) => bytes.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  bytes.setUint32(4, 36 + length * 4, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  bytes.setUint32(16, 16, true);
  bytes.setUint16(20, 1, true); // PCM
  bytes.setUint16(22, 2, true);
  bytes.setUint32(24, RATE, true);
  bytes.setUint32(28, RATE * 4, true);
  bytes.setUint16(32, 4, true);
  bytes.setUint16(34, 16, true);
  text(36, 'data');
  bytes.setUint32(40, length * 4, true);
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < 2; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      bytes.setInt16(44 + i * 4 + c * 2, Math.round(sample * 0x7fff), true);
    }
  }
  let binary = '';
  const view = new Uint8Array(bytes.buffer);
  for (let i = 0; i < view.length; i += 0x8000) {
    binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

window.startVideo = startVideo;
window.nextFrame = nextFrame;
window.renderAudio = renderAudio;
window.videoReport = videoReport;
