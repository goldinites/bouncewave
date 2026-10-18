/** The backdrops behind the court, in the order the developer's B key steps through them. */
export const SCENES = ['lasers', 'memphis', 'outrun', 'neonCity', 'fuji', 'jungle'] as const;

/** A backdrop; a song can belong to one, and then plays only behind it. */
export type SceneId = (typeof SCENES)[number];

export const isSceneId = (value: string): value is SceneId =>
  (SCENES as readonly string[]).includes(value);
