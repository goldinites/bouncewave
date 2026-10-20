import { COURT, PADDLE } from '@/match/config';
import { Skill, SkillHit, SkillHost } from '@/match/skills/Skill';

// Arc: a hit with the paddle on the move puts spin on the ball, which bends its flight back
// against the paddle's motion, so a shot sent wide curves back into the court. The spin is set
// by how far the curve takes the ball across the court, whatever its speed: a fast ball spins
// harder, so a curve reads the same early in a rally and late
export const ARC = {
  THRESHOLD: 200, // px/s of paddle speed below which a hit puts no spin on (small adjustments)
  REFERENCE_SPEED: 200, // px/s above the threshold where the spin reaches ~76% of its max; the
  // keyboard's 500 px/s gets ~85%
  MAX_BEND: 75, // px the ball lands off the straight line from one paddle to the other, at most
  PERFECT_FACTOR: 2, // a perfect hit on the move bends it this many times as far: under a third
  // of the court's height
  DECAY: 1.5, // 1/s; the spin fades over the flight
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
   * the flight: a turn of ω fading at k bends it v·ω/k·(T − (1 − e^(−kT))/k) in time T.
   */
  public static fullSpin(speed: number): number {
    const k = ARC.DECAY;
    const time = FLIGHT / speed;
    return ARC.MAX_BEND / ((speed / k) * (time - (1 - Math.exp(-k * time)) / k));
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
  ): number {
    const over = Math.abs(paddleVelocity) - ARC.THRESHOLD;
    if (over <= 0) return 0;
    const size =
      Math.tanh(over / ARC.REFERENCE_SPEED) *
      Arc.fullSpin(speed) *
      (isPerfect ? ARC.PERFECT_FACTOR : 1);
    return -Math.sign(paddleVelocity) * Math.sign(vx) * size;
  }

  public afterHit({ paddleIndex, ball, isPerfect }: SkillHit): void {
    if (paddleIndex !== this.host.owner) return;
    const speed = ball.speed * ball.speedMultiplier;
    const spin = Arc.spinFor(this.host.paddles[paddleIndex].velocity, ball.vx, speed, isPerfect);
    if (spin === 0) return;

    ball.spin = spin;
    ball.spinDecay = ARC.DECAY;
    this.host.report({
      skill: this.id,
      x: ball.x,
      y: ball.y,
      strength: Math.abs(spin) / (Arc.fullSpin(speed) * ARC.PERFECT_FACTOR),
    });
  }
}
