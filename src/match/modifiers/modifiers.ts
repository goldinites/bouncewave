import { COURT, PADDLE } from '@/match/config';
import { Brick, Bumper } from '@/match/court';
import { Modifier, ModifierHost, ModifierId } from '@/match/modifiers/Modifier';
import { PaddleSpec } from '@/match/PaddleSpec';
import { SkillHit } from '@/match/skills/Skill';

// Wind across the court: it pushes the ball up or down in gusts, from a moderate wind to a strong
// one, and turns around now and then. A shot into the wind loses its way (one sent down against
// a wind blowing up barely gets down), a shot with it runs steeper. Its streaks follow its
// strength, and die down a moment before it turns, so a gust and a turn can be seen coming
export const WIND = {
  MIN: 160, // px/s²: a ball crossing the court in a second drifts ~80 px...
  MAX: 300, // ...up to ~150 px in a strong gust
  GUST: 3, // s between the gusts' new strengths
  EASE: 0.8, // 1/s it moves toward a gust's strength
  PERIOD: 15, // s between turns
  WARNING: 1, // s the turn shows before it comes
} as const;

// Turbo: a ball in flight gains speed; past the level's top speed too, a little more for every
// hit of the rally, up to a share over it
export const TURBO = {
  GAIN: 160, // px/s²
  OVER_PER_HIT: 0.015, // of the top speed, for every hit of the rally
  MAX_OVER: 0.18,
} as const;

// Bumpers: posts on the centre line, clear of the serve's straight line, and a third in the
// middle that rises and sinks. It is never there at the serve, rises only with every ball clear
// of it, and takes RISE seconds to grow from a dot, blinking, so it can't appear unseen
export const BUMPERS = {
  RADIUS: 16, // px
  Y: [COURT.HEIGHT * 0.27, COURT.HEIGHT * 0.73], // px
  UP: 4, // s the middle one stays up...
  DOWN: 4, // ...and down
  RISE: 0.5, // s it takes to rise or sink
  CLEARANCE: 80, // px every ball must be from the middle for it to rise
} as const;

// Bricks: a wall of two columns across the middle, as in Arkanoid. A ball bounces off a brick and
// breaks it, so a shot into the wall comes back at its hitter; hits open holes in it. An opening
// in the middle lets the serve through, and the wall is whole again at every serve: every point
// starts fair
export const BRICKS = {
  WIDTH: 14, // px
  HEIGHT: 33, // px
  GAP: 4, // px between two bricks
  ROWS: 5, // a half's, from the opening to the wall
  OPENING: 100, // px clear across the middle
  COLUMNS: [COURT.WIDTH / 2 - 17, COURT.WIDTH / 2 + 3], // px, each column's left edge
} as const;

/** The whole wall of bricks, top half and bottom half. */
export const BRICK_WALL: readonly Brick[] = BRICKS.COLUMNS.flatMap((x) =>
  Array.from({ length: BRICKS.ROWS }, (_, row) => {
    const offset = BRICKS.OPENING / 2 + row * (BRICKS.HEIGHT + BRICKS.GAP);
    return [
      {
        x,
        y: COURT.HEIGHT / 2 - offset - BRICKS.HEIGHT,
        width: BRICKS.WIDTH,
        height: BRICKS.HEIGHT,
      },
      { x, y: COURT.HEIGHT / 2 + offset, width: BRICKS.WIDTH, height: BRICKS.HEIGHT },
    ];
  }).flat(),
);

// The shrinking paddle: the player's paddle loses a share of its length with every hit of theirs
// in a rally, down to a floor, and is whole again at the serve: every point starts fair
export const SHRINK = { PER_HIT: 0.06, FLOOR: 0.5 } as const;

// Ice: the court is frozen and every paddle slides on it. It heads for its aim at PULL (1/s of the way
// left) and takes up that speed over ~1/GRIP s, but sheds speed only by FRICTION: the faster it
// went, the further it rolls on (a quick 150 px move rolls ~70 px past its aim) before it comes
// back and stands
export const ICE = { PULL: 8, GRIP: 6, FRICTION: 1300 } as const; // 1/s, 1/s, px/s²

/** The wind, in gusts, turning around every WIND.PERIOD seconds. */
class Wind implements Modifier {
  public readonly id = 'wind';
  private direction = 1;
  private turnsIn: number = WIND.PERIOD;
  private strength: number = WIND.MIN;
  /** The strength the current gust is heading for, and how long until the next one. */
  private gust: number = WIND.MIN;
  private nextGustIn: number = WIND.GUST;

  private readonly host: ModifierHost;

  constructor(host: ModifierHost) {
    this.host = host;
  }

  public start(): void {
    this.direction = this.host.random() < 0.5 ? 1 : -1;
    this.turnsIn = WIND.PERIOD;
    this.strength = this.gust = WIND.MIN + this.host.random() * (WIND.MAX - WIND.MIN);
    this.nextGustIn = WIND.GUST;
    this.blow();
  }

  public beforeStep(dt: number): void {
    this.turnsIn -= dt;
    if (this.turnsIn <= 0) {
      this.direction = -this.direction;
      this.turnsIn += WIND.PERIOD;
    }
    this.nextGustIn -= dt;
    if (this.nextGustIn <= 0) {
      this.gust = WIND.MIN + this.host.random() * (WIND.MAX - WIND.MIN);
      this.nextGustIn += WIND.GUST;
    }
    this.strength += (this.gust - this.strength) * Math.min(1, WIND.EASE * dt);
    this.blow();
  }

  private blow(): void {
    this.host.court.wind = this.direction * this.strength;
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
  private hits = 0;

  public start(): void {
    this.host.court.turbo = TURBO.GAIN;
    this.host.court.turboOver = 0;
  }

  public afterHit(): void {
    this.hits++;
    this.host.court.turboOver = Math.min(TURBO.MAX_OVER, TURBO.OVER_PER_HIT * this.hits);
  }

  public onServe(): void {
    this.hits = 0;
    this.host.court.turboOver = 0;
  }

  public end(): void {
    this.host.court.turbo = 0;
    this.host.court.turboOver = 0;
  }
}

class Bumpers implements Modifier {
  public readonly id = 'bumpers';
  private readonly host: ModifierHost;

  constructor(host: ModifierHost) {
    this.host = host;
  }
  /** How far the middle post has risen, in [0, 1], which way it is going, and until when. */
  private height = 0;
  private isRising = false;
  private holdFor: number = BUMPERS.DOWN;

  public start(): void {
    this.onServe();
  }

  /** At the serve the middle post is down, and stays down a while. */
  public onServe(): void {
    this.height = 0;
    this.isRising = false;
    this.holdFor = BUMPERS.DOWN;
    this.place();
  }

  public beforeStep(dt: number): void {
    this.holdFor -= dt;
    if (this.holdFor <= 0) {
      const isClear = this.host.balls.every(
        (ball) =>
          Math.hypot(ball.x - COURT.WIDTH / 2, ball.y - COURT.HEIGHT / 2) > BUMPERS.CLEARANCE,
      );
      // It rises only into an empty middle; sinking needs no room
      if (this.isRising || isClear) {
        this.isRising = !this.isRising;
        this.holdFor = this.isRising ? BUMPERS.UP : BUMPERS.DOWN;
      }
    }
    const toward = this.isRising ? 1 : 0;
    const step = dt / BUMPERS.RISE;
    this.height =
      toward > this.height ? Math.min(1, this.height + step) : Math.max(0, this.height - step);
    this.place();
  }

  /** The two fixed posts, and the middle one as far as it has risen. */
  private place(): void {
    const posts: Bumper[] = BUMPERS.Y.map((y) => ({
      x: COURT.WIDTH / 2,
      y,
      radius: BUMPERS.RADIUS,
    }));
    if (this.height > 0) {
      posts.push({
        x: COURT.WIDTH / 2,
        y: COURT.HEIGHT / 2,
        radius: BUMPERS.RADIUS * this.height,
        growth: this.height,
      });
    }
    this.host.court.bumpers = posts;
  }

  public end(): void {
    this.host.court.bumpers = [];
  }
}

/** A wall of bricks across the middle, whole again at every serve; the match breaks them. */
class Bricks implements Modifier {
  public readonly id = 'bricks';
  private readonly host: ModifierHost;

  constructor(host: ModifierHost) {
    this.host = host;
  }

  public start(): void {
    this.onServe();
  }

  public onServe(): void {
    this.host.court.bricks = BRICK_WALL;
  }

  public end(): void {
    this.host.court.bricks = [];
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

class Ice implements Modifier {
  public readonly id = 'ice';
  private readonly host: ModifierHost;

  constructor(host: ModifierHost) {
    this.host = host;
  }
  public start(): void {
    for (const paddle of this.host.paddles) paddle.slip(ICE.PULL, ICE.GRIP, ICE.FRICTION);
  }
  public end(): void {
    for (const paddle of this.host.paddles) paddle.slip(0, Infinity, Infinity);
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
  ice: (host) => new Ice(host),
  bricks: (host) => new Bricks(host),
};

/** The stretch of the court across the middle where the invisible band hides the ball, px. */
export const INVISIBLE_BAND = {
  LEFT: COURT.WIDTH / 2 - 160,
  RIGHT: COURT.WIDTH / 2 + 160,
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
