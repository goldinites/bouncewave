import { AiController, ShotThreat, SHOT_THREAT } from '@/match/AiController';
import { AiForm } from '@/match/AiForm';
import { Ball } from '@/match/Ball';
import { AiSkill, DEMO_AI_SKILL, DIFFICULTY_CONFIGS, DifficultyLevel } from '@/match/difficulty';
import { Paddle } from '@/match/Paddle';
import { isDecidingPoint, MatchRules } from '@/match/rules';
import { Scores, Side } from '@/match/side';

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
  /** A shot is on its way to `paddle`: the serve, or a hit by the other side. */
  onIncomingShot(paddle: Paddle, threat: ShotThreat): void;
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

  public onServe(): void {}
  public onIncomingShot(): void {}
  public onPoint(): void {}
  public reset(): void {}
}

/**
 * The AI playing a paddle. Without a difficulty it plays the demo behind the menus at its own
 * level; given one, it is the CPU of a match: that level, in whatever form the score has put it
 * (see AiForm), picked afresh on every serve.
 */
export class AiPaddleController implements PaddleController {
  private readonly ai: AiController;
  private readonly getDifficulty: (() => DifficultyLevel) | null;
  /** The CPU's form in a match; none in the demo. */
  private readonly form: AiForm | null;
  private _skill: AiSkill = DEMO_AI_SKILL;

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
    this.ai.update(paddle, ball, this._skill, dt, opponent);
  }

  public onServe(paddle: Paddle, scores: Scores, rules: MatchRules): void {
    if (!this.form || !this.getDifficulty) {
      this._skill = DEMO_AI_SKILL;
      return;
    }

    const level = this.getDifficulty();
    // AiForm reads the score as [opponent, CPU]
    const [left, right] = scores;
    const fromCpuSide: [number, number] = paddle.side === 1 ? [left, right] : [right, left];
    // The deciding point is read from the real sides: each may have its own winning score
    const isDeciding = isDecidingPoint(scores, rules);
    this.form.update(fromCpuSide, DIFFICULTY_CONFIGS[level].adaptivity, isDeciding);
    this._skill = this.form.skillFor(level);
  }

  public onIncomingShot(paddle: Paddle, threat: ShotThreat = SHOT_THREAT.NORMAL): void {
    this.ai.readShot(paddle, this._skill, threat);
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
