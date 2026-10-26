import { ModifierId } from '@/match/modifiers/Modifier';
import { MatchRules } from '@/match/rules';

/** The modifier that takes over next, and the points until it does. */
export interface UpcomingModifier {
  readonly id: ModifierId;
  readonly inPoints: number;
}

/**
 * Which modifiers a match has in play as it goes on: the rules' own all along, and a rotation's
 * in turn on top of them (Chaos), each for so many points, in an order dealt with the match's
 * randomness so a seed replays it. Whatever else switches modifiers mid-match (a story fight's
 * phases, stage 8) is another schedule of the same kind.
 */
export class ModifierSchedule {
  private rules: MatchRules | null = null;
  /** The rotation's modifiers in the order dealt for this match. */
  private rotation: ModifierId[] = [];

  /** A match under `rules` starts: its rotation, if it has one, is dealt. */
  public start(rules: MatchRules, random: () => number): void {
    this.rules = rules;
    this.rotation = deal(rules.rotation?.modifiers ?? [], random);
  }

  /** The modifiers in play once `played` points (both sides') are played. */
  public at(played: number): readonly ModifierId[] {
    const rules = this.rules;
    if (!rules) return [];
    const rotation = rules.rotation;
    if (!rotation || this.rotation.length === 0) return rules.modifiers;
    const turn = Math.floor(played / rotation.points) % this.rotation.length;
    return [...rules.modifiers, this.rotation[turn]];
  }

  /** The rotation's next modifier, `played` points in; null without a rotation. */
  public upcoming(played: number): UpcomingModifier | null {
    const rotation = this.rules?.rotation;
    if (!rotation) return null;
    const turn = Math.floor(played / rotation.points);
    return {
      id: this.rotation[(turn + 1) % this.rotation.length],
      inPoints: (turn + 1) * rotation.points - played,
    };
  }
}

/** `modifiers` in an order dealt with `random`. */
function deal(modifiers: readonly ModifierId[], random: () => number): ModifierId[] {
  const order = [...modifiers];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
