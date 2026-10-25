/**
 * The debug tools' look: a plain developer-tools theme, not the game's neon — readable at a
 * glance, controls big enough to hit on a phone, one accent colour. Injected once, scoped to the
 * dock (`[data-dock]`), so the panels only name their parts.
 */
const CSS = `
[data-dock] {
  --dbg-bg: rgba(24, 25, 31, 0.95);
  --dbg-surface: #23252d;
  --dbg-border: #3a3d4a;
  --dbg-text: #e4e6eb;
  --dbg-muted: #9aa0ad;
  --dbg-accent: #4c9ffe;
  --dbg-good: #3ecf8e;
  --dbg-warn: #f0b429;
  --dbg-bad: #ef5350;
  font: 12.5px/1.45 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: var(--dbg-text);
  background: var(--dbg-bg);
  border: 1px solid var(--dbg-border);
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
}
[data-dock] button,
[data-dock] select {
  font: inherit;
  color: var(--dbg-text);
  background: var(--dbg-surface);
  border: 1px solid var(--dbg-border);
  border-radius: 5px;
  min-height: 26px;
  padding: 2px 8px;
  cursor: pointer;
}
[data-dock] button:hover,
[data-dock] select:hover { border-color: var(--dbg-accent); }
[data-dock] button[aria-pressed='true'] {
  background: var(--dbg-accent);
  border-color: var(--dbg-accent);
  color: #fff;
}
[data-dock] select { width: 100%; }
[data-dock] select:disabled { opacity: 0.5; cursor: default; }
[data-dock] input[type='checkbox'],
[data-dock] input[type='range'] { accent-color: var(--dbg-accent); }
[data-dock] input[type='checkbox'] { width: 15px; height: 15px; margin: 0; }
[data-dock] label { display: flex; align-items: center; gap: 5px; cursor: pointer; }
[data-dock] a { color: var(--dbg-text); text-decoration: none; }
[data-dock] .dbg-tabs { display: flex; border: 1px solid var(--dbg-border); border-radius: 6px; overflow: hidden; }
[data-dock] .dbg-tabs button { flex: 1; border: 0; border-radius: 0; background: transparent; }
[data-dock] .dbg-tabs button + button { border-left: 1px solid var(--dbg-border); }
[data-dock] .dbg-tabs button[aria-pressed='true'] { background: var(--dbg-accent); color: #fff; }
[data-dock] .dbg-heading {
  margin-top: 6px;
  color: var(--dbg-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
[data-dock] .dbg-section { border: 1px solid var(--dbg-border); border-radius: 5px; padding: 2px 6px; }
[data-dock] .dbg-section > summary { cursor: pointer; min-height: 26px; line-height: 26px; color: var(--dbg-muted); }
[data-dock] .dbg-section[open] > summary { color: var(--dbg-text); margin-bottom: 4px; }
[data-dock] .dbg-section > div { padding-bottom: 4px; }
[data-dock] .dbg-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11.5px; }
[data-dock] .dbg-muted { color: var(--dbg-muted); }
[data-dock] .dbg-status {
  white-space: pre-wrap;
  padding: 6px 8px;
  background: var(--dbg-surface);
  border-radius: 5px;
  color: var(--dbg-muted);
}
[data-dock] .dbg-chips { display: flex; flex-wrap: wrap; gap: 4px; }
[data-dock] .dbg-chips a {
  padding: 3px 9px;
  border: 1px solid var(--dbg-border);
  border-radius: 999px;
  background: var(--dbg-surface);
}
[data-dock] .dbg-chips a[aria-current='true'] { background: var(--dbg-accent); border-color: var(--dbg-accent); color: #fff; }
[data-dock] .dbg-fps[data-state='good'] { color: var(--dbg-good); }
[data-dock] .dbg-fps[data-state='warn'] { color: var(--dbg-warn); }
[data-dock] .dbg-fps[data-state='bad'] { color: var(--dbg-bad); }
[data-dock] .dbg-grid { display: grid; grid-template-columns: 1fr auto auto auto; gap: 4px 12px; align-items: center; }
[data-dock] .dbg-grid .dbg-muted { font-size: 11px; }
`;

/** Puts the debug theme on the page, once. */
export function applyDebugTheme(): void {
  if (document.querySelector('style[data-debug-theme]')) return;
  const style = document.createElement('style');
  style.dataset.debugTheme = '';
  style.textContent = CSS;
  document.head.appendChild(style);
}

/** A small uppercase heading for a group of controls. */
export function debugHeading(text: string): HTMLElement {
  const heading = document.createElement('div');
  heading.className = 'dbg-heading';
  heading.textContent = text;
  return heading;
}
