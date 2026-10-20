import { ShotThreat, SHOT_THREAT } from '@/match/AiController';
import { Ball } from '@/match/Ball';
import { CourtConditions } from '@/match/court';
import { ModifierHost, ModifierId } from '@/match/modifiers/Modifier';
import { HALVES, SECOND_PADDLE_STEP } from '@/match/modifiers/modifiers';
import { ModifierSet } from '@/match/modifiers/ModifierSet';
import { BALL, COURT } from '@/match/config';
import { DifficultyConfig, DIFFICULTY_CONFIGS, DifficultyLevel } from '@/match/difficulty';
import { GameState } from '@/match/GameState';
import { Paddle } from '@/match/Paddle';
import {
  AiPaddleController,
  HumanController,
  PaddleController,
  PlayerInput,
} from '@/match/PaddleController';
import { OVERDRIVE, Overdrive } from '@/match/Overdrive';
import { PaddleSpec, STANDARD_PADDLE } from '@/match/PaddleSpec';
import { Physics, PhysicsEvent } from '@/match/Physics';
import { cpuRank, paceAt } from '@/match/ramp';
import { isDecidingPoint, MatchRules, STANDARD_RULES } from '@/match/rules';
import { otherSide, Scores, Side } from '@/match/side';
import { IMPLANTS, ShotRead, SkillHost, SkillId, SkillUse } from '@/match/skills/Skill';
import { SkillSet, TimeWarp } from '@/match/skills/SkillSet';

// Seconds the ball waits at center before each kind of serve
export const SERVE_DELAY = {
  NORMAL: 1.2,
  START: 1.5,
  DEMO: 0.5,
  GAME_OVER: 0.8,
} as const;

// End-of-match cutscene (seconds); the canvas stays live throughout
export const FINALE = {
  WIN_DURATION: 2.4,
  LOSS_DURATION: 1.9,
  SKIP_AFTER: 0.6, // tap/key can skip once this has passed
} as const;

/**
 * - `attract`: AI-vs-AI demo behind the menus
 * - `serving`: a match is on, the ball waits at center for the serve countdown
 * - `rally`: the ball is in play
 * - `paused`: a match is frozen behind the pause menu
 * - `finale`: the match is decided; play is frozen while the end cutscene runs
 */
export type MatchPhase = 'attract' | 'serving' | 'rally' | 'paused' | 'finale';

/** What decided a match: a side's winning score, the clock running out, or the rally goal. */
export type FinaleReason = 'points' | 'time' | 'rally';

export type MatchEvent =
  | { type: 'matchStart' }
  | { type: 'returnToMenu' }
  | { type: 'serve' }
  | { type: 'wallBounce'; x: number; y: number }
  | {
      type: 'paddleHit';
      /** Which of the match's paddles hit it (an index into its list). */
      paddleIndex: number;
      isPerfect: boolean;
      x: number;
      y: number;
      speed: number;
      /** Rally length including this hit. */
      rally: number;
      /** The paddle's Overdrive went off on this hit. */
      isPowerShot: boolean;
      /** This hit filled the paddle's Overdrive meter. */
      chargedOverdrive: boolean;
    }
  // A paddle's skill did something worth showing (docs/PROGRESSION.md)
  | ({ type: 'skill' } & SkillUse)
  // The side that won the point, and the side that won the match
  | { type: 'score'; scoringPlayerIndex: Side; y: number; isDemo: boolean }
  | {
      type: 'finaleStart';
      winnerIndex: Side;
      ballY: number;
      scores: [number, number];
      reason: FinaleReason;
    }
  | { type: 'gameOver'; winnerIndex: Side; scores: [number, number] };

export type { PlayerInput } from '@/match/PaddleController';

/** Who plays one paddle, and what they may do with it. */
export interface Participant {
  readonly controller: PaddleController;
  /** Whether the paddle charges Overdrive, when the match's rules have it on. */
  readonly overdrive: boolean;
  /** The paddle they play with; the standard one when left out. */
  readonly paddle?: PaddleSpec;
  /** What they can do beyond the base game (match/skills/); none when left out. */
  readonly skills?: readonly SkillId[];
}

/** Who plays a match: a participant for each of its paddles, in the same order. */
export type Lineup = readonly Participant[];

export interface MatchFlowDeps {
  /**
   * Every paddle on the court, each playing for its side; at least one a side. The match adds a
   * paddle to it for as long as a match needs one more (an opponent's second, Two opponents),
   * so whoever shares the list sees it.
   */
  paddles: Paddle[];
  /** The match's first ball; the rules may put more on court alongside it. */
  ball: Ball;
  input: PlayerInput;
  /** The level a match is played at unless it is started at its own (a challenge's). */
  getDifficulty: () => DifficultyLevel;
  /** Called synchronously, in order, for everything that happens. */
  onEvent: (event: MatchEvent) => void;
  random?: () => number;
}

/**
 * The rules and timing of a match: phases, serves, scoring, the finale timer, and the
 * simulation step (input, AI, physics). It knows nothing about sound or pixels; it reports
 * what happened through `onEvent` and the presentation reacts.
 */
export class MatchFlow {
  private _phase: MatchPhase = 'attract';
  private resumePhase: MatchPhase = 'serving';
  private _serveTime = 0;
  private _rally = 0;
  private _time = 0;

  private finaleWinner: Side = 0;
  private finaleElapsed = 0;
  private finaleDuration = 0;

  /** The AI-vs-AI demo behind the menus. */
  private readonly demoLineup: Lineup;
  /** Who is playing now: the demo, or the match being played (or just finished). */
  private lineup: Lineup;
  /** Each paddle's Overdrive meter; it only fills in a real match, for a paddle that has it. */
  private readonly overdrives: Overdrive[];
  /** The skills of the paddles in the match being played. */
  private readonly skills = new SkillSet();
  /** Points each side has won in the match being played (or just finished). */
  private readonly _scores: [number, number] = [0, 0];
  /** The rules of the match being played (or last played); set by startMatch. */
  private _rules: MatchRules = STANDARD_RULES;
  /** The level the match being played (or just finished) is at; null in the demo. */
  private matchDifficulty: DifficultyLevel | null = null;
  /** Seconds left on the match clock; null without one, or in the demo. */
  private _timeLeft: number | null = null;
  private readonly paddles: Paddle[];
  /** How many paddles there are between matches: the ones the match was given. */
  private readonly basePaddles: number;
  /** What the court does to the balls over it, as the modifiers of the match set it. */
  private readonly _court = new CourtConditions();
  /** The modifiers of the match being played. */
  private readonly modifiers = new ModifierSet();
  /** Every ball on court: the first is the one given, the rest the rules' extra balls. */
  private readonly _balls: Ball[];
  private readonly input: PlayerInput;
  private readonly getDifficulty: () => DifficultyLevel;
  private readonly emit: (event: MatchEvent) => void;
  private readonly random: () => number;

  constructor(deps: MatchFlowDeps) {
    if (!deps.paddles.some((p) => p.side === 0) || !deps.paddles.some((p) => p.side === 1)) {
      throw new Error('A match needs a paddle on each side');
    }
    this.paddles = deps.paddles;
    this.basePaddles = deps.paddles.length;
    this.overdrives = deps.paddles.map(() => new Overdrive());
    this._balls = [deps.ball];
    deps.ball.court = this._court;
    this.input = deps.input;
    this.getDifficulty = deps.getDifficulty;
    this.emit = deps.onEvent;
    this.random = deps.random ?? Math.random;
    this.demoLineup = this.paddles.map(() => ({
      controller: new AiPaddleController(this.random),
      overdrive: false,
    }));
    this.lineup = this.demoLineup;
  }

  public get phase(): MatchPhase {
    return this._phase;
  }

  /** Seconds left before the ball is served (0 once it is in play). */
  public get serveTime(): number {
    return this._serveTime;
  }

  /**
   * Each paddle's Overdrive meter, in the order of the match's paddles: its charges,
   * 0..OVERDRIVE.CHARGE, or null where it has none (the CPU's, every one under rules without
   * Overdrive, and in the demo).
   */
  public get overdriveCharges(): (number | null)[] {
    return this.overdrives.map((overdrive, i) => (this.hasOverdrive(i) ? overdrive.charge : null));
  }

  /**
   * The perfect hits in a row on each paddle's meter, as `overdriveCharges` has them: the same as
   * its charges unless an implants' core keeps charges a broken streak has left.
   */
  public get overdriveStreaks(): (number | null)[] {
    return this.overdrives.map((overdrive, i) => (this.hasOverdrive(i) ? overdrive.streak : null));
  }

  /** Whether each paddle's meter has an implants' core (its charges are energy), in order. */
  public get implantCores(): boolean[] {
    return this.overdrives.map((overdrive) => overdrive.hasImplantCore);
  }

  /** Whoever is slowing the world down right now (Reflex); null when no one is. */
  public get timeWarp(): TimeWarp | null {
    return this._phase === 'rally' ? this.skills.timeWarp : null;
  }

  /** The shots read ahead for whoever has an Analyzer, while the ball is in play. */
  public get shotReads(): ShotRead[] {
    if (this._phase !== 'rally') return [];
    // A CPU's reads sharpen its eye; nothing of them is shown
    return this.skills.reads.filter((read) => this.isPlayerPaddle(read.paddleIndex));
  }

  /** Whether paddle `index` charges Overdrive: in a real match, if it and the rules have it. */
  private hasOverdrive(index: number): boolean {
    const participant = this.lineup[index];
    if (this.isDemo || !this._rules.overdrive || !participant) return false;
    // A CPU charges it on its own account, at a level that does, where the rules let it
    const isCpus = this._rules.cpuOverdrive && (participant.controller.chargesOverdrive ?? false);
    return participant.overdrive || isCpus;
  }

  /** Points each side has won in the match being played (or just finished). */
  public get scores(): Scores {
    return [this._scores[0], this._scores[1]];
  }

  public get rally(): number {
    return this._rally;
  }

  /** Simulation clock; drives time-based animation. */
  public get time(): number {
    return this._time;
  }

  /** The AI-vs-AI demo behind the menus is running, not a match. */
  public get isDemo(): boolean {
    return this._phase === 'attract';
  }

  /** Coarse state for audio and rendering, which only care about menu / play / paused. */
  public get gameState(): GameState {
    if (this._phase === 'attract') return 'menu';
    if (this._phase === 'paused') return 'paused';
    return 'play';
  }

  public get rules(): MatchRules {
    return this._rules;
  }

  /**
   * The level the match being played (or just finished) is at: how fast the ball gets and how
   * well the CPU plays. Before the first match, the chosen one.
   */
  public get difficulty(): DifficultyLevel {
    return this.matchDifficulty ?? this.getDifficulty();
  }

  /** Seconds left on the match clock; null when the match has none (and in the demo). */
  public get timeLeft(): number | null {
    return this._timeLeft;
  }

  /** Both sides are one point from winning under the match's rules. */
  public get isDecidingPoint(): boolean {
    return isDecidingPoint(this._scores, this._rules);
  }

  /** A real match is being played right now (not demo, paused or finished). */
  public get isMatchActive(): boolean {
    return this._phase === 'serving' || this._phase === 'rally';
  }

  /** What the court does to the balls over it (wind, turbo, posts), as the match's modifiers set it. */
  public get court(): CourtConditions {
    return this._court;
  }

  /** The modifiers of the match being played (none in the demo), for whatever draws them. */
  public get activeModifiers(): readonly ModifierId[] {
    return this.isDemo ? [] : this._rules.modifiers;
  }

  /** Every ball on court, the first one first. */
  public get balls(): readonly Ball[] {
    return this._balls;
  }

  /**
   * The ball nearest to deciding the point: the first to reach the goal line it is flying at
   * (or already past one). The camera and the deciding point's drama follow it.
   */
  public get leadBall(): Ball {
    let lead = this._balls[0];
    let leadTime = Infinity;
    for (const ball of this._balls) {
      const goalX = ball.vx < 0 ? 0 : COURT.WIDTH;
      const time = ball.vx === 0 ? Infinity : (goalX - ball.x) / ball.vx;
      if (time < leadTime) {
        lead = ball;
        leadTime = time;
      }
    }
    return lead;
  }

  /** The ball is moving on court (demo included). */
  public get isBallLive(): boolean {
    return (this._phase === 'attract' || this._phase === 'rally') && this._serveTime <= 0;
  }

  /**
   * The usual match: the player at the left side's first paddle, the CPU at the match's
   * difficulty on every other.
   * @param paddles what each side plays with, [left, right]; the standard paddle by default
   * @param playerSkills what the player can do beyond the base game; nothing by default
   * @param cpuSkills what the CPU can; nothing by default
   */
  public playerVsCpu(
    paddles: readonly [PaddleSpec, PaddleSpec] = [STANDARD_PADDLE, STANDARD_PADDLE],
    playerSkills: readonly SkillId[] = [],
    cpuSkills: readonly SkillId[] = [],
  ): Lineup {
    return this.paddles.map(({ side }, i) => ({
      controller:
        i === this.playerIndex
          ? new HumanController(this.input)
          : new AiPaddleController(this.random, () => this.difficulty),
      overdrive: i === this.playerIndex,
      paddle: paddles[side],
      skills: i === this.playerIndex ? playerSkills : cpuSkills,
    }));
  }

  /**
   * Two people at one device, one a side: each steers with their own controls (see InputHandler)
   * and charges their own Overdrive.
   * @param inputs each side's controls, [left, right]
   */
  public twoPlayers(inputs: readonly [PlayerInput, PlayerInput]): Lineup {
    return this.paddles.map(({ side }) => ({
      controller: new HumanController(inputs[side]),
      overdrive: true,
    }));
  }

  /**
   * Gives paddle `index` other skills at once, in the match being played (a developer's switch
   * for playtesting; the demo's paddles keep none). What its old skills were doing stops.
   */
  public giveSkills(index: number, skills: readonly SkillId[]): void {
    if (this.isDemo) return;
    this.useLineup(
      this.lineup.map((participant, i) => (i === index ? { ...participant, skills } : participant)),
    );
  }

  /** Whether a person plays this paddle (an index into the match's paddles) in this match. */
  public isPlayerPaddle(index: number): boolean {
    return this.lineup[index]?.controller instanceof HumanController;
  }

  /** The side a person plays in this match; null when no one does (the demo). */
  public get playerSide(): Side | null {
    const index = this.paddles.findIndex((_, i) => this.isPlayerPaddle(i));
    return index < 0 ? null : this.paddles[index].side;
  }

  /** Whether a person plays for this side in this match. */
  public isPlayerSide(side: Side): boolean {
    return this.paddles.some((paddle, i) => paddle.side === side && this.isPlayerPaddle(i));
  }

  /** Two people play the match on court, one a side; there is no CPU and no "the player". */
  public get isTwoPlayer(): boolean {
    return this.isPlayerSide(0) && this.isPlayerSide(1);
  }

  /** The left side's first paddle, which the player plays in the usual match. */
  private get playerIndex(): number {
    return this.paddles.findIndex((p) => p.side === 0);
  }

  public startAttract(): void {
    this.modifiers.end();
    this.useLineup(this.demoLineup);
    this.useBalls(1);
    this.matchDifficulty = null;
    this._timeLeft = null;
    this._phase = 'attract';
    this.serve(1, SERVE_DELAY.DEMO);
  }

  /**
   * @param rules what wins the match and which mechanics are on; a standard match by default
   * @param lineup who plays it; the player against the CPU by default
   * @param difficulty how fast the ball gets and how well the CPU plays; the chosen level by
   * default
   */
  public startMatch(
    rules: MatchRules = STANDARD_RULES,
    lineup: Lineup = this.playerVsCpu(),
    difficulty: DifficultyLevel = this.getDifficulty(),
  ): void {
    if (lineup.length !== this.paddles.length) {
      throw new Error('A lineup needs a participant for every paddle');
    }
    this._rules = rules;
    this.matchDifficulty = difficulty;
    this._timeLeft = rules.timeLimit;
    this.modifiers.end();
    this.useLineup(
      rules.modifiers.includes('twoOpponents') ? this.withSecondOpponent(lineup) : lineup,
    );
    this.useBalls(rules.balls);
    this.modifiers.use(rules.modifiers, this.modifierHost());
    this.emit({ type: 'matchStart' });
    this.resetScores();
    this._phase = 'serving';
    this.serve(this.random() < 0.5 ? 1 : -1, SERVE_DELAY.START);
  }

  public returnToMenu(): void {
    this.emit({ type: 'returnToMenu' });
    this.resetScores();
    this.startAttract();
  }

  /** @returns whether the match was paused (only possible while one is being played) */
  public pause(): boolean {
    if (!this.isMatchActive) return false;
    this.resumePhase = this._phase;
    this._phase = 'paused';
    return true;
  }

  public resume(): boolean {
    if (this._phase !== 'paused') return false;
    this._phase = this.resumePhase;
    return true;
  }

  /** Ends the finale early, once its key moment has played. @returns whether it ended */
  public skipFinale(): boolean {
    if (this._phase !== 'finale' || this.finaleElapsed < FINALE.SKIP_AFTER) return false;
    this.finishFinale();
    return true;
  }

  /** Advances the simulation by `dt` seconds. Does nothing while paused. */
  public update(dt: number): void {
    if (this._phase === 'paused') return;

    // Where everything stood before this step, so a frame can be drawn between two steps
    this._balls.forEach((b) => b.rememberPosition());
    this.paddles.forEach((p) => p.rememberPosition());
    this._time += dt;

    if (this._phase === 'finale') {
      // Paddles stay put but settle; the balls are already out of play
      this.paddles.forEach((p) => p.update(dt));
      this.finaleElapsed += dt;
      if (this.finaleElapsed >= this.finaleDuration) {
        this.finishFinale();
      }
      return;
    }

    // The clock runs through serves and rallies alike: a lost point costs the time of the serve
    if (this._timeLeft !== null && this._phase !== 'attract') {
      this._timeLeft = Math.max(0, this._timeLeft - dt);
      if (this._timeLeft === 0) {
        this.endOnTime();
        return;
      }
    }

    const difficulty = this.physicsConfig;
    const isServing = this._serveTime > 0;
    // Skills act while the ball is in play, before anything moves; they may slow time down
    if (!isServing) {
      this.skills.beforeStep(dt);
      this.modifiers.beforeStep(dt);
    }
    this.updatePaddles(dt);

    if (isServing) {
      this._serveTime -= dt;
      if (this._serveTime <= 0 && this._phase === 'serving') {
        this._phase = 'rally';
      }
    } else {
      const ballDt = dt * this.skills.timeScale('balls');
      for (const ball of this._balls) {
        ball.updateTrail(ballDt);
        const events = Physics.step(ball, this.paddles, difficulty, ballDt);
        for (const event of events) this.handlePhysicsEvent(event, ball);
        // The first ball out ends the point: every ball has just been served again. A rally
        // goal reached ends the match, and the balls with it
        if (this.phase === 'finale' || events.some((event) => event.type === 'score')) break;
      }
    }

    // Radius grows with rally and speed, and also affects collisions, so it is simulation
    this._balls.forEach((b) => b.updateRadius(dt, this._rally, difficulty.maxSpeed));
  }

  /**
   * Places the ball and the paddles for drawing, `alpha` of the way through the last step
   * (0 = where they stood when it began, 1 = where it left them).
   */
  public interpolate(alpha: number): void {
    this._balls.forEach((b) => b.interpolate(alpha));
    this.paddles.forEach((p) => p.interpolate(alpha));
  }

  /** Each paddle moves in its own time: a skill may slow one down (Reflex, the opponent's). */
  private updatePaddles(dt: number): void {
    const dts = this.paddles.map((_, i) => dt * this.skills.timeScale(i));
    this.lineup.forEach(({ controller }, i) => {
      const paddle = this.paddles[i];
      controller.steer(paddle, this.ballFor(paddle), this.opponentOf(paddle), dts[i]);
    });
    this.paddles.forEach((p, i) => p.update(dts[i]));
  }

  /**
   * The ball a paddle should play: of those flying its way, the one that gets there first;
   * with none coming, the nearest.
   */
  private ballFor(paddle: Paddle): Ball {
    if (this._balls.length === 1) return this._balls[0];

    const toward = paddle.side === 0 ? -1 : 1;
    let pick = this._balls[0];
    let soonest = Infinity;
    let nearest = Infinity;
    for (const ball of this._balls) {
      const distance = Math.abs(paddle.x - ball.x);
      // Seconds until it arrives if it is coming, otherwise ranked after every ball that is
      const time = Math.sign(ball.vx) === toward ? distance / Math.abs(ball.vx) : Infinity;
      if (time < soonest || (time === soonest && distance < nearest)) {
        pick = ball;
        soonest = time;
        nearest = distance;
      }
    }
    return pick;
  }

  /**
   * The level the ball plays to. The demo plays at the chosen one, also right after a challenge
   * at its own; a ramping CPU quickens the ball as it grows stronger.
   */
  private get physicsConfig(): DifficultyConfig {
    if (this.isDemo) return DIFFICULTY_CONFIGS[this.getDifficulty()];

    const config = DIFFICULTY_CONFIGS[this.difficulty];
    const ramp = this._rules.cpuRamp;
    if (!ramp) return config;
    // The CPU's opponent is the player (the left side when no one plays)
    const opponentPoints = this._scores[this.playerSide ?? 0];
    return { ...config, ...paceAt(cpuRank(this.difficulty, ramp, opponentPoints)) };
  }

  /**
   * Hands the paddles to `lineup`, each made the paddle its participant plays with, its skills
   * theirs, and its meter with a core if they have implants.
   */
  private useLineup(lineup: Lineup): void {
    // A paddle added for a match (an opponent's second) leaves with it
    if (lineup.length < this.paddles.length) {
      this.paddles.length = lineup.length;
      this.overdrives.length = lineup.length;
      this.paddles.forEach((paddle) => paddle.confine());
    }
    this.lineup = lineup;
    lineup.forEach(({ paddle, skills = [] }, i) => {
      this.paddles[i].useSpec(paddle ?? STANDARD_PADDLE);
      this.paddles[i].perfectZoneScale = 1;
      this.overdrives[i].useCore(skills.some((id) => IMPLANTS.includes(id)));
      lineup[i].controller.useSkills?.(skills);
    });
    this.skills.use(
      lineup.map(({ skills = [] }) => skills),
      (owner) => this.skillHost(owner),
    );
  }

  /**
   * `lineup` with a second paddle for the CPU (Two opponents): the same player and paddle, a
   * second AI, the two of them each holding a half of the court (overlapping in the middle).
   */
  private withSecondOpponent(lineup: Lineup): Lineup {
    const cpu = lineup.findIndex(({ controller }) => !(controller instanceof HumanController));
    if (cpu < 0 || lineup.length > this.basePaddles) return lineup;
    const first = this.paddles[cpu];
    const spec = lineup[cpu].paddle ?? STANDARD_PADDLE;
    const forward = first.side === 0 ? SECOND_PADDLE_STEP : -SECOND_PADDLE_STEP;
    const second = new Paddle(first.side, first.x + forward, first.color, spec);
    this.paddles.push(second);
    this.overdrives.push(new Overdrive());
    first.confine(HALVES[0].top, HALVES[0].bottom);
    second.confine(HALVES[1].top, HALVES[1].bottom);
    const controller = new AiPaddleController(this.random, () => this.difficulty);
    return [...lineup, { ...lineup[cpu], controller }];
  }

  /** What the match's modifiers see of it. */
  private modifierHost(): ModifierHost {
    return {
      paddles: this.paddles,
      balls: this._balls,
      court: this._court,
      isPlayerPaddle: (index) => this.isPlayerPaddle(index),
      random: this.random,
    };
  }

  /** What a skill of paddle `owner` sees of the match, and how it reports what it does. */
  private skillHost(owner: number): SkillHost {
    return {
      owner,
      paddles: this.paddles,
      balls: this._balls,
      meter: () => (this.hasOverdrive(owner) ? this.overdrives[owner] : null),
      physics: () => this.physicsConfig,
      topSpeed: () => this.lineup[owner].controller.topSpeed(this.paddles[owner]),
      report: (use) => {
        this.lineup[owner].controller.onSkillUse?.(this.paddles[owner], {
          ...use,
          paddleIndex: owner,
        });
        this.emit({ type: 'skill', paddleIndex: owner, ...use });
      },
    };
  }

  /** Puts `count` balls on court: the match's first ball and as many new ones as it takes. */
  private useBalls(count: number): void {
    this._balls.length = Math.max(1, Math.min(count, this._balls.length));
    while (this._balls.length < count) {
      const ball = new Ball();
      ball.court = this._court;
      this._balls.push(ball);
    }
  }

  /** Who a paddle plays against: the first paddle of the other side. */
  private opponentOf(paddle: Paddle): Paddle {
    const side = otherSide(paddle.side);
    return this.paddles.find((p) => p.side === side)!;
  }

  /** Tells every paddle of `side` that a shot is on its way. */
  private shotAt(side: Side, threat: ShotThreat, ball: Ball): void {
    this.lineup.forEach(({ controller }, i) => {
      const paddle = this.paddles[i];
      if (paddle.side === side) controller.onIncomingShot(paddle, threat, ball);
    });
  }

  /** @param ball the ball it happened to */
  private handlePhysicsEvent(event: PhysicsEvent, ball: Ball): void {
    // A rally goal ended the match earlier in this step: the rest of it is not played
    if (this._phase === 'finale') return;

    switch (event.type) {
      case 'wallBounce':
        this.emit(event);
        break;
      case 'paddleHit': {
        this._rally++;
        // Overdrive charges in a real match, for a paddle that has it, if the rules have it on
        const hitter = event.paddleIndex;
        const overdrive = this.overdrives[hitter];
        const hasOverdrive = this.hasOverdrive(hitter);
        const wasCharged = overdrive.isCharged;
        const isPowerShot = hasOverdrive && overdrive.onHit(event.isPerfect);
        const chargedOverdrive = hasOverdrive && !wasCharged && overdrive.isCharged;

        ball.isPowerShot = isPowerShot;
        if (isPowerShot) {
          ball.applyBoost(OVERDRIVE.BOOST, OVERDRIVE.BOOST_DURATION);
        }

        // The other side now has to read the return, the harder the better it was hit
        const threat = isPowerShot
          ? SHOT_THREAT.POWER
          : event.isPerfect
            ? SHOT_THREAT.PERFECT
            : SHOT_THREAT.NORMAL;
        this.shotAt(otherSide(this.paddles[hitter].side), threat, ball);
        this.emit({ ...event, rally: this._rally, isPowerShot, chargedOverdrive });
        this.skills.afterHit({
          paddleIndex: hitter,
          ball,
          isPerfect: event.isPerfect,
          isPowerShot,
        });
        this.modifiers.afterHit({
          paddleIndex: hitter,
          ball,
          isPerfect: event.isPerfect,
          isPowerShot,
        });

        // A rally long enough wins the match for the player (the left side when no one plays)
        const { rallyGoal } = this._rules;
        if (!this.isDemo && rallyGoal !== null && this._rally >= rallyGoal) {
          this.beginFinale(this.playerSide ?? 0, ball.y, 'rally');
        }
        break;
      }
      case 'score':
        this.handleScore(event.scoringPlayerIndex, event.y);
        break;
    }
  }

  private handleScore(scorer: Side, y: number): void {
    const nextServe = scorer === 0 ? 1 : -1;

    if (this._phase === 'attract') {
      this.emit({ type: 'score', scoringPlayerIndex: scorer, y, isDemo: true });
      this.serve(nextServe, SERVE_DELAY.DEMO);
      return;
    }

    this._scores[scorer]++;
    this.lineup.forEach(({ controller }, i) => controller.onPoint(this.paddles[i], scorer));
    this.emit({ type: 'score', scoringPlayerIndex: scorer, y, isDemo: false });

    if (this._scores[scorer] >= this._rules.winningScores[scorer]) {
      this.beginFinale(scorer, y, 'points');
      return;
    }

    this._phase = 'serving';
    this.serve(nextServe, SERVE_DELAY.NORMAL);
  }

  /**
   * The match clock has run out: the match ends where it stands, mid-rally or not. As the rules
   * say, the side ahead wins (on a level score the player loses), or the player's opponent does
   * whatever the score. With no player, the right side stands for the opponent.
   */
  private endOnTime(): void {
    const [left, right] = this._scores;
    const opponent = otherSide(this.playerSide ?? 0);
    const winner: Side =
      this._rules.timeUp === 'opponent' || left === right ? opponent : left > right ? 0 : 1;
    this.beginFinale(winner, this.leadBall.y, 'time');
  }

  private beginFinale(winner: Side, ballY: number, reason: FinaleReason): void {
    this._phase = 'finale';
    this.finaleWinner = winner;
    this.finaleElapsed = 0;
    // The player's win is celebrated longer than their loss (no player: the left side's); with
    // two players someone at the device always wins
    const isPlayerWin = this.playerSide === null ? winner === 0 : this.isPlayerSide(winner);
    this.finaleDuration = isPlayerWin ? FINALE.WIN_DURATION : FINALE.LOSS_DURATION;

    this.emit({
      type: 'finaleStart',
      winnerIndex: winner,
      ballY,
      scores: [...this._scores],
      reason,
    });
  }

  private finishFinale(): void {
    const winner = this.finaleWinner;
    this._phase = 'attract';
    this.modifiers.end();
    this.useLineup(this.demoLineup);
    this.useBalls(1);

    this.emit({ type: 'gameOver', winnerIndex: winner, scores: [...this._scores] });
    this.serve(winner === 0 ? 1 : -1, SERVE_DELAY.GAME_OVER);
  }

  /** @param direction where the first ball goes (1 right, -1 left); any others alternate */
  private serve(direction: number, delay: number): void {
    this._balls.forEach((ball, i) => {
      ball.serve(i % 2 === 0 ? direction : -direction, BALL.INITIAL_SPEED, this.random);
    });
    // Both sides get ready for the point; whoever a ball is served to reads it like any shot
    this.lineup.forEach(({ controller }, i) => {
      controller.onServe(this.paddles[i], this.scores, this._rules);
    });
    this._balls.forEach((ball) => this.shotAt(ball.vx > 0 ? 1 : 0, SHOT_THREAT.NORMAL, ball));
    this.skills.onServe();
    this.modifiers.onServe();
    this._rally = 0;
    this._serveTime = delay;
    this.emit({ type: 'serve' });
  }

  private resetScores(): void {
    this._scores.fill(0);
    this.paddles.forEach((p) => p.resetPosition());
    for (const { controller } of [...this.demoLineup, ...this.lineup]) controller.reset();
    this.overdrives.forEach((o) => o.reset());
  }
}
