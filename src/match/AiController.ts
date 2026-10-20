import { Ball } from '@/match/Ball';
import { COURT } from '@/match/config';
import { AiSkill } from '@/match/difficulty';
import { Forecast, forecastArrival } from '@/match/forecast';
import { Paddle, PADDLE_SMOOTH_FACTOR } from '@/match/Paddle';
import { Physics } from '@/match/Physics';
import { clamp, lerp } from '@/shared/math';

const AIM_DEADZONE = 6; // px; closer than this the paddle holds still

// An angled return is hit this far off the paddle's center (share of its half-height):
// steep enough to matter, clear of the very edge so a small misjudgment doesn't whiff
const ANGLE_SHOT = { MIN: 0.55, MAX: 0.85 } as const;

// The longer the AI watches a shot, the better it sees where it is going, and a slow ball is far
// easier to follow than a fast one: its misjudgment fades out over WATCH_TO_CORRECT seconds of
// watching a ball at WATCH_REFERENCE_SPEED, proportionally longer for a faster ball. A slow
// ball is always read in time; a fast, steep one zigzags in before the AI can correct
const WATCH = {
  TO_CORRECT: 3,
  REFERENCE_SPEED: 340, // px/s, the serve
} as const;

// The AI's eyes, all scaled by the skill's nerves. It looks at the ball in glances rather than
// continuously; its first glance at a shot only half trusts the trajectory it works out (it
// leans toward where the ball is now), and every glance after trusts it more.
const GLANCE = { MIN: 0.18, MAX: 0.4 } as const; // s between glances
const FIRST_GLANCE_DOUBT = 0.45; // share of the first glance that still follows the ball itself
const TRUST_PER_GLANCE = 0.25;
// Now and then a glance makes it twitch: a quick jerk off its line and back. Never in the last
// moments before the ball arrives, so a twitch alone doesn't lose a point
const TWITCH = { CHANCE: 0.35, SIZE: 26, DURATION: 0.12, CALM_BEFORE: 0.35 } as const;
const IDLE_TWITCH_SIZE = 14; // smaller ones while it waits for the ball to come back

// Where the ball will arrive is flown ahead by the physics (curves included), not worked out
// along straight lines; it is flown again this often, or as soon as the shot changes
const FORECAST_REFRESH = 1 / 20; // s

// A perfect hit on purpose: the paddle winds up on one side of where the ball will arrive, then
// swings through it to meet it dead center at this speed, steering it hard the way it swings
const SWING = {
  TIME: 0.14, // s before the ball arrives that the swing starts
  SPEED: 420, // px/s, the paddle's speed through the ball, if the AI is that quick
  // It tries it only on a ball it is comfortable with, as a player would: no faster than this
  // (boosts included), off no more walls than this. A hard ball it just gets back
  MAX_BALL_SPEED: 750, // px/s
  MAX_BOUNCES: 1,
} as const;

// With Arc, its angled return is a curve: struck off the paddle's center on the move, toward the
// opponent, so the curve (against the swing) breaks it away from them. Off center rather than
// perfect: a perfect hit on the move steers so steeply the ball meets a wall, which takes the spin
const ARC_SHOT = { OFFSET: 0.4 } as const; // share of the half-height off center

/** How hard a shot is to read, on top of the AI's own skill. */
export interface ShotThreat {
  /** Seconds added to the reaction time. */
  extraReaction: number;
  /** Multiplies the misjudgment. */
  misjudgmentScale: number;
}

export const SHOT_THREAT = {
  NORMAL: { extraReaction: 0, misjudgmentScale: 1 },
  // A perfect hit comes off the paddle cleaner and faster than it looks
  PERFECT: { extraReaction: 0.08, misjudgmentScale: 1.5 },
  // An Overdrive power shot is a blur
  POWER: { extraReaction: 0.22, misjudgmentScale: 2.2 },
} as const satisfies Record<string, ShotThreat>;

/** Where a ball will cross a vertical line, and how many walls it bounces off on the way. */
export interface Arrival {
  y: number;
  bounces: number;
}

/**
 * Predicts where the ball crosses `x`, folding its straight-line path back off the top and
 * bottom walls the way Physics bounces it. A ball heading away from `x` "arrives" where it is.
 */
export function predictArrival(
  x: number,
  ballX: number,
  ballY: number,
  vx: number,
  vy: number,
  radius: number,
): Arrival {
  const time = vx === 0 ? 0 : (x - ballX) / vx;
  if (time <= 0) return { y: ballY, bounces: 0 };

  const top = COURT.TOP_WALL + radius;
  const span = COURT.HEIGHT - COURT.BOTTOM_WALL - radius - top;
  const travel = ballY - top + vy * time;
  const lap = Math.floor(travel / span);
  const within = travel - lap * span;

  return {
    y: top + (Math.abs(lap) % 2 === 0 ? within : span - within),
    bounces: Math.abs(lap),
  };
}

/** How a paddle reads the shot coming at it; rolled once per shot. */
interface ShotRead {
  /** Seconds before it reacts to the shot at all. */
  reactIn: number;
  /** How it misjudges the arrival, in [-0.5, 0.5] times the shot's threat; scaled by the skill and the walls ahead. */
  misjudgment: number;
  /** The misjudgment in px, fixed once it reads the shot; null until then. */
  misread: number | null;
  /** How long it has watched the shot, in seconds at WATCH.REFERENCE_SPEED. */
  watched: number;
  /**
   * How far it has seen a curving ball's curve for what it is, in [0, 1]: at 0 it expects the
   * ball to fly on straight, at 1 it knows where the curve takes it.
   */
  curveSeen: number;
  /** Planned return: where on the paddle to take the ball, in [-1, 1]; 0 = a flat return. */
  hitOffset: number;
  /** Whether it plays an angled return this time; the side is picked once it reads the shot. */
  wantsAngle: boolean;
  angleSize: number;
  /**
   * Whether it swings through the ball for a perfect hit this time, and which way (1 down, -1
   * up); picked once it reads the shot.
   */
  wantsPerfect: boolean;
  /** Whether it plays a curve this time (it has Arc), swinging `swing` toward the opponent. */
  wantsArc: boolean;
  swing: number;

  /** Where the physics says the ball arrives, how long ago that was flown, and for what flight. */
  forecast: Forecast | null;
  forecastAge: number;
  forecastVx: number;

  // Its eyes (see GLANCE): the arrival as last seen, and how much it trusts that sighting
  glanceIn: number;
  sighting: number | null;
  trust: number;
  twitch: number;
  twitchFor: number;
}

const freshRead = (): ShotRead => ({
  reactIn: 0,
  misjudgment: 0,
  misread: null,
  watched: 0,
  curveSeen: 0,
  hitOffset: 0,
  wantsAngle: false,
  angleSize: 0,
  wantsPerfect: false,
  wantsArc: false,
  swing: 1,
  forecast: null,
  forecastAge: 0,
  forecastVx: 0,
  glanceIn: 0,
  sighting: null,
  trust: 1,
  twitch: 0,
  twitchFor: 0,
});

/**
 * Steers the CPU paddles (and both paddles in the demo).
 *
 * The AI reads each shot the way a player does: after a reaction time it works out where the
 * ball will arrive, bounces off the walls included, and heads there. Its read is off by a
 * misjudgment that grows with every wall bounce it has to see through, so steep shots that
 * zigzag across the court are the ones it gets wrong — more often the lower the level. As it
 * keeps watching it corrects the misjudgment, quickly for a slow ball and slowly for a fast one,
 * so it loses points to fast steep shots, never by standing next to a slow ball. On
 * higher levels it also takes the ball off-center on purpose, to angle the return away from
 * the opponent.
 *
 * With nerves, it moves like someone watching the ball rather than a machine: it re-reads the
 * shot in glances, settling on the trajectory over the first few, and now and then twitches.
 */
export class AiController {
  /** How it reads the shot each ball is on, ball by ball, so a second ball can't upset the first. */
  private readonly reads = new Map<Ball, ShotRead>();
  /** A shot announced without its ball (a test's): the first ball it sees unread takes it. */
  private unclaimed: ShotRead | null = null;
  /** Its eyes while no ball is coming: the idle fidget. */
  private readonly idle = freshRead();
  /** Whether it is swinging through the ball (a perfect hit, a curve) this step. */
  private isSwinging = false;
  /** Whether its paddle has Arc: its angled returns are curves then. */
  public usesArc = false;
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  public update(paddle: Paddle, ball: Ball, skill: AiSkill, dt: number, opponent: Paddle): void {
    const desiredY = this.getDesiredY(paddle, ball, skill, dt, opponent);
    const deltaY = desiredY - paddle.targetY;
    // A quicker paddle carries the AI further in the same time, as it does a player
    const maxMovePerFrame = skill.speed * paddle.spec.speed * dt;

    const move =
      // A swing is smooth all the way: no holding still near the aim
      Math.abs(deltaY) > (this.isSwinging ? 0 : AIM_DEADZONE)
        ? clamp(deltaY, -maxMovePerFrame, maxMovePerFrame)
        : 0;
    paddle.setTargetY(paddle.targetY + move);
  }

  /**
   * A new shot is heading at `paddle` (the opponent hit it, or it was served):
   * rolls how this paddle will read it and whether it will angle the return.
   * @param threat how much harder than usual the shot is to read (a perfect hit, a power shot)
   * @param ball the ball the shot is on; the next one it sees unread when left out
   */
  public readShot(
    _paddle: Paddle,
    skill: AiSkill,
    threat: ShotThreat = SHOT_THREAT.NORMAL,
    ball: Ball | null = null,
  ): void {
    const read = freshRead();
    if (ball) this.reads.set(ball, read);
    else this.unclaimed = read;
    read.reactIn = skill.reaction + threat.extraReaction;
    read.misjudgment = (this.random() - 0.5) * threat.misjudgmentScale;
    read.misread = null;
    read.watched = 0;
    read.hitOffset = 0;
    // One roll picks the return: angled (the first angleShots of it), a perfect hit on purpose
    // (the next perfectAim), or flat. A level without perfect hits rolls as it always has
    const style = this.random();
    read.wantsAngle = style < skill.angleShots;
    read.wantsPerfect = !read.wantsAngle && style < skill.angleShots + skill.perfectAim;
    read.wantsArc = read.wantsAngle && this.usesArc;
    if (read.wantsArc) read.wantsAngle = false;
    read.angleSize = ANGLE_SHOT.MIN + this.random() * (ANGLE_SHOT.MAX - ANGLE_SHOT.MIN);
  }

  /**
   * Its implant has read the shot coming for it (Analyzer): it knows where every ball on its way
   * will arrive, its misjudgment gone.
   */
  public sharpen(): void {
    for (const read of this.reads.values()) {
      read.misjudgment = 0;
      read.misread = read.misread === null ? null : 0;
      read.trust = 1;
      read.curveSeen = 1;
    }
  }

  /** Forgets every read (a new match, or back to the menu). */
  public reset(): void {
    this.reads.clear();
    this.unclaimed = null;
    Object.assign(this.idle, freshRead());
  }

  /** How it reads `ball`'s shot: its own read, or the one announced without a ball. */
  private readFor(ball: Ball): ShotRead {
    let read = this.reads.get(ball);
    if (!read) {
      read = this.unclaimed ?? freshRead();
      this.unclaimed = null;
      this.reads.set(ball, read);
    }
    return read;
  }

  /**
   * Where the physics says `ball` crosses `faceX`, flown again when it is due or the shot has
   * changed (a hit turned it around); straight lines when the flight is too long to fly ahead.
   */
  private arrivalOf(read: ShotRead, ball: Ball, faceX: number, dt: number): Forecast {
    read.forecastAge += dt;
    if (
      read.forecast === null ||
      read.forecastAge >= FORECAST_REFRESH ||
      ball.vx !== read.forecastVx
    ) {
      const straight = predictArrival(faceX, ball.x, ball.y, ball.vx, ball.vy, ball.radius);
      const time = ball.vx === 0 ? 0 : (faceX - ball.x) / ball.vx;
      read.forecast = forecastArrival(ball, faceX) ?? { ...straight, time: Math.max(0, time) };
      read.forecastAge = 0;
      read.forecastVx = ball.vx;
    }
    return { ...read.forecast, time: Math.max(0, read.forecast.time - read.forecastAge) };
  }

  private getDesiredY(
    paddle: Paddle,
    ball: Ball,
    skill: AiSkill,
    dt: number,
    opponent: Paddle,
  ): number {
    this.isSwinging = false;
    const isMovingTowardPaddle = paddle.side === 1 ? ball.vx > 0 : ball.vx < 0;
    if (!isMovingTowardPaddle) {
      // Back to the middle, fidgeting a little while it waits
      const { idle } = this;
      if (skill.nerves > 0 && this.glance(idle, dt)) {
        this.maybeTwitch(idle, IDLE_TWITCH_SIZE * skill.nerves);
      }
      return COURT.HEIGHT / 2 + idle.twitch;
    }
    const read = this.readFor(ball);

    if (read.reactIn > 0) {
      read.reactIn -= dt;
      return paddle.targetY;
    }

    const faceX =
      paddle.side === 1 ? paddle.x - ball.radius : paddle.x + paddle.spec.width + ball.radius;
    const arrival = this.arrivalOf(read, ball, faceX, dt);

    // The shot is read once, as soon as the AI reacts: the more walls it has to bounce off from
    // there, the worse the read, and the AI sticks to it — a steep shot stays hard to judge
    if (read.misread === null) {
      read.misread = read.misjudgment * (skill.error + skill.errorPerBounce * arrival.bounces);
      const isComfortable =
        ball.speed * ball.speedMultiplier <= SWING.MAX_BALL_SPEED &&
        arrival.bounces <= SWING.MAX_BOUNCES;
      if (!isComfortable) read.wantsPerfect = false;
      // A curve it can't swing at is an angled return after all
      if (read.wantsArc && !isComfortable) [read.wantsArc, read.wantsAngle] = [false, true];
      if (read.wantsAngle) {
        read.hitOffset = this.pickAngle(paddle, opponent, arrival.y, read.angleSize);
      }
      // A perfect hit swings toward the half of the court the opponent isn't in; a curve toward
      // the one they are in, and breaks away from them
      const away = opponent.y < COURT.HEIGHT / 2 ? 1 : -1;
      read.swing = read.wantsArc ? -away : away;
      if (read.wantsArc) read.hitOffset = read.swing * ARC_SHOT.OFFSET;
    }

    const timeLeft = arrival.time;
    // Watching the ball, the AI sees its mistake and corrects it, sooner the slower the ball
    const correction = clamp(1 - read.watched / WATCH.TO_CORRECT, 0, 1);
    const apparentSpeed = ball.speed * ball.speedMultiplier; // boosts included
    const watching = (dt * WATCH.REFERENCE_SPEED) / Math.max(apparentSpeed, WATCH.REFERENCE_SPEED);
    read.watched += watching;

    // A curving ball (Arc) is expected to fly on straight at first; the curve shows itself as the
    // AI keeps watching, the sooner the better it plays
    let arrivalY = arrival.y;
    if (ball.spin !== 0 && read.curveSeen < 1) {
      read.curveSeen =
        skill.curveRead > 0 ? Math.min(1, read.curveSeen + watching / skill.curveRead) : 1;
      const straight = predictArrival(faceX, ball.x, ball.y, ball.vx, ball.vy, ball.radius).y;
      arrivalY = lerp(straight, arrival.y, read.curveSeen);
    }
    const seenY = this.see(read, ball, arrivalY, timeLeft, skill.nerves, dt);

    // The ball meets the paddle `hitOffset` half-heights below its center
    const meetY = seenY + read.misread * correction - (read.hitOffset * paddle.spec.height) / 2;
    return read.wantsPerfect || read.wantsArc
      ? this.swingThrough(paddle, skill, meetY, read.swing, timeLeft)
      : meetY;
  }

  /**
   * Where to aim the paddle to swing through `meetY` at the moment the ball gets there: wound up
   * on the far side of it until the swing starts, then moving through it at the swing's speed.
   * The paddle trails its aim by its speed over its smoothing, so the aim leads by that much and
   * the center meets the ball.
   * @param direction which way it swings: 1 down, -1 up
   */
  private swingThrough(
    paddle: Paddle,
    skill: AiSkill,
    meetY: number,
    direction: number,
    timeLeft: number,
  ): number {
    this.isSwinging = timeLeft <= SWING.TIME;
    const speed = Math.min(SWING.SPEED, skill.speed * paddle.spec.speed);
    const lag = speed / (PADDLE_SMOOTH_FACTOR * paddle.spec.speed);
    return meetY + direction * (lag - speed * Math.min(timeLeft, SWING.TIME));
  }

  /**
   * Where the AI believes the ball will arrive, as its eyes would have it: re-read in glances,
   * trusting the trajectory more with each one, plus the odd twitch. Without nerves it simply
   * knows `arrivalY`.
   */
  private see(
    read: ShotRead,
    ball: Ball,
    arrivalY: number,
    timeLeft: number,
    nerves: number,
    dt: number,
  ): number {
    if (nerves <= 0) return arrivalY;

    if (this.glance(read, dt) || read.sighting === null) {
      read.trust =
        read.sighting === null
          ? 1 - FIRST_GLANCE_DOUBT * nerves
          : Math.min(1, read.trust + TRUST_PER_GLANCE);
      read.sighting = lerp(ball.y, arrivalY, read.trust);

      if (timeLeft > TWITCH.CALM_BEFORE) {
        this.maybeTwitch(read, TWITCH.SIZE * nerves);
      }
    }

    // Once it fully trusts the trajectory it follows it, rather than its last sighting
    const seen = read.trust >= 1 ? arrivalY : read.sighting;
    return timeLeft > TWITCH.CALM_BEFORE ? seen + read.twitch : seen;
  }

  /** Advances the eyes' clock. @returns whether it is time for another glance */
  private glance(read: ShotRead, dt: number): boolean {
    read.twitchFor -= dt;
    if (read.twitchFor <= 0) read.twitch = 0;

    read.glanceIn -= dt;
    if (read.glanceIn > 0) return false;
    read.glanceIn = GLANCE.MIN + this.random() * (GLANCE.MAX - GLANCE.MIN);
    return true;
  }

  private maybeTwitch(read: ShotRead, size: number): void {
    if (this.random() >= TWITCH.CHANCE) return;
    read.twitch = (this.random() * 2 - 1) * size;
    read.twitchFor = TWITCH.DURATION;
  }

  /**
   * Of the two angled returns, the one that lands farther from where the opponent stands.
   * @returns the hit offset to play, signed
   */
  private pickAngle(paddle: Paddle, opponent: Paddle, contactY: number, size: number): number {
    const direction = paddle.side === 0 ? 1 : -1;
    const opponentFaceX = paddle.side === 0 ? opponent.x : opponent.x + opponent.spec.width;
    const landing = (offset: number) => {
      const angle = Physics.getBounceAngle(offset);
      return predictArrival(
        opponentFaceX,
        paddle.x,
        contactY,
        direction * Math.cos(angle),
        Math.sin(angle),
        0,
      ).y;
    };

    return Math.abs(landing(size) - opponent.y) >= Math.abs(landing(-size) - opponent.y)
      ? size
      : -size;
  }
}
