/**
 * The game's one typeface, for Latin and Cyrillic alike: Tektur, a variable font (weights
 * 400–900) bundled from @fontsource-variable/tektur by main.css, which also sets it for the menus.
 */
export const FONT_FAMILY = "'Tektur Variable', system-ui, sans-serif";

/** A canvas `font` value in the game's typeface. */
export function gameFont(weight: number, sizePx: number): string {
  return `${weight} ${sizePx}px ${FONT_FAMILY}`;
}
