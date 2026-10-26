import { Ball, Point } from '@/match/Ball';
import { forecastArrival } from '@/match/forecast';
import { faceLine, isComingAt, ShotRead, Skill, SkillHit, SkillHost } from '@/match/skills/Skill';

// Analyzer: the machine reads a hard shot before the eye does
export const ANALYZER = {
  COST: 1, // charges of the meter; never from a full one, which is kept for Overdrive
  REFUND: 1, // charges a perfect return of the read ball gives back
  HARD_BOUNCES: 2, // walls a shot bounces off on its way that make it hard to read
} as const;

/** The shot being read: the ball, and its flight as the physics will fly it. */
interface Reading {
  ball: Ball;
  path: Point[];
  age: number;
}

/**
 * Implant 1 (docs/PROGRESSION.md): once a rally, when the opponent sends a hard shot at its owner
 * (a curve, an Overdrive power shot, two walls or more on the way) and the meter has a charge but
 * isn't full, it reads the shot through the physics and shows its owner the flight and where it
 * arrives (`read`). The owner still has to get there; returning it perfectly gives the charge
 * back.
 */
export class Analyzer implements Skill {
  public readonly id = 'analyzer';
  private readonly host: SkillHost;
  /** The opponent's last shot, judged at the next step, once every skill has had its say. */
  private pending: Ball | null = null;
  private reading: Reading | null = null;
  private isUsed = false;

  constructor(host: SkillHost) {
    this.host = host;
  }

  private get paddle() {
    return this.host.paddles[this.host.owner];
  }

  public get read(): ShotRead | null {
    if (!this.reading) return null;
    const { path, age } = this.reading;
    return { paddleIndex: this.host.owner, path, age };
  }

  public afterHit({ paddleIndex, ball, isPerfect }: SkillHit): void {
    if (this.reading?.ball === ball) {
      if (paddleIndex === this.host.owner && isPerfect) this.host.meter()?.restore(ANALYZER.REFUND);
      this.reading = null;
    }
    // An opponent's shot (an Arc's spin may be put on it after this): judged at the next step
    if (this.host.paddles[paddleIndex].side !== this.paddle.side) this.pending = ball;
  }

  public beforeStep(dt: number): void {
    if (this.reading) this.reading.age += dt;

    const ball = this.pending;
    this.pending = null;
    if (!ball || this.isUsed || !isComingAt(this.paddle, ball)) return;
    const meter = this.host.meter();
    if (!meter || meter.charge < ANALYZER.COST || meter.isFull) return;

    const path: Point[] = [];
    const arrival = forecastArrival(ball, faceLine(this.paddle, ball), this.host.physics(), path);
    if (!arrival) return;
    const isHard = ball.spin !== 0 || ball.isPowerShot || arrival.bounces >= ANALYZER.HARD_BOUNCES;
    if (!isHard) return;

    meter.spend(ANALYZER.COST);
    this.isUsed = true;
    this.reading = { ball, path, age: 0 };
    this.host.report({ skill: this.id, x: ball.x, y: ball.y, strength: 1 });
  }

  public onServe(): void {
    this.pending = null;
    this.reading = null;
    this.isUsed = false;
  }
}
