import { AiController, ShotThreat, SHOT_THREAT } from '@/match/AiController';
import { AiForm, skillAt } from '@/match/AiForm';
import { Ball } from '@/match/Ball';
import { PADDLE } from '@/match/config';
import { AiSkill, DEMO_AI_SKILL, DIFFICULTY_CONFIGS, DifficultyLevel } from '@/match/difficulty';
import { fatigueAt, tired } from '@/match/fatigue';
import { Paddle } from '@/match/Paddle';
import { cpuRank } from '@/match/ramp';
import { isDecidingPoint, MatchRules } from '@/match/rules';
import { otherSide, Scores, Side } from '@/match/side';
import { SkillId, SkillUse } from '@/match/skills/Skill';

/** Anything that can steer the player's paddle (keyboard, pointer, touch). */
export interface PlayerInput {
  pollPlayerMovement(paddle: Paddle, dt: number): void;
}

/**
 * Whoever plays a paddle: a person at the keyboard or screen, or the AI. The match tells it what
 * happens and asks it to move the paddle every step; it never asks who is behind it.
 */
export interface PaddleController {
  /** Moves `paddle` for one simulation step. */
  steer(paddle: Paddle, ball: Ball, opponent: Paddle, dt: number): void;
  /**
   * A point is about to be served.
   * @param scores the score as it now stands
   */
  onServe(paddle: Paddle, scores: Scores, rules: MatchRules): void;
  /**
   * A shot is on its way to `paddle`: the serve, or a hit by the other side.
   * @param ball the ball it is on
   * @param rally hits in the rally so far, this shot's included (0 for the serve)
   */
  onIncomingShot(paddle: Paddle, threat: ShotThreat, ball: Ball, rally: number): void;
  /** One of `paddle`'s own skills has just done something (match/skills/). */
  onSkillUse?(paddle: Paddle, use: SkillUse): void;
  /**
   * Whether it charges Overdrive on its own account, beyond its participant's say (a CPU at a
   * level that does, where the rules let it).
   */
  readonly chargesOverdrive?: boolean;
  /** px/s it can move `paddle` at, at most: what a skill takes for its owner's own speed. */
  topSpeed(paddle: Paddle): number;
  /** The skills its paddle has for the match about to be played, so it can play them. */
  useSkills?(skills: readonly SkillId[]): void;
  /** A point of a real match was won by the side `scorer`. */
  onPoint(paddle: Paddle, scorer: Side): void;
  /** Forgets everything it has learnt (back to the menu). */
  reset(): void;
}

/** A person steering the paddle with whatever input the game reads. */
export class HumanController implements PaddleController {
  private readonly input: PlayerInput;

  constructor(input: PlayerInput) {
    this.input = input;
  }

  public steer(paddle: Paddle, _ball: Ball, _opponent: Paddle, dt: number): void {
    this.input.pollPlayerMovement(paddle, dt);
  }

  /** A person's top speed: the keyboard's (a pointer can be quicker, a hand rarely is). */
  public topSpeed(paddle: Paddle): number {
    return PADDLE.KEYBOARD_SPEED * paddle.spec.speed;
  }

  public onServe(): void {}
  public onIncomingShot(): void {}
  public onPoint(): void {}
  public reset(): void {}
}

/**
 * The AI playing a paddle. Without a difficulty it plays the demo behind the menus at its own
 * level; given one, it is the CPU of a match: that level, in whatever form the score has put it
 * (see AiForm), picked afresh on every serve. Under rules with a `cpuRamp` it has no form: it
 * plays as strong as its opponent's points have made it. Where the rules say so, a long rally
 * tires it (match/fatigue.ts), and it is fresh again for the next point.
 */
export class AiPaddleController implements PaddleController {
  private readonly ai: AiController;
  private readonly getDifficulty: (() => DifficultyLevel) | null;
  /** The CPU's form in a match; none in the demo. */
  private readonly form: AiForm | null;
  private _skill: AiSkill = DEMO_AI_SKILL;
  /** How it plays the shot coming at it: the point's skill, worn down by a long rally. */
  private playing: AiSkill = DEMO_AI_SKILL;
  /** Whether a long rally tires it: a match's CPU, where the rules say so. */
  private tires = false;

  /**
   * @param random the match's source of randomness, so a seeded match replays the same
   * @param getDifficulty the chosen level, for the CPU of a match; leave out for the demo
   */
  constructor(random: () => number, getDifficulty?: () => DifficultyLevel) {
    this.ai = new AiController(random);
    this.getDifficulty = getDifficulty ?? null;
    this.form = getDifficulty ? new AiForm() : null;
  }

  /** How it plays the current point; picked on every serve. */
  public get skill(): AiSkill {
    return this._skill;
  }

  public steer(paddle: Paddle, ball: Ball, opponent: Paddle, dt: number): void {
    this.ai.update(paddle, ball, this.playing, dt, opponent);
  }

  public topSpeed(paddle: Paddle): number {
    return this._skill.speed * paddle.spec.speed;
  }

  /** A match's CPU at a level that charges Overdrive; never the demo's. */
  public get chargesOverdrive(): boolean {
    return this.form !== null && this._skill.overdrive;
  }

  public useSkills(skills: readonly SkillId[]): void {
    this.ai.usesArc = skills.includes('arc');
  }

  public onSkillUse(_paddle: Paddle, use: SkillUse): void {
    // Its Analyzer has read the shot: nothing drawn on court for it, only a sharper read
    if (use.skill === 'analyzer') this.ai.sharpen();
  }

  public onServe(paddle: Paddle, scores: Scores, rules: MatchRules): void {
    this._skill = this.skillForPoint(paddle, scores, rules);
    // Fresh for every point, however long the last rally ran
    this.playing = this._skill;
    this.tires = this.form !== null && rules.rallyPressure;
  }

  /** How it plays the point about to be served, picked from the level, the rules and its form. */
  private skillForPoint(paddle: Paddle, scores: Scores, rules: MatchRules): AiSkill {
    if (!this.form || !this.getDifficulty) return DEMO_AI_SKILL;

    const level = this.getDifficulty();
    // A ramping CPU plays at the strength the opponent's points have given it, with no form
    if (rules.cpuRamp) {
      const opponentPoints = scores[otherSide(paddle.side)];
      return skillAt(cpuRank(level, rules.cpuRamp, opponentPoints));
    }

    // AiForm reads the score as [opponent, CPU]
    const [left, right] = scores;
    const fromCpuSide: [number, number] = paddle.side === 1 ? [left, right] : [right, left];
    // The deciding point is read from the real sides: each may have its own winning score
    const isDeciding = isDecidingPoint(scores, rules);
    this.form.update(fromCpuSide, DIFFICULTY_CONFIGS[level].adaptivity, isDeciding);
    return this.form.skillFor(level);
  }

  public onIncomingShot(
    paddle: Paddle,
    threat: ShotThreat = SHOT_THREAT.NORMAL,
    ball?: Ball,
    rally = 0,
  ): void {
    this.playing = this.tires ? tired(this._skill, fatigueAt(rally)) : this._skill;
    this.ai.readShot(paddle, this.playing, threat, ball ?? null);
  }

  public onPoint(paddle: Paddle, scorer: Side): void {
    // AiForm counts a point for the CPU as 1, for its opponent as 0
    this.form?.onPoint(scorer === paddle.side ? 1 : 0);
  }

  public reset(): void {
    this.ai.reset();
    this.form?.reset();
  }
}
