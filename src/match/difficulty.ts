// The values are what saved settings store. 0 was an Easy of 1.1, since removed: a saved 0 no
// longer passes isDifficultyLevel and loads as the default instead. Never reuse it for another
// level. Step 2.4 moved every level a step down, its numbers and play kept (Normal became Easy,
// Hard Normal, Insane Hard), and added a harder Insane on top.
export enum DifficultyLevel {
  EASY = 1,
  NORMAL = 2,
  HARD = 3,
  INSANE = 4,
}

export interface DifficultyConfig {
  /** CPU paddle speed, px/s. */
  speed: number;
  /** Seconds before the CPU reacts to a shot coming at it. */
  reaction: number;
  /** Spread of the CPU's misjudgment of where the ball will arrive, px... */
  error: number;
  /** ...plus this much more for every wall bounce still ahead of the ball (steep shots). */
  errorPerBounce: number;
  /** Chance the CPU angles its return away from the player instead of hitting it flat. */
  angleShots: number;
  /**
   * How human the CPU's movement looks, in [0, 1]: it re-reads shots in glances and now and then
   * twitches. 0 is a perfectly steady machine. See AiController.
   */
  nerves: number;
  /**
   * Chance the CPU plays a return as a perfect hit on purpose: the ball met dead center while the
   * paddle swings through it, which steers it hard away from the player. See AiController.
   */
  perfectAim: number;
  /** Whether the CPU charges Overdrive, where the match's rules let it (`cpuOverdrive`). */
  overdrive: boolean;
  /**
   * How far, in levels, the CPU's form may drift with the score to keep matches close
   * (weaker while it leads, stronger while it trails). See AiForm.
   */
  adaptivity: number;
  /** Share the ball speeds up on each paddle hit. */
  acceleration: number;
  maxSpeed: number;
}

/** How well an AI paddle plays. */
export type AiSkill = Pick<
  DifficultyConfig,
  | 'speed'
  | 'reaction'
  | 'error'
  | 'errorPerBounce'
  | 'angleShots'
  | 'nerves'
  | 'perfectAim'
  | 'overdrive'
>;

/** Both paddles of the attract-mode demo behind the menu, whatever the difficulty. */
export const DEMO_AI_SKILL: AiSkill = {
  speed: 400,
  reaction: 0.2,
  error: 60,
  errorPerBounce: 40,
  angleShots: 0.3,
  nerves: 1,
  perfectAim: 0.15,
  overdrive: false,
};

export const DIFFICULTY_CONFIGS: Record<DifficultyLevel, DifficultyConfig> = {
  [DifficultyLevel.EASY]: {
    speed: 440,
    reaction: 0.2,
    error: 45,
    errorPerBounce: 90,
    angleShots: 0,
    nerves: 1,
    perfectAim: 0,
    overdrive: false,
    adaptivity: 0.4,
    acceleration: 0.075,
    maxSpeed: 840,
  },
  [DifficultyLevel.NORMAL]: {
    speed: 560,
    reaction: 0.14,
    error: 28,
    errorPerBounce: 75,
    angleShots: 0.25,
    nerves: 0.8,
    perfectAim: 0.1,
    overdrive: false,
    adaptivity: 0.2,
    acceleration: 0.095,
    maxSpeed: 920,
  },
  [DifficultyLevel.HARD]: {
    speed: 640,
    reaction: 0.1,
    error: 20,
    errorPerBounce: 50,
    angleShots: 0.4,
    nerves: 0.6,
    perfectAim: 0.25,
    overdrive: true,
    adaptivity: 0,
    acceleration: 0.115,
    maxSpeed: 1000,
  },
  // A step past Hard, as each level is past the one below: quicker, sharper, steadier, and a ball
  // that speeds up harder to a higher top speed. A starting point for playtesting
  [DifficultyLevel.INSANE]: {
    speed: 720,
    reaction: 0.07,
    error: 13,
    errorPerBounce: 30,
    angleShots: 0.55,
    nerves: 0.4,
    perfectAim: 0.4,
    overdrive: true,
    adaptivity: 0,
    acceleration: 0.135,
    maxSpeed: 1080,
  },
};

/** Every level, easiest first. */
export const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = Object.values(DifficultyLevel).filter(
  (value): value is DifficultyLevel => typeof value === 'number',
);

export function isDifficultyLevel(value: unknown): value is DifficultyLevel {
  return DIFFICULTY_LEVELS.includes(value as DifficultyLevel);
}

/** The next level up, wrapping around from the hardest back to the easiest. */
export function nextDifficulty(level: DifficultyLevel): DifficultyLevel {
  const index = DIFFICULTY_LEVELS.indexOf(level);
  return DIFFICULTY_LEVELS[(index + 1) % DIFFICULTY_LEVELS.length];
}
