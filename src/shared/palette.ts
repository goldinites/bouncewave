/**
 * The night sky behind everything. One value for the page before its stylesheet loads, the
 * loader, the browser chrome, the install manifest and the iOS launch screens (index.html gets
 * it in place of __BACKGROUND__ at build time). CSS can't import it: --bg in vars.css repeats it.
 */
export const BACKGROUND = '#0b0320';

/** Neon palette for the canvas; the same colors are CSS custom properties in styles/vars.css. */
export const COLORS = {
  CYAN: '#19f0ff',
  PINK: '#ff2bd6',
  PURPLE: '#b79bff',
  YELLOW: '#ffe53b',
  WHITE: '#ffffff',
} as const;
