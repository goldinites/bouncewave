/**
 * The game's one typeface, for Latin and Cyrillic alike. Loaded from Google Fonts in index.html
 * (weights 400–900); main.css sets the same family for the DOM menus.
 */
export const FONT_FAMILY = 'Tektur, system-ui, sans-serif';

/** A canvas `font` value in the game's typeface. */
export function gameFont(weight: number, sizePx: number): string {
  return `${weight} ${sizePx}px ${FONT_FAMILY}`;
}
