/** Who a skill is given to from the menu: the player, or the CPU they play. */
export type SkillOwner = 'player' | 'cpu';

/** The address parameter each owner's skills are kept in. */
const PARAMS: Record<SkillOwner, string> = { player: 'skills', cpu: 'cpuSkills' };

/**
 * Developer-only switches for the skill prototypes, shown with the debug overlay (`?debug` or
 * F3), to playtest them without editing the address.
 *
 * - A row per skill, a checkbox for the player ("you") and one for the CPU: ticked, it is theirs
 *   at once in a match against the CPU, and in every match after it. The address keeps the
 *   choice (`?skills=arc,reflex&cpuSkills=analyzer`), so a reload does too.
 * - Next to each, how often each of them used it in the match on court.
 */
export class SkillMenu {
  private readonly el: HTMLElement;
  private readonly boxes: Record<SkillOwner, Map<string, HTMLInputElement>> = {
    player: new Map(),
    cpu: new Map(),
  };
  private readonly counts = new Map<string, HTMLElement>();
  private readonly onChange: (owner: SkillOwner, skills: string[]) => void;
  private readonly listeners = new AbortController();

  /**
   * @param skills every skill there is, in order
   * @param chosen those each owner has now
   * @param onChange told an owner's skills whenever one of their boxes is ticked or cleared
   */
  constructor(
    skills: readonly string[],
    chosen: Record<SkillOwner, readonly string[]>,
    onChange: (owner: SkillOwner, skills: string[]) => void,
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
      gridTemplateColumns: 'auto auto auto auto',
      columnGap: '8px',
      rowGap: '2px',
      alignItems: 'center',
      padding: '4px 8px',
      font: '12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      color: '#19f0ff',
      background: 'rgba(0, 0, 0, 0.6)',
      borderRadius: '4px',
    });

    const heading = ['skills', 'you', 'cpu', 'used'].map((text) => {
      const cell = document.createElement('span');
      cell.textContent = text;
      cell.style.color = '#7cfc8a';
      return cell;
    });
    this.el.append(...heading);
    for (const skill of skills) this.addRow(skill, chosen);
    document.body.appendChild(this.el);
  }

  public setVisible(isVisible: boolean): void {
    this.el.style.display = isVisible ? 'grid' : 'none';
  }

  /**
   * How often each skill went off in the match on court, [the player's, the CPU's]; one left
   * out has not yet.
   */
  public setCounts(counts: ReadonlyMap<string, readonly [number, number]>): void {
    for (const [skill, el] of this.counts) {
      const [player, cpu] = counts.get(skill) ?? [0, 0];
      el.textContent = `${player}·${cpu}`;
    }
  }

  public dispose(): void {
    this.listeners.abort();
    this.el.remove();
  }

  private addRow(skill: string, chosen: Record<SkillOwner, readonly string[]>): void {
    const name = document.createElement('span');
    name.textContent = skill;

    const box = (owner: SkillOwner) => {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = chosen[owner].includes(skill);
      input.dataset.skill = skill;
      input.dataset.owner = owner;
      input.setAttribute('aria-label', `${skill} (${owner})`);
      input.addEventListener('change', () => this.changed(owner), {
        signal: this.listeners.signal,
      });
      this.boxes[owner].set(skill, input);
      return input;
    };

    const count = document.createElement('span');
    count.textContent = '0·0';
    count.style.color = '#ffe53b';
    this.counts.set(skill, count);

    this.el.append(name, box('player'), box('cpu'), count);
  }

  private changed(owner: SkillOwner): void {
    // The box keeps no focus: the keys that follow steer the paddle, not the checkbox
    (document.activeElement as HTMLElement | null)?.blur();
    const skills = [...this.boxes[owner]].filter(([, box]) => box.checked).map(([skill]) => skill);
    const url = new URL(window.location.href);
    if (skills.length > 0) url.searchParams.set(PARAMS[owner], skills.join(','));
    else url.searchParams.delete(PARAMS[owner]);
    history.replaceState(null, '', url.toString().replace(/([?&])debug=(&|$)/, '$1debug$2'));
    this.onChange(owner, skills);
  }
}
