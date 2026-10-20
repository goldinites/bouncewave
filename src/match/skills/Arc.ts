import { Skill, SkillHit, SkillHost } from '@/match/skills/Skill';

// Arc: a hit with the paddle on the move puts spin on the ball, which bends its flight back
// against the paddle's motion, so a shot sent wide curves back into the court
export const ARC = {
  THRESHOLD: 350, // px/s of paddle speed below which a hit puts no spin on (tracking the ball)
  REFERENCE_SPEED: 400, // px/s above the threshold where the spin reaches ~76% of its max
  MAX_SPIN: 0.26, // rad/s the flight turns at first, at most
  PERFECT_FACTOR: 2, // a perfect hit on the move spins it this many times harder
  // 1/s; the spin fades over the flight. With MAX_SPIN, a perfect hit at serve speed lands no
  // more than a third of the court's height from where a straight shot would
  DECAY: 1.5,
} as const;

/** Mastery 1 (docs/PROGRESSION.md): spin becomes a path. */
export class Arc implements Skill {
  public readonly id = 'arc';
  private readonly host: SkillHost;

  constructor(host: SkillHost) {
    this.host = host;
  }

  /**
   * The spin a hit by a paddle moving at `paddleVelocity` puts on a ball leaving at `vx`, in
   * rad/s: it turns the flight against the paddle's motion (a paddle moving down sends the ball
   * down, and the spin brings it back up).
   */
  public static spinFor(paddleVelocity: number, vx: number, isPerfect: boolean): number {
    const over = Math.abs(paddleVelocity) - ARC.THRESHOLD;
    if (over <= 0) return 0;
    const size =
      Math.tanh(over / ARC.REFERENCE_SPEED) * ARC.MAX_SPIN * (isPerfect ? ARC.PERFECT_FACTOR : 1);
    return -Math.sign(paddleVelocity) * Math.sign(vx) * size;
  }

  public afterHit({ paddleIndex, ball, isPerfect }: SkillHit): void {
    if (paddleIndex !== this.host.owner) return;
    const spin = Arc.spinFor(this.host.paddles[paddleIndex].velocity, ball.vx, isPerfect);
    if (spin === 0) return;

    ball.spin = spin;
    ball.spinDecay = ARC.DECAY;
    this.host.report({
      skill: this.id,
      x: ball.x,
      y: ball.y,
      strength: Math.abs(spin) / (ARC.MAX_SPIN * ARC.PERFECT_FACTOR),
    });
  }
}
