/**
 * Developer-only switches for the match modifiers, shown with the debug overlay (`?debug` or
 * F3), under the skill menu: a checkbox per modifier, ticked ones played in every quick match
 * from the next one on (a match's rules are set as it starts). The address keeps the choice
 * (`?mods=wind,darkness`), so a reload does too.
 */
export class ModifierMenu {
  private readonly el: HTMLElement;
  private readonly boxes = new Map<string, HTMLInputElement>();
  private readonly onChange: (modifiers: string[]) => void;
  private readonly listeners = new AbortController();

  /**
   * @param modifiers every modifier there is, in order
   * @param chosen those on now
   * @param onChange told the modifiers on whenever a box is ticked or cleared
   */
  constructor(
    modifiers: readonly string[],
    chosen: readonly string[],
    onChange: (modifiers: string[]) => void,
  ) {
    this.onChange = onChange;

    this.el = document.createElement('nav');
    this.el.setAttribute('aria-label', 'Modifiers (debug)');
    Object.assign(this.el.style, {
      position: 'fixed',
      top: 'calc(150px + env(safe-area-inset-top, 0px))',
      right: 'calc(6px + env(safe-area-inset-right, 0px))',
      zIndex: '9999',
      display: 'none',
      flexDirection: 'column',
      gap: '2px',
      padding: '4px 8px',
      font: '12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      color: '#19f0ff',
      background: 'rgba(0, 0, 0, 0.6)',
      borderRadius: '4px',
    });

    const title = document.createElement('span');
    title.textContent = 'mods · next match';
    title.style.color = '#7cfc8a';
    this.el.append(title, ...modifiers.map((id) => this.createRow(id, chosen.includes(id))));
    document.body.appendChild(this.el);
  }

  public setVisible(isVisible: boolean): void {
    this.el.style.display = isVisible ? 'flex' : 'none';
  }

  public dispose(): void {
    this.listeners.abort();
    this.el.remove();
  }

  private createRow(modifier: string, isChosen: boolean): HTMLLabelElement {
    const row = document.createElement('label');
    Object.assign(row.style, { display: 'flex', gap: '6px', alignItems: 'center' });
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = isChosen;
    box.dataset.modifier = modifier;
    box.addEventListener('change', () => this.changed(), { signal: this.listeners.signal });
    this.boxes.set(modifier, box);
    const name = document.createElement('span');
    name.textContent = modifier;
    row.append(box, name);
    return row;
  }

  private changed(): void {
    // The box keeps no focus: the keys that follow steer the paddle, not the checkbox
    (document.activeElement as HTMLElement | null)?.blur();
    const modifiers = [...this.boxes].filter(([, box]) => box.checked).map(([id]) => id);
    const url = new URL(window.location.href);
    if (modifiers.length > 0) url.searchParams.set('mods', modifiers.join(','));
    else url.searchParams.delete('mods');
    history.replaceState(null, '', url.toString().replace(/([?&])debug=(&|$)/, '$1debug$2'));
    this.onChange(modifiers);
  }
}
