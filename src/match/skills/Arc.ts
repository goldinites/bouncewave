import { COURT, PADDLE } from '@/match/config';
import { clamp } from '@/shared/math';
import { Skill, SkillHit, SkillHost } from '@/match/skills/Skill';

// Arc: a hit with the paddle on the move puts spin on the ball, which bends its flight back
// against the paddle's motion, so a shot sent wide curves back into the court. The spin is set
// by how far the curve takes the ball across the court, whatever its speed: a fast ball spins
// harder, so a curve reads the same early in a rally and late
export const ARC = {
  THRESHOLD: 200, // px/s of paddle speed below which a hit puts no spin on (small adjustments)
  REFERENCE_SPEED: 200, // px/s above the threshold where the spin reaches ~76% of its max; the
  // keyboard's 500 px/s gets ~85%
  // px the ball lands off the straight line from one paddle to the other, at most. A playtest
  // value (decided with the user): a perfect hit may bend it up to half the court's height
  MAX_BEND: 133,
  // A perfect hit on the move bends it this many times as far; not twice, as planned, which
  // would take it past half the court
  PERFECT_FACTOR: 1.65,
  // 1/s; the spin fades over the flight, slowly enough that the whole flight curves rather than
  // its start alone, which reads as a straight shot at another angle
  DECAY: 0.6,
  // A late break: a hard spin on a fast ball flies on straight for a share of its flight, then
  // breaks, as far as any other but later and sharper. It is not a bigger bend (that would win
  // the point on its own); its spin shows from the start, so it can still be read
  LATE_BREAK: {
    FROM_SPEED: 600, // px/s of ball speed where it begins...
    FULL_SPEED: 900, // ...and where it is full
    FROM_SPIN: 0.6, // share of the spin's max where it begins...
    FULL_SPIN: 0.9, // ...and where it is full
    // Of the flight, at most, flown straight; more would turn the ball past the steepest angle
    MAX_SHARE: 0.25,
  },
} as const;

/** px from one paddle's face to the other's, the flight a bend is measured over. */
const FLIGHT = COURT.WIDTH - 2 * (PADDLE.OFFSET_X + PADDLE.WIDTH);

/** Mastery 1 (docs/PROGRESSION.md): spin becomes a path. */
export class Arc implements Skill {
  public readonly id = 'arc';
  private readonly host: SkillHost;

  constructor(host: SkillHost) {
    this.host = host;
  }

  /**
   * The spin, in rad/s, that bends a ball flying at `speed` MAX_BEND off its straight line over
   * the flight. A turn of ω fading at k bends it about v·ω/k·(T − (1 − e^(−kT))/k) in time T;
   * a turned ball crosses the court slower, though, and bends further, so that first guess is
   * corrected against the flight itself.
   * @param lateShare the share of the flight it flies straight first (a late break), which
   *   leaves less time to bend in
   */
  public static fullSpin(speed: number, lateShare = 0): number {
    const k = ARC.DECAY;
    const time = (FLIGHT / speed) * (1 - lateShare);
    let spin = ARC.MAX_BEND / ((speed / k) * (time - (1 - Math.exp(-k * time)) / k));
    for (let i = 0; i < 2; i++) spin *= ARC.MAX_BEND / Arc.bend(spin, speed, lateShare);
    return spin;
  }

  /** How far a flat flight across the court at `speed`, turned by `spin`, ends off its line. */
  private static bend(spin: number, speed: number, lateShare: number): number {
    const straight = FLIGHT * lateShare;
    const steps = 48;
    const dt = (FLIGHT - straight) / speed / steps;
    let x = straight;
    let y = 0;
    let angle = 0;
    let turn = spin;
    while (x < FLIGHT) {
      angle += turn * dt;
      turn *= Math.exp(-ARC.DECAY * dt);
      x += speed * Math.cos(angle) * dt;
      y += speed * Math.sin(angle) * dt;
    }
    return Math.abs(y);
  }

  /** How much of the spin's max a paddle moving at `paddleVelocity` puts on, in [0, 1). */
  private static spinShare(paddleVelocity: number): number {
    const over = Math.abs(paddleVelocity) - ARC.THRESHOLD;
    return over <= 0 ? 0 : Math.tanh(over / ARC.REFERENCE_SPEED);
  }

  /**
   * The share of its flight a ball at `speed` hit by a paddle moving at `paddleVelocity` flies
   * straight before it breaks: none unless the spin is hard and the ball fast.
   */
  public static lateShare(paddleVelocity: number, speed: number): number {
    const { FROM_SPEED, FULL_SPEED, FROM_SPIN, FULL_SPIN, MAX_SHARE } = ARC.LATE_BREAK;
    const fast = clamp((speed - FROM_SPEED) / (FULL_SPEED - FROM_SPEED), 0, 1);
    const hard = clamp((Arc.spinShare(paddleVelocity) - FROM_SPIN) / (FULL_SPIN - FROM_SPIN), 0, 1);
    return MAX_SHARE * fast * hard;
  }

  /**
   * The spin a hit by a paddle moving at `paddleVelocity` puts on a ball leaving at `vx` (its
   * speed `speed`), in rad/s: it turns the flight against the paddle's motion (a paddle moving
   * down sends the ball down, and the spin brings it back up).
   */
  public static spinFor(
    paddleVelocity: number,
    vx: number,
    speed: number,
    isPerfect: boolean,
    lateShare = 0,
  ): number {
    const share = Arc.spinShare(paddleVelocity);
    if (share === 0) return 0;
    const size = share * Arc.fullSpin(speed, lateShare) * (isPerfect ? ARC.PERFECT_FACTOR : 1);
    return -Math.sign(paddleVelocity) * Math.sign(vx) * size;
  }

  public afterHit({ paddleIndex, ball, isPerfect }: SkillHit): void {
    if (paddleIndex !== this.host.owner) return;
    const speed = ball.speed * ball.speedMultiplier;
    const { velocity } = this.host.paddles[paddleIndex];
    const late = Arc.lateShare(velocity, speed);
    const spin = Arc.spinFor(velocity, ball.vx, speed, isPerfect, late);
    if (spin === 0) return;

    ball.spin = spin;
    ball.spinDecay = ARC.DECAY;
    ball.spinDelay = (late * FLIGHT) / speed;
    this.host.report({
      skill: this.id,
      x: ball.x,
      y: ball.y,
      strength: Math.abs(spin) / (Arc.fullSpin(speed, late) * ARC.PERFECT_FACTOR),
    });
  }
}
