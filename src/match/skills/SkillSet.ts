import { Arc } from '@/match/skills/Arc';
import { Reflex } from '@/match/skills/Reflex';
import { Skill, SkillHit, SkillHost, SkillId } from '@/match/skills/Skill';

/** How each skill is made for the paddle that has it. */
const SKILLS: Record<SkillId, (host: SkillHost) => Skill> = {
  arc: (host) => new Arc(host),
  reflex: (host) => new Reflex(host),
};

/** Someone has slowed the world down (Reflex). */
export interface TimeWarp {
  /** The paddle that did, an index into the match's. */
  paddleIndex: number;
  /** How fast the balls move meanwhile (1 = normal). */
  scale: number;
}

/**
 * The skills of every paddle in the match being played, called through their hooks in the order
 * the paddles stand. The match asks it how fast time runs for each thing on court and tells it
 * what happens; without skills every answer is the plain match's.
 */
export class SkillSet {
  private skills: { owner: number; skill: Skill }[] = [];

  /**
   * Gives each paddle its skills for the next match, in place of the last match's.
   * @param hostFor what a skill of paddle `owner` sees of the match
   */
  public use(
    skillsByPaddle: readonly (readonly SkillId[])[],
    hostFor: (owner: number) => SkillHost,
  ): void {
    this.skills = skillsByPaddle.flatMap((ids, owner) =>
      ids.map((id) => ({ owner, skill: SKILLS[id](hostFor(owner)) })),
    );
  }

  /** How fast time runs this step for paddle `target` (an index) or the balls: every skill's say. */
  public timeScale(target: number | 'balls'): number {
    let scale = 1;
    for (const { skill } of this.skills) scale *= skill.timeScale?.(target) ?? 1;
    return scale;
  }

  /** @param dt the step; each skill gets it in its owner's time */
  public beforeStep(dt: number): void {
    for (const { owner, skill } of this.skills) skill.beforeStep?.(dt * this.timeScale(owner));
  }

  public afterHit(hit: SkillHit): void {
    for (const { skill } of this.skills) skill.afterHit?.(hit);
  }

  public onServe(): void {
    for (const { skill } of this.skills) skill.onServe?.();
  }

  /** Whoever is slowing the balls down right now; null when no one is. */
  public get timeWarp(): TimeWarp | null {
    for (const { owner, skill } of this.skills) {
      const scale = skill.timeScale?.('balls') ?? 1;
      if (scale < 1) return { paddleIndex: owner, scale };
    }
    return null;
  }
}
