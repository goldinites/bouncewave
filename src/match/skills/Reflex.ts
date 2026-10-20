import { Ball } from '@/match/Ball';
import { PADDLE } from '@/match/config';
import { forecastArrival } from '@/match/forecast';
import { Skill, SkillHit, SkillHost } from '@/match/skills/Skill';

// Reflex: when the ball is about to get past, the world slows down for everyone but its owner
export const REFLEX = {
  COST: 1, // charges of the meter; it may spend them from a full one
  SLOW: 0.4, // how fast the balls and the opponent move while it lasts
  MAX_DURATION: 0.6, // s of the owner's time
  // s of the ball's time before it arrives when the owner's chances are judged: late enough that
  // a person who has seen the ball has started moving, early enough to save it
  LEAD: 0.3,
  ZONE_BOOST: 1.5, // the saved ball's return: the perfect zone this many times wider
} as const;

/** The ball being saved, and for how long it has been (the world is slowed for MAX_DURATION). */
interface Save {
  ball: Ball;
  elapsed: number;
}

/**
 * Implant 2 (docs/PROGRESSION.md): the world freezes, and you don't. Once a rally, when a ball
 * is about to get past its owner, who at their own speed won't make it to where the physics says
 * it arrives but with the world slowed would: the balls and the other side slow down until the
 * ball gets there (MAX_DURATION at most), the owner's paddle moves at full speed, and its
 * return has a wider perfect zone. A person's own speed is the keyboard's, or the paddle's when it is already closing in
 * faster, so the rule is the same with keys, a mouse or a finger.
 */
export class Reflex implements Skill {
  public readonly id = 'reflex';
  private readonly host: SkillHost;
  private save: Save | null = null;
  private isUsed = false;
  /** Balls whose shot at the owner has been judged; a hit sends a ball off on a new one. */
  private readonly judged = new Set<Ball>();

  constructor(host: SkillHost) {
    this.host = host;
  }

  private get paddle() {
    return this.host.paddles[this.host.owner];
  }

  /** Whether `ball` is flying at the owner's goal. */
  private isComing(ball: Ball): boolean {
    return this.paddle.side === 0 ? ball.vx < 0 : ball.vx > 0;
  }

  public beforeStep(dt: number): void {
    if (this.save) {
      // The wider perfect zone waits for the ball even once the world is back to speed
      this.save.elapsed += dt;
      if (!this.isComing(this.save.ball)) this.stop();
      return;
    }

    const meter = this.host.meter();
    if (this.isUsed || !meter || meter.charge < REFLEX.COST) return;
    for (const ball of this.host.balls) {
      if (this.isComing(ball) && !this.judged.has(ball) && this.judge(ball)) {
        meter.spend(REFLEX.COST);
        this.isUsed = true;
        this.save = { ball, elapsed: 0 };
        this.paddle.perfectZoneScale = REFLEX.ZONE_BOOST;
        const { x, y, spec } = this.paddle;
        this.host.report({ skill: this.id, x: x + spec.width / 2, y, strength: 1 });
        return;
      }
    }
  }

  /**
   * Once a ball is LEAD from arriving: whether the owner would miss it at their own speed and
   * reach it with the world slowed. @returns whether to slow it down
   */
  private judge(ball: Ball): boolean {
    const paddle = this.paddle;
    const faceX =
      paddle.side === 0 ? paddle.x + paddle.spec.width + ball.radius : paddle.x - ball.radius;
    // Too far off to be worth flying ahead yet
    if (Math.abs(faceX - ball.x) > Math.abs(ball.vx * ball.speedMultiplier) * REFLEX.LEAD * 2) {
      return false;
    }
    const arrival = forecastArrival(ball, faceX, this.host.physics());
    if (!arrival || arrival.time > REFLEX.LEAD) return false;
    this.judged.add(ball);

    // How far the paddle still has to go to cover it (as Physics measures a hit)
    const offset = arrival.y - paddle.y;
    const gap = Math.abs(offset) - (paddle.spec.height / 2 + ball.radius * 0.8);
    if (gap <= 0) return false;

    const closing =
      Math.sign(paddle.velocity) === Math.sign(offset) ? Math.abs(paddle.velocity) : 0;
    const speed = Math.max(PADDLE.KEYBOARD_SPEED * paddle.spec.speed, closing);
    if (speed * arrival.time >= gap) return false;

    // The owner's time until the ball arrives with the world slowed for as long as it may be
    const slowedTravel = REFLEX.SLOW * REFLEX.MAX_DURATION;
    const ownTime =
      arrival.time <= slowedTravel
        ? arrival.time / REFLEX.SLOW
        : REFLEX.MAX_DURATION + (arrival.time - slowedTravel);
    return speed * ownTime >= gap;
  }

  public afterHit({ ball }: SkillHit): void {
    this.judged.delete(ball);
    if (this.save?.ball === ball) this.stop();
  }

  public timeScale(target: number | 'balls'): number {
    if (!this.save || this.save.elapsed >= REFLEX.MAX_DURATION) return 1;
    if (target === 'balls') return REFLEX.SLOW;
    return this.host.paddles[target].side === this.paddle.side ? 1 : REFLEX.SLOW;
  }

  public onServe(): void {
    this.stop();
    this.isUsed = false;
    this.judged.clear();
  }

  private stop(): void {
    this.save = null;
    this.paddle.perfectZoneScale = 1;
  }
}
