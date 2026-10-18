/** The backdrops behind the court, in the order the developer's B key steps through them. */
export const SCENES = ['lasers', 'memphis', 'outrun', 'neonCity', 'fuji', 'jungle'] as const;

/** A backdrop; a song can belong to one, and then plays only behind it. */
export type SceneId = (typeof SCENES)[number];

export const isSceneId = (value: string): value is SceneId =>
  (SCENES as readonly string[]).includes(value);

/** The backdrop the player picks for a quick match: one of them, or a different one each time. */
export type BackgroundChoice = SceneId | 'random';

/** Every choice, in the order picking steps through them: random first, then the backdrops. */
export const BACKGROUND_CHOICES: readonly BackgroundChoice[] = ['random', ...SCENES];

export const isBackgroundChoice = (value: unknown): value is BackgroundChoice =>
  (BACKGROUND_CHOICES as readonly unknown[]).includes(value);
