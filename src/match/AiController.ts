import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { AiSkill } from '@/match/difficulty';
import { Paddle } from '@/match/Paddle';
import { Physics } from '@/match/Physics';
import { clamp, lerp } from '@/shared/math';

const AIM_DEADZONE = 6; // px; closer than this the paddle holds still

// An angled return is hit this far off the paddle's center (share of its half-height):
// steep enough to matter, clear of the very edge so a small misjudgment doesn't whiff
const ANGLE_SHOT = { MIN: 0.55, MAX: 0.85 } as const;

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
  /** How it misjudges the arrival, in [-0.5, 0.5]; scaled by the skill and the walls ahead. */
  misjudgment: number;
  /** The misjudgment in px, fixed once it reads the shot; null until then. */
  misread: number | null;
  /** Planned return: where on the paddle to take the ball, in [-1, 1]; 0 = a flat return. */
  hitOffset: number;
  /** Whether it plays an angled return this time; the side is picked once it reads the shot. */
  wantsAngle: boolean;
  angleSize: number;

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
  hitOffset: 0,
  wantsAngle: false,
  angleSize: 0,
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
 * zigzag across the court are the ones it gets wrong — more often the lower the level. On
 * higher levels it also takes the ball off-center on purpose, to angle the return away from
 * the opponent.
 *
 * With nerves, it moves like someone watching the ball rather than a machine: it re-reads the
 * shot in glances, settling on the trajectory over the first few, and now and then twitches.
 */
export class AiController {
  private readonly reads: [ShotRead, ShotRead] = [freshRead(), freshRead()];
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  public update(paddle: Paddle, ball: Ball, skill: AiSkill, dt: number, opponent: Paddle): void {
    const desiredY = this.getDesiredY(paddle, ball, skill, dt, opponent);
    const deltaY = desiredY - paddle.targetY;
    const maxMovePerFrame = skill.speed * dt;

    const move =
      Math.abs(deltaY) > AIM_DEADZONE ? clamp(deltaY, -maxMovePerFrame, maxMovePerFrame) : 0;
    paddle.setTargetY(paddle.targetY + move);
  }

  /**
   * A new shot is heading at `paddle` (the opponent hit it, or it was served):
   * rolls how this paddle will read it and whether it will angle the return.
   */
  public readShot(paddle: Paddle, skill: AiSkill): void {
    const read = this.reads[paddle.index];
    read.reactIn = skill.reaction;
    read.misjudgment = this.random() - 0.5;
    read.misread = null;
    read.hitOffset = 0;
    read.wantsAngle = this.random() < skill.angleShots;
    read.angleSize = ANGLE_SHOT.MIN + this.random() * (ANGLE_SHOT.MAX - ANGLE_SHOT.MIN);
    read.sighting = null;
    read.glanceIn = 0;
  }

  /** Forgets every read (a new match, or back to the menu). */
  public reset(): void {
    this.reads[0] = freshRead();
    this.reads[1] = freshRead();
  }

  private getDesiredY(
    paddle: Paddle,
    ball: Ball,
    skill: AiSkill,
    dt: number,
    opponent: Paddle,
  ): number {
    const read = this.reads[paddle.index];
    const isMovingTowardPaddle = paddle.index === 1 ? ball.vx > 0 : ball.vx < 0;
    if (!isMovingTowardPaddle) {
      // Back to the middle, fidgeting a little while it waits
      if (skill.nerves > 0 && this.glance(read, dt)) {
        this.maybeTwitch(read, IDLE_TWITCH_SIZE * skill.nerves);
      }
      return COURT.HEIGHT / 2 + read.twitch;
    }

    if (read.reactIn > 0) {
      read.reactIn -= dt;
      return paddle.targetY;
    }

    const faceX =
      paddle.index === 1 ? paddle.x - ball.radius : paddle.x + PADDLE.WIDTH + ball.radius;
    const arrival = predictArrival(faceX, ball.x, ball.y, ball.vx, ball.vy, ball.radius);

    // The shot is read once, as soon as the AI reacts: the more walls it has to bounce off from
    // there, the worse the read, and the AI sticks to it — a steep shot stays hard to judge
    if (read.misread === null) {
      read.misread = read.misjudgment * (skill.error + skill.errorPerBounce * arrival.bounces);
      if (read.wantsAngle) {
        read.hitOffset = this.pickAngle(paddle, opponent, arrival.y, read.angleSize);
      }
    }

    const timeLeft = (faceX - ball.x) / ball.vx;
    const seenY = this.see(read, ball, arrival.y, timeLeft, skill.nerves, dt);

    // The ball meets the paddle `hitOffset` half-heights below its center
    return seenY + read.misread - (read.hitOffset * PADDLE.HEIGHT) / 2;
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
    const direction = paddle.index === 0 ? 1 : -1;
    const opponentFaceX = paddle.index === 0 ? opponent.x : opponent.x + PADDLE.WIDTH;
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
