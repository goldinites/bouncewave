/**
 * The backdrops the player can pick for a quick match (and the deck "random" deals from), in the
 * order the developer's B key steps through them.
 */
export const SCENES = ['lasers', 'memphis', 'outrun', 'neonCity', 'fuji', 'jungle'] as const;

/** A backdrop the player can pick. */
export type PickableSceneId = (typeof SCENES)[number];

/**
 * Backdrops a mode keeps for itself, by mode: never offered to the quick match, nor dealt by
 * "random". A match of that mode asks for one when it starts. The challenges' are one per tier of
 * the list (docs/CHALLENGES.md), each one's background coming in its own step (2.7–2.9); the
 * story's chapters (stage 8) will list theirs here. A scene with no background yet gets the
 * player's.
 */
export const EXCLUSIVE_SCENES = {
  challenges: ['warehouse', 'dojo', 'brokenNet'],
  story: [],
} as const;

/** A mode that keeps backdrops of its own. */
export type SceneOwner = keyof typeof EXCLUSIVE_SCENES;

/** A backdrop a mode keeps for itself; of one mode, or of any. */
export type ExclusiveSceneId<Owner extends SceneOwner = SceneOwner> =
  (typeof EXCLUSIVE_SCENES)[Owner][number];

/** A backdrop; a song can belong to one, and then plays only behind it. */
export type SceneId = PickableSceneId | ExclusiveSceneId;

/** Every backdrop there is: the pickable ones, then each mode's own. */
export const ALL_SCENES: readonly SceneId[] = [
  ...SCENES,
  ...Object.values(EXCLUSIVE_SCENES).flat(),
];

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
