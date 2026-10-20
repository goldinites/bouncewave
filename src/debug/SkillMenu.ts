/**
 * Developer-only switches for the skill prototypes, shown with the debug overlay (`?debug` or
 * F3), to playtest them without editing the address.
 *
 * - A checkbox per skill gives it to the player or takes it away: at once in a match against
 *   the CPU, and in every match after it. The address keeps the choice (`?skills=arc,reflex`),
 *   so a reload does too.
 * - Next to each, how often it went off in the match on court.
 */
export class SkillMenu {
  private readonly el: HTMLElement;
  private readonly boxes = new Map<string, HTMLInputElement>();
  private readonly counts = new Map<string, HTMLElement>();
  private readonly onChange: (skills: string[]) => void;
  private readonly listeners = new AbortController();

  /**
   * @param skills every skill there is, in order
   * @param chosen those the player has now
   * @param onChange told the skills the player should have whenever a box is ticked or cleared
   */
  constructor(
    skills: readonly string[],
    chosen: readonly string[],
    onChange: (skills: string[]) => void,
  ) {
    this.onChange = onChange;

    this.el = document.createElement('nav');
    this.el.setAttribute('aria-label', 'Skills (debug)');
    Object.assign(this.el.style, {
      position: 'fixed',
      top: 'calc(60px + env(safe-area-inset-top, 0px))',
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
    title.textContent = 'skills · used';
    title.style.color = '#7cfc8a';
    this.el.append(title, ...skills.map((skill) => this.createRow(skill, chosen.includes(skill))));
    document.body.appendChild(this.el);
  }

  public setVisible(isVisible: boolean): void {
    this.el.style.display = isVisible ? 'flex' : 'none';
  }

  /** How often each skill went off in the match on court; one left out has not yet. */
  public setCounts(counts: ReadonlyMap<string, number>): void {
    for (const [skill, el] of this.counts) el.textContent = String(counts.get(skill) ?? 0);
  }

  public dispose(): void {
    this.listeners.abort();
    this.el.remove();
  }

  private createRow(skill: string, isChosen: boolean): HTMLLabelElement {
    const row = document.createElement('label');
    Object.assign(row.style, { display: 'flex', gap: '6px', alignItems: 'center' });

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = isChosen;
    box.dataset.skill = skill;
    box.addEventListener('change', () => this.changed(), { signal: this.listeners.signal });
    this.boxes.set(skill, box);

    const name = document.createElement('span');
    name.textContent = skill;
    name.style.flex = '1';

    const count = document.createElement('span');
    count.textContent = '0';
    count.style.color = '#ffe53b';
    this.counts.set(skill, count);

    row.append(box, name, count);
    return row;
  }

  private changed(): void {
    // The box keeps no focus: the keys that follow steer the paddle, not the checkbox
    (document.activeElement as HTMLElement | null)?.blur();
    const skills = [...this.boxes].filter(([, box]) => box.checked).map(([skill]) => skill);
    const url = new URL(window.location.href);
    if (skills.length > 0) url.searchParams.set('skills', skills.join(','));
    else url.searchParams.delete('skills');
    history.replaceState(null, '', url.toString().replace(/([?&])debug=(&|$)/, '$1debug$2'));
    this.onChange(skills);
  }
}
