import { AiSkill } from '@/match/difficulty';
import { clamp } from '@/shared/math';

// A long rally tires the CPU of the lower levels (the rules' `rallyPressure`, the level's `fatigue`,
// step 4.7): from FROM hits it starts to flag, fully by FULL. It reacts later and misjudges more,
// as a tired player does, and its paddle twitches more, so the player can see it straining. Long
// rallies end in its misses rather than in a faster ball. The misjudgment is added in px rather
// than multiplied, so a sharp level tires as much as a loose one. The levels attack harder to make
// up for it (more perfect hits, at any speed), so a match is as hard as it was. The top levels
// barely tire or not at all: there a tiring CPU would hand a strong player every long rally
export const FATIGUE = {
  FROM: 16, // hits in the rally: a little short of the usual rally, so only long ones tire it
  FULL: 28, // hits in the rally
  REACTION: 0.12, // s added to its reaction at full fatigue
  ERROR: 50, // px added to its misjudgment at full fatigue
  ERROR_PER_BOUNCE: 70, // px added to its misjudgment per wall bounce ahead, at full fatigue
  NERVES: 0.5, // added to its nerves at full fatigue
} as const;

/** How tired the CPU is `rally` hits into a rally, in [0, 1]. */
export function fatigueAt(rally: number): number {
  return clamp((rally - FATIGUE.FROM) / (FATIGUE.FULL - FATIGUE.FROM), 0, 1);
}

/**
 * How the CPU plays at `skill` when the rally has it `rallyFatigue` tired (see fatigueAt), as much
 * as its level tires (`skill.fatigue`).
 */
export function tired(skill: AiSkill, rallyFatigue: number): AiSkill {
  const fatigue = rallyFatigue * skill.fatigue;
  if (fatigue <= 0) return skill;
  return {
    ...skill,
    reaction: skill.reaction + FATIGUE.REACTION * fatigue,
    error: skill.error + FATIGUE.ERROR * fatigue,
    errorPerBounce: skill.errorPerBounce + FATIGUE.ERROR_PER_BOUNCE * fatigue,
    nerves: skill.nerves + FATIGUE.NERVES * fatigue,
  };
}
