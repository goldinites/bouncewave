import { Condition } from '@/ui/challengeTexts';
import { getRequiredElement } from '@/ui/dom';

/**
 * A phone on its side, as bars.css lays it out: no strip above the court, only the margin beside
 * it, too narrow for a line, so the HUD draws the condition on the court instead.
 */
export const SIDE_DOCK_QUERY = '(max-height: 520px) and (orientation: landscape)';

const URGENT_CLASS = 'game-condition--urgent';
const SVG_NS = 'http://www.w3.org/2000/svg';
// A heart in a 16-unit box, the same shape the court's HUD draws
const HEART_PATH = 'M8 14.8 C1 9.6 2.8 2.6 8 5.6 C13.2 2.6 15 9.6 8 14.8 Z';

/**
 * A challenge's condition in the strip above the court ("RALLY 12 / 20 · 0:41", the lives as
 * hearts), out of the ball's way, where the controls sit. A phone on its side has no such strip, so
 * there the HUD draws it on the court and this stays empty. The strip always keeps its room, so the
 * court never shifts when a line comes or goes.
 */
export class ConditionBar {
  private readonly el: HTMLElement;
  /** What it last showed, so a frame that changes nothing leaves the DOM alone. */
  private shown = '';
  /** The strip's width its line was last fitted to; 0 until it is (a hidden strip has none). */
  private fittedTo = 0;

  constructor() {
    this.el = getRequiredElement<HTMLElement>('gameCondition');
  }

  /**
   * @param condition what to show; null for nothing
   * @param isShown whether it belongs here at all (not on a phone on its side)
   */
  public update(condition: Condition | null, isShown: boolean): void {
    const line = isShown ? condition : null;
    const key = line
      ? `${line.text}|${line.lives?.left}/${line.lives?.total}|${line.isUrgent}`
      : '';
    if (key === this.shown) {
      // Fitted once the strip has a width, and again whenever it changes
      if (line && this.el.clientWidth !== this.fittedTo) this.fit();
      return;
    }
    this.shown = key;

    this.el.textContent = '';
    this.el.classList.toggle(URGENT_CLASS, line?.isUrgent ?? false);
    if (!line) return;

    const text = document.createElement('span');
    text.textContent = line.text;
    this.el.append(text);
    if (line.lives) {
      const hearts = document.createElement('span');
      hearts.className = 'game-condition__hearts';
      hearts.setAttribute('aria-label', `${line.lives.left} / ${line.lives.total}`);
      for (let i = 0; i < line.lives.total; i++) hearts.append(heart(i < line.lives.left));
      this.el.append(hearts);
    }
    this.fit();
  }

  /**
   * Sets a line too long for the strip smaller, never on two lines: the strip keeps one line's
   * room, so the court doesn't shift. Measured by its parts' own widths, which a centered line
   * spilling over both edges keeps, where the strip's scroll width wouldn't.
   */
  private fit(): void {
    const width = this.el.clientWidth;
    this.fittedTo = width;
    const [text, hearts] = [...this.el.children] as HTMLElement[];
    if (!text || width === 0) return;
    text.style.fontSize = '';
    const gap = hearts ? parseFloat(getComputedStyle(this.el).columnGap) || 0 : 0;
    const needed = text.offsetWidth + (hearts?.offsetWidth ?? 0) + gap;
    if (needed > width) {
      const size = parseFloat(getComputedStyle(text).fontSize);
      text.style.fontSize = `${Math.floor((size * width) / needed)}px`;
    }
  }
}

/** A heart, filled while that life is left, a faint outline once lost. */
function heart(isLeft: boolean): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('game-condition__heart');
  if (!isLeft) svg.classList.add('game-condition__heart--lost');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', HEART_PATH);
  svg.append(path);
  return svg;
}
