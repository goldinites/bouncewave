import { Condition } from '@/ui/challengeTexts';
import { getRequiredElement } from '@/ui/dom';

const URGENT_CLASS = 'game-condition--urgent';
const SVG_NS = 'http://www.w3.org/2000/svg';
// A heart in a 16-unit box, the same shape the court's HUD draws
const HEART_PATH = 'M8 14.8 C1 9.6 2.8 2.6 8 5.6 C13.2 2.6 15 9.6 8 14.8 Z';

/**
 * A challenge's condition under the court on a phone held upright, where across the turned court
 * it would cross the ball's path ("RALLY 12 / 20 · 0:41", the lives as hearts). Elsewhere the HUD
 * draws it on the court and this stays empty. Its bar always keeps its room, so the court never
 * shifts when a line comes or goes.
 */
export class ConditionBar {
  private readonly el: HTMLElement;
  /** What it last showed, so a frame that changes nothing leaves the DOM alone. */
  private shown = '';

  constructor() {
    this.el = getRequiredElement<HTMLElement>('gameCondition');
  }

  /**
   * @param condition what to show; null for nothing
   * @param isShown whether it belongs here at all (a phone held upright)
   */
  public update(condition: Condition | null, isShown: boolean): void {
    const line = isShown ? condition : null;
    const key = line
      ? `${line.text}|${line.lives?.left}/${line.lives?.total}|${line.isUrgent}`
      : '';
    if (key === this.shown) return;
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
