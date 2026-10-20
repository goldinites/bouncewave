import { Modifier, ModifierHost, ModifierId } from '@/match/modifiers/Modifier';
import { MODIFIERS } from '@/match/modifiers/modifiers';
import { SkillHit } from '@/match/skills/Skill';

/**
 * The modifiers of the match being played, called through their hooks. The match tells it what
 * happens; with none, it does nothing.
 */
export class ModifierSet {
  private modifiers: Modifier[] = [];

  /**
   * Starts the next match's modifiers, the last match's ended first.
   * @param host what they see of the match
   */
  public use(ids: readonly ModifierId[], host: ModifierHost): void {
    this.end();
    this.modifiers = ids.map((id) => MODIFIERS[id](host));
    for (const modifier of this.modifiers) modifier.start?.();
  }

  public beforeStep(dt: number): void {
    for (const modifier of this.modifiers) modifier.beforeStep?.(dt);
  }

  public afterHit(hit: SkillHit): void {
    for (const modifier of this.modifiers) modifier.afterHit?.(hit);
  }

  public onServe(): void {
    for (const modifier of this.modifiers) modifier.onServe?.();
  }

  /** Ends them all: what they changed is put back. */
  public end(): void {
    for (const modifier of this.modifiers) modifier.end?.();
    this.modifiers = [];
  }
}
