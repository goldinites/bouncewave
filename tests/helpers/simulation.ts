import { Ball } from '@/match/Ball';
import { COURT, PADDLE } from '@/match/config';
import { DifficultyLevel } from '@/match/difficulty';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';
import {
  AiPaddleController,
  HumanController,
  PaddleController,
  PlayerInput,
} from '@/match/PaddleController';
import { PaddleSpec, STANDARD_PADDLE } from '@/match/PaddleSpec';
import { MatchRules } from '@/match/rules';
import { Side } from '@/match/side';
import { SkillId } from '@/match/skills/Skill';

// The simulation's fixed step, the game's own, and the longest a match may run before it is
// called off (a match that long is a finding in itself)
const STEP = 1 / 240; // s
const MAX_MATCH = 30 * 60; // s

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
 * The AI in the player's seat, playing at a level of its own. The match takes it for a person,
 * so whatever is the player's alone (Overdrive by default, the shrinking paddle) is its.
 */
class SimPlayer extends PersonSeat {
  private readonly ai: AiPaddleController;

  constructor(ai: AiPaddleController) {
    super({ pollPlayerMovement: () => {} });
    this.ai = ai;
  }

  public steer(...args: Parameters<AiPaddleController['steer']>): void {
    this.ai.steer(...args);
  }

  public topSpeed(paddle: Paddle): number {
    return this.ai.topSpeed(paddle);
  }

  public onServe(...args: Parameters<AiPaddleController['onServe']>): void {
    this.ai.onServe(...args);
  }

  public onIncomingShot(...args: Parameters<AiPaddleController['onIncomingShot']>): void {
    this.ai.onIncomingShot(...args);
  }

  public onSkillUse(...args: Parameters<AiPaddleController['onSkillUse']>): void {
    this.ai.onSkillUse(...args);
  }

  public useSkills(skills: readonly SkillId[]): void {
    this.ai.useSkills(skills);
  }

  public onPoint(...args: Parameters<AiPaddleController['onPoint']>): void {
    this.ai.onPoint(...args);
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
  /** The level the AI in the player's seat plays at. */
  readonly player: DifficultyLevel;
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

  const player = new SimPlayer(new AiPaddleController(random, () => match.player));
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
