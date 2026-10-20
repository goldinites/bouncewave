import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { AiController, ShotThreat } from '@/match/AiController';
import { AiSkill, DIFFICULTY_CONFIGS, DifficultyLevel } from '@/match/difficulty';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';
import { HumanController, PaddleController, PlayerInput } from '@/match/PaddleController';
import { PaddleSpec, STANDARD_PADDLE } from '@/match/PaddleSpec';
import { MatchRules } from '@/match/rules';
import { Side } from '@/match/side';
import { SkillId, SkillUse } from '@/match/skills/Skill';

// The simulation's fixed step, the game's own, and the longest a match may run before it is
// called off (a match that long is a finding in itself)
const STEP = 1 / 240; // s
const MAX_MATCH = 30 * 60; // s

/**
 * Players of four strengths to stand in for people: the levels as they played before step 4.7
 * balanced them (the same steps up from a weak player to an expert), frozen here so the yardstick
 * stays put whatever the levels become. The levels are balanced for the average one.
 */
export const PLAYERS = {
  weak: {
    speed: 440,
    reaction: 0.2,
    error: 45,
    errorPerBounce: 90,
    angleShots: 0,
    nerves: 1,
    perfectAim: 0,
    curveRead: 0.6,
    overdrive: false,
    fatigue: 0,
  },
  average: {
    speed: 560,
    reaction: 0.14,
    error: 28,
    errorPerBounce: 75,
    angleShots: 0.25,
    nerves: 0.8,
    perfectAim: 0.1,
    curveRead: 0.45,
    overdrive: false,
    fatigue: 0,
  },
  strong: {
    speed: 640,
    reaction: 0.1,
    error: 20,
    errorPerBounce: 50,
    angleShots: 0.4,
    nerves: 0.6,
    perfectAim: 0.25,
    curveRead: 0.32,
    overdrive: false,
    fatigue: 0,
  },
  expert: {
    speed: 720,
    reaction: 0.07,
    error: 13,
    errorPerBounce: 30,
    angleShots: 0.55,
    nerves: 0.4,
    perfectAim: 0.4,
    curveRead: 0.22,
    overdrive: false,
    fatigue: 0,
  },
} as const satisfies Record<string, AiSkill>;

export type PlayerId = keyof typeof PLAYERS;

/** A seeded stand-in for Math.random, so a simulated match plays the same every run. */
export const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

/**
 * A person's controller as far as the match can tell (it asks `instanceof HumanController`), typed
 * as any controller, so one that plays on its own can stand in for the person.
 */
const PersonSeat = HumanController as new (input: PlayerInput) => PaddleController;

/**
 * The AI in the player's seat, playing at a skill of its own. The match takes it for a person,
 * so whatever is the player's alone (Overdrive by default, the shrinking paddle) is its. Like a
 * person it plays as it plays: no form drifting with the score, no tiring in a long rally.
 */
class SimPlayer extends PersonSeat {
  private readonly ai: AiController;
  private readonly skill: AiSkill;

  constructor(random: () => number, skill: AiSkill) {
    super({ pollPlayerMovement: () => {} });
    this.ai = new AiController(random);
    this.skill = skill;
  }

  public steer(paddle: Paddle, ball: Ball, opponent: Paddle, dt: number): void {
    this.ai.update(paddle, ball, this.skill, dt, opponent);
  }

  public topSpeed(paddle: Paddle): number {
    return this.skill.speed * paddle.spec.speed;
  }

  public onIncomingShot(paddle: Paddle, threat: ShotThreat, ball: Ball): void {
    this.ai.readShot(paddle, this.skill, threat, ball);
  }

  public onSkillUse(_paddle: Paddle, use: SkillUse): void {
    if (use.skill === 'analyzer') this.ai.sharpen();
  }

  public useSkills(skills: readonly SkillId[]): void {
    this.ai.usesArc = skills.includes('arc');
  }

  public reset(): void {
    this.ai.reset();
  }
}

/** One match to simulate: the AI "player" on the left against the CPU on the right. */
export interface SimMatch {
  readonly rules: MatchRules;
  /** The match's level: the CPU's play and the ball's pace. */
  readonly difficulty: DifficultyLevel;
  /** How the AI in the player's seat plays: one of PLAYERS, or a level's skill. */
  readonly player: PlayerId | DifficultyLevel;
  readonly paddles?: readonly [PaddleSpec, PaddleSpec];
  /** Whether the player's perfect hits charge Overdrive (the rules permitting); yes by default. */
  readonly playerOverdrive?: boolean;
  readonly playerSkills?: readonly SkillId[];
  readonly cpuSkills?: readonly SkillId[];
  readonly seed: number;
}

/** A point as it was played. */
export interface SimPoint {
  readonly winner: Side;
  /** Hits in its rally, both sides'. */
  readonly hits: number;
  /** Seconds from the serve to the point, the serve's wait left out. */
  readonly seconds: number;
}

/** How a simulated match went. */
export interface SimReport {
  /** Null when it ran out of time before an end (see MAX_MATCH). */
  readonly winner: Side | null;
  readonly reason: 'points' | 'time' | 'rally' | null;
  readonly scores: readonly [number, number];
  readonly points: readonly SimPoint[];
  /** Each side's perfect hits and Overdrive shots. */
  readonly perfectHits: readonly [number, number];
  readonly powerShots: readonly [number, number];
  /** Every event of the match, for whatever a caller wants to count itself. */
  readonly events: readonly MatchEvent[];
}

/** Plays `match` out at the game's fixed step and reports how it went. */
export function simulate(match: SimMatch): SimReport {
  const random = seeded(match.seed);
  const paddles = [
    new Paddle(0, PADDLE.OFFSET_X, '#19f0ff'),
    new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6'),
  ];
  const events: MatchEvent[] = [];
  const points: SimPoint[] = [];
  const perfectHits: [number, number] = [0, 0];
  const powerShots: [number, number] = [0, 0];
  let rallyHits = 0;
  let rallySeconds = 0;

  const flow = new MatchFlow({
    paddles,
    ball: new Ball(),
    input: { pollPlayerMovement: () => {} },
    getDifficulty: () => match.difficulty,
    onEvent: (event) => {
      events.push(event);
      if (event.type === 'paddleHit') {
        rallyHits = event.rally;
        const side = paddles[event.paddleIndex].side;
        if (event.isPerfect) perfectHits[side]++;
        if (event.isPowerShot) powerShots[side]++;
      }
      if (event.type === 'score' && !event.isDemo) {
        points.push({ winner: event.scoringPlayerIndex, hits: rallyHits, seconds: rallySeconds });
      }
      if (event.type === 'serve') {
        rallyHits = 0;
        rallySeconds = 0;
      }
    },
    random,
  });

  const player = new SimPlayer(
    random,
    typeof match.player === 'number' ? DIFFICULTY_CONFIGS[match.player] : PLAYERS[match.player],
  );
  const [, cpu] = flow.playerVsCpu(
    match.paddles ?? [STANDARD_PADDLE, STANDARD_PADDLE],
    match.playerSkills,
    match.cpuSkills,
  );
  const lineup = [
    {
      controller: player,
      overdrive: match.playerOverdrive ?? true,
      paddle: match.paddles?.[0],
      skills: match.playerSkills,
    },
    cpu,
  ];
  flow.startMatch(match.rules, lineup, match.difficulty);

  for (let step = 0; step < MAX_MATCH / STEP && flow.phase !== 'attract'; step++) {
    if (flow.phase === 'rally' && flow.serveTime <= 0) rallySeconds += STEP;
    flow.update(STEP);
  }

  const finale = events.find((event) => event.type === 'finaleStart');
  return {
    winner: finale?.type === 'finaleStart' ? finale.winnerIndex : null,
    reason: finale?.type === 'finaleStart' ? finale.reason : null,
    scores: finale?.type === 'finaleStart' ? finale.scores : flow.scores,
    points,
    perfectHits,
    powerShots,
    events,
  };
}

/** The share of all the points of `reports` the player (the left side) won. */
export const playerPointShare = (reports: readonly SimReport[]): number => {
  const points = reports.flatMap((report) => report.points);
  return points.filter((point) => point.winner === 0).length / points.length;
};

/** `count` simulated matches of `match`, each from its own seed. */
export const simulateMany = (match: Omit<SimMatch, 'seed'>, count: number, firstSeed = 1) =>
  Array.from({ length: count }, (_, i) => simulate({ ...match, seed: firstSeed + i * 7919 }));
