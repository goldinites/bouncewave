/**
 * The backdrops the player can pick for a quick match (and the deck "random" deals from), in the
 * order the developer's B key steps through them.
 */
export const SCENES = ['lasers', 'memphis', 'outrun', 'neonCity', 'fuji', 'jungle'] as const;

/** A backdrop the player can pick. */
export type PickableSceneId = (typeof SCENES)[number];

/**
 * The challenges' own backdrops, one per tier of the list (docs/CHALLENGES.md): never offered to
 * the quick match, nor dealt by "random". Each one's background comes in its own step (2.7–2.9);
 * until it does, its challenges play on the player's.
 */
export const CHALLENGE_SCENES = ['warehouse', 'dojo', 'brokenNet'] as const;

export type ChallengeSceneId = (typeof CHALLENGE_SCENES)[number];

/** A backdrop; a song can belong to one, and then plays only behind it. */
export type SceneId = PickableSceneId | ChallengeSceneId;

/** Every backdrop there is: the pickable ones, then the challenges'. */
export const ALL_SCENES: readonly SceneId[] = [...SCENES, ...CHALLENGE_SCENES];

export const isSceneId = (value: string): value is SceneId =>
  (ALL_SCENES as readonly string[]).includes(value);

/** Whether the player can pick it (and "random" deal it) for a quick match. */
export const isPickableScene = (scene: SceneId): scene is PickableSceneId =>
  (SCENES as readonly string[]).includes(scene);

/** The backdrop the player picks for a quick match: one of them, or a different one each time. */
export type BackgroundChoice = PickableSceneId | 'random';

/** Every choice, in the order picking steps through them: random first, then the backdrops. */
export const BACKGROUND_CHOICES: readonly BackgroundChoice[] = ['random', ...SCENES];

export const isBackgroundChoice = (value: unknown): value is BackgroundChoice =>
  (BACKGROUND_CHOICES as readonly unknown[]).includes(value);
