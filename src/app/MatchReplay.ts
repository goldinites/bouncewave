import type { AudioEngine } from '@/audio/AudioEngine';
import { EffectsDirector } from '@/fx/EffectsDirector';
import { ParticleSystem } from '@/fx/ParticleSystem';
import { Ball, Point } from '@/match/Ball';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';
import { Renderer } from '@/render/Renderer';
import { RenderFrame } from '@/render/scene';
import { lerp } from '@/shared/math';

/**
 * The replay (ROADMAP 6.4): the point that won the match, if it was worth seeing again, shown
 * slowed before the finale. The last BEFORE s of it and AFTER s on, at SPEED (≈ 4 s), after a BEAT
 * s of the goal played live; any press skips it. Worth it: a rally of MIN_RALLY hits or more, or
 * one won off a perfect hit or a power shot.
 */
const REPLAY = {
  BEFORE: 1.2, // s
  AFTER: 0.25, // s
  SPEED: 0.35,
  BEAT: 0.5, // s
  KEEP: 2, // s of play kept, a little more than BEFORE
  MIN_RALLY: 6,
  ZOOM: 1.3, // the camera on the ball
  VIGNETTE: 0.5,
} as const;

/** A ball as it was drawn at one moment. */
interface BallShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Its flight's speed, its boost included. */
  speed: number;
  radius: number;
  isPowerShot: boolean;
  trail: Point[];
}

/** The court as it was drawn at one moment of match time. */
interface Snapshot {
  time: number;
  balls: BallShot[];
  /** Each paddle's height on the court, px. */
  paddles: number[];
  rally: number;
}

export interface MatchReplayDeps {
  renderer: Renderer;
  /** The match's paddles: a replay plays on copies of them. */
  paddles: () => readonly Paddle[];
  /** The match's clock, s. */
  time: () => number;
  /** Whether a won point may be replayed at all: not in the classic look, nor the tutorial. */
  isEnabled: () => boolean;
  /** REPLAY, in the player's language. */
  label: () => string;
}

/** Audio that answers every call with silence: a replay is seen again, not heard again. */
const SILENCE: object = new Proxy(() => undefined, {
  get: (_target, key) => (key === 'then' ? undefined : SILENCE),
  apply: () => undefined,
});

/**
 * Keeps the last seconds of every point as they were drawn, and when a point wins the match and is
 * worth it, holds the finale back to show them again slowed: the camera on the ball, cinema bars,
 * the hits' effects played anew (silent) on a court of their own. The match itself waits, held at
 * its finale's start; the finale goes on once the replay is over or skipped. Presentation only:
 * nothing it does reaches the match.
 */
export class MatchReplay {
  private readonly deps: MatchReplayDeps;
  private snapshots: Snapshot[] = [];
  /** The point's hits, bounces and goal, with the match time each happened at. */
  private moments: { time: number; event: MatchEvent }[] = [];
  /** The finale's start, held back while the replay plays, and who it goes to then. */
  private held: { event: MatchEvent; publish: (event: MatchEvent) => void } | null = null;
  private beat = 0;
  /** The match time being shown, while it is. */
  private clock = 0;
  private endTime = 0;
  private next = 0;
  private isShown = false;
  private readonly particles = new ParticleSystem();
  private effects: EffectsDirector | null = null;
  private balls: Ball[] = [];
  private paddles: Paddle[] = [];
  private rally = 0;

  constructor(deps: MatchReplayDeps) {
    this.deps = deps;
  }

  /** Whether the match is held for a replay: its goal's beat, or the replay itself. */
  public get isHolding(): boolean {
    return this.held !== null;
  }

  /** Whether the replay is on screen instead of the match. */
  public get isShowing(): boolean {
    return this.isShown;
  }

  /** Keeps the court as the frame just drew it, while a point is played. */
  public record(flow: MatchFlow): void {
    if (this.held || flow.isDemo || flow.phase !== 'rally') return;
    const time = flow.time;
    this.snapshots.push({
      time,
      balls: flow.balls.map((ball) => ({
        x: ball.drawX,
        y: ball.drawY,
        vx: ball.vx,
        vy: ball.vy,
        speed: ball.speed * ball.speedMultiplier,
        radius: ball.radius,
        isPowerShot: ball.isPowerShot,
        trail: ball.trail.map((point) => ({ ...point })),
      })),
      paddles: this.deps.paddles().map((paddle) => paddle.drawY),
      rally: flow.rally,
    });
    while (this.snapshots.length > 0 && this.snapshots[0].time < time - REPLAY.KEEP) {
      this.snapshots.shift();
    }
  }

  /**
   * Passes on what the match reports to `publish`, keeping what a replay needs; the finale's start
   * is held back while a replay of the point that won it plays.
   */
  public route(event: MatchEvent, publish: (event: MatchEvent) => void): void {
    switch (event.type) {
      case 'serve':
      case 'matchStart':
      case 'returnToMenu':
        this.forget();
        break;
      case 'paddleHit':
      case 'wallBounce':
      case 'score':
        this.moments.push({ time: this.deps.time(), event });
        break;
      case 'finaleStart':
        if (this.isWorthIt()) {
          this.held = { event, publish };
          this.endTime = this.deps.time();
          this.beat = REPLAY.BEAT;
          return;
        }
        break;
    }
    publish(event);
  }

  /** Moves the replay on by `realDt` wall-clock seconds; the finale goes on once it is over. */
  public update(realDt: number): void {
    if (!this.held) return;
    if (this.beat > 0) {
      this.beat -= realDt;
      if (this.beat <= 0) this.start();
      return;
    }
    const dt = realDt * REPLAY.SPEED;
    this.clock += dt;
    this.place();
    this.effects!.animate(dt, this.balls, this.rally);
    while (this.next < this.moments.length && this.moments[this.next].time <= this.clock) {
      this.effects!.handle(this.moments[this.next].event);
      this.next++;
    }
    this.particles.update(dt);
    if (this.clock >= this.endTime + REPLAY.AFTER) this.finish();
  }

  /**
   * Skips straight to the finale.
   * @returns whether there was a replay to skip
   */
  public skip(): boolean {
    if (!this.held) return false;
    this.finish();
    return true;
  }

  /**
   * The match's frame while it is held: through the goal's beat, with the ball that went in gone
   * rather than frozen past the goal line; then with the replay in its place: its court, effects,
   * camera and bars.
   */
  public frame(live: RenderFrame): RenderFrame {
    const effects = this.effects;
    if (!this.isShown || !effects) return { ...live, court: { ...live.court, balls: [] } };
    return {
      ...live,
      court: {
        ...live.court,
        gameState: 'play',
        paddles: this.paddles,
        balls: this.balls,
        ball: this.balls[0] ?? live.court.ball,
        time: this.clock,
        serveTime: 0,
        rally: this.rally,
        timeWarp: null,
        shotReads: [],
      },
      hud: {
        ...live.hud,
        readyText: '',
        condition: null,
        overtimeText: null,
        perfectZoneMark: null,
        overdriveCharges: live.hud.overdriveCharges.map(() => null),
        overdriveStreaks: live.hud.overdriveStreaks.map(() => null),
      },
      drama: {
        climax: live.drama.climax,
        vignette: REPLAY.VIGNETTE,
        zoom: REPLAY.ZOOM,
        paddleGlow: effects.paddleGlow,
        paddleTilt: effects.paddleTilt,
        meterSpent: effects.meterSpent,
        paddleRecoil: effects.paddleRecoil,
        ballSquash: effects.ballSquash,
        ballWhiteHot: effects.ballWhiteHot,
        paddleOut: effects.paddleOut,
      },
      particles: this.particles,
      replay: { label: this.deps.label() },
    };
  }

  /** Whether the point just won is worth seeing again: a long rally, or a strong last hit. */
  private isWorthIt(): boolean {
    if (!this.deps.isEnabled() || this.snapshots.length < 2) return false;
    // Only a match won by a goal: one ended on time, or by a challenge's rally goal, has none
    if (this.moments.at(-1)?.event.type !== 'score') return false;
    const hits = this.moments.filter(({ event }) => event.type === 'paddleHit');
    const last = hits.at(-1)?.event;
    if (!last || last.type !== 'paddleHit') return false;
    return last.rally >= REPLAY.MIN_RALLY || last.isPerfect || last.isPowerShot;
  }

  /** The beat is over: the replay starts BEFORE s ahead of the goal, on a court of its own. */
  private start(): void {
    this.isShown = true;
    this.clock = Math.max(this.snapshots[0].time, this.endTime - REPLAY.BEFORE);
    this.next = this.moments.findIndex(({ time }) => time > this.clock);
    if (this.next < 0) this.next = this.moments.length;
    this.paddles = this.deps
      .paddles()
      .map((paddle) => new Paddle(paddle.side, paddle.x, paddle.color, paddle.spec));
    this.particles.clear();
    this.effects = new EffectsDirector({
      renderer: this.deps.renderer,
      audio: SILENCE as AudioEngine,
      particles: this.particles,
      paddles: this.paddles,
      translate: () => '',
    });
    this.place();
  }

  /** Puts the replay's balls and paddles where they were drawn at its clock, between two frames. */
  private place(): void {
    const after = this.snapshots.findIndex(({ time }) => time > this.clock);
    const to = this.snapshots[after < 0 ? this.snapshots.length - 1 : after];
    const from = this.snapshots[Math.max(0, (after < 0 ? this.snapshots.length : after) - 1)];
    const span = to.time - from.time;
    const t = span > 0 ? Math.min(1, Math.max(0, (this.clock - from.time) / span)) : 1;
    this.rally = from.rally;

    this.balls.length = from.balls.length;
    from.balls.forEach((shot, i) => {
      const next = to.balls[i] ?? shot;
      const ball = (this.balls[i] ??= new Ball());
      ball.x = ball.drawX = lerp(shot.x, next.x, t);
      ball.y = ball.drawY = lerp(shot.y, next.y, t);
      ball.vx = next.vx;
      ball.vy = next.vy;
      ball.speed = next.speed;
      ball.radius = next.radius;
      ball.isPowerShot = next.isPowerShot;
      ball.trail = t < 0.5 ? shot.trail : next.trail;
    });
    this.paddles.forEach((paddle, i) => {
      const y = lerp(from.paddles[i] ?? paddle.y, to.paddles[i] ?? paddle.y, t);
      paddle.y = paddle.drawY = paddle.targetY = y;
    });
  }

  /** The replay is over: the finale it held back goes on. */
  private finish(): void {
    const held = this.held;
    this.forget();
    held?.publish(held.event);
  }

  private forget(): void {
    this.held = null;
    this.isShown = false;
    this.effects = null;
    this.snapshots = [];
    this.moments = [];
    this.particles.clear();
  }
}
