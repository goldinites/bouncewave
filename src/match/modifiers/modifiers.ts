import { COURT, PADDLE } from '@/match/config';
import { Modifier, ModifierHost, ModifierId } from '@/match/modifiers/Modifier';
import { PaddleSpec } from '@/match/PaddleSpec';
import { SkillHit } from '@/match/skills/Skill';

// Wind across the court: it blows the ball up or down, and turns around now and then. Its
// particles turn a moment before it does, so the turn can be seen coming
export const WIND = {
  STRENGTH: 140, // px/s²: a serve-speed ball crossing the court drifts ~100 px
  PERIOD: 15, // s between turns
  WARNING: 1, // s the turn shows before it comes
} as const;

// Turbo: a ball in flight gains speed, up to the level's top speed
export const TURBO = { GAIN: 160 } as const; // px/s²

// Bumpers: posts in the middle of the court, clear of the serve's straight line
export const BUMPERS = {
  RADIUS: 16, // px
  Y: [COURT.HEIGHT * 0.27, COURT.HEIGHT * 0.73], // px
} as const;

// The shrinking paddle: the player's paddle loses a share of its length with every hit of theirs
// in a rally, down to a floor, and is whole again at the serve: every point starts fair
export const SHRINK = { PER_HIT: 0.1, FLOOR: 0.5 } as const;

// Slippery rain: every paddle slides, taking up the speed it is steered at over ~1/GRIP s.
// Moderate: a paddle on a phone must not trail the finger far
export const RAIN = { GRIP: 9 } as const; // 1/s

/** The wind, turning around every WIND.PERIOD seconds. */
class Wind implements Modifier {
  public readonly id = 'wind';
  private direction = 1;
  private turnsIn: number = WIND.PERIOD;

  private readonly host: ModifierHost;

  constructor(host: ModifierHost) {
    this.host = host;
  }

  public start(): void {
    this.direction = this.host.random() < 0.5 ? 1 : -1;
    this.turnsIn = WIND.PERIOD;
    this.blow();
  }

  public beforeStep(dt: number): void {
    this.turnsIn -= dt;
    if (this.turnsIn <= 0) {
      this.direction = -this.direction;
      this.turnsIn += WIND.PERIOD;
    }
    this.blow();
  }

  private blow(): void {
    this.host.court.wind = this.direction * WIND.STRENGTH;
    this.host.court.windTurnsIn = this.turnsIn;
  }

  public end(): void {
    this.host.court.wind = 0;
    this.host.court.windTurnsIn = Infinity;
  }
}

class Turbo implements Modifier {
  public readonly id = 'turbo';
  private readonly host: ModifierHost;

  constructor(host: ModifierHost) {
    this.host = host;
  }
  public start(): void {
    this.host.court.turbo = TURBO.GAIN;
  }
  public end(): void {
    this.host.court.turbo = 0;
  }
}

class Bumpers implements Modifier {
  public readonly id = 'bumpers';
  private readonly host: ModifierHost;

  constructor(host: ModifierHost) {
    this.host = host;
  }
  public start(): void {
    this.host.court.bumpers = BUMPERS.Y.map((y) => ({
      x: COURT.WIDTH / 2,
      y,
      radius: BUMPERS.RADIUS,
    }));
  }
  public end(): void {
    this.host.court.bumpers = [];
  }
}

/** The player's paddle shrinks with every hit of theirs in a rally; whole again at the serve. */
class ShrinkingPaddle implements Modifier {
  public readonly id = 'shrinkingPaddle';
  /** Each player paddle's own spec, as it came to the match. */
  private readonly whole = new Map<number, PaddleSpec>();
  private readonly hits = new Map<number, number>();

  private readonly host: ModifierHost;

  constructor(host: ModifierHost) {
    this.host = host;
  }

  public start(): void {
    this.host.paddles.forEach((paddle, i) => {
      if (this.host.isPlayerPaddle(i)) this.whole.set(i, paddle.spec);
    });
  }

  public afterHit({ paddleIndex }: SkillHit): void {
    const spec = this.whole.get(paddleIndex);
    if (!spec) return;
    const hits = (this.hits.get(paddleIndex) ?? 0) + 1;
    this.hits.set(paddleIndex, hits);
    const share = Math.max(SHRINK.FLOOR, 1 - SHRINK.PER_HIT * hits);
    this.host.paddles[paddleIndex].useSpec({ ...spec, height: spec.height * share });
  }

  public onServe(): void {
    this.hits.clear();
    this.restore();
  }

  public end(): void {
    this.restore();
    this.whole.clear();
  }

  private restore(): void {
    for (const [i, spec] of this.whole) this.host.paddles[i].useSpec(spec);
  }
}

class SlipperyRain implements Modifier {
  public readonly id = 'slipperyRain';
  private readonly host: ModifierHost;

  constructor(host: ModifierHost) {
    this.host = host;
  }
  public start(): void {
    for (const paddle of this.host.paddles) paddle.grip = RAIN.GRIP;
  }
  public end(): void {
    for (const paddle of this.host.paddles) paddle.grip = Infinity;
  }
}

/** A modifier that changes only what is drawn, or what the match sets up itself. */
const passive = (id: ModifierId): Modifier => ({ id });

/** How each modifier is made for the match. */
export const MODIFIERS: Record<ModifierId, (host: ModifierHost) => Modifier> = {
  wind: (host) => new Wind(host),
  // Drawn only: its layer darkens all but the balls and the paddles
  darkness: () => passive('darkness'),
  // Set up by the match itself: a second paddle for the opponent (MatchFlow)
  twoOpponents: () => passive('twoOpponents'),
  turbo: (host) => new Turbo(host),
  shrinkingPaddle: (host) => new ShrinkingPaddle(host),
  bumpers: (host) => new Bumpers(host),
  // Drawn only: the ball is not drawn while it crosses the band
  invisibleBand: () => passive('invisibleBand'),
  slipperyRain: (host) => new SlipperyRain(host),
};

/** The stretch of the court across the middle where the invisible band hides the ball, px. */
export const INVISIBLE_BAND = {
  LEFT: COURT.WIDTH / 2 - 70,
  RIGHT: COURT.WIDTH / 2 + 70,
} as const;

/**
 * Two paddles on a side: the second stands this much nearer the middle (px), so the two read as
 * two, not one long paddle.
 */
export const SECOND_PADDLE_STEP = 44;

/** Where each of two paddles on a side stands guard: its half of the court. */
export const HALVES = [
  { top: 0, bottom: COURT.HEIGHT / 2 + PADDLE.HEIGHT / 4 },
  { top: COURT.HEIGHT / 2 - PADDLE.HEIGHT / 4, bottom: COURT.HEIGHT },
] as const;
