import { ButtonColor } from '@/ui/UIManager';
import { MenuButton } from '@/ui/screens/MenuButton';

/** A setting picked from a list (a background, a difficulty, a language). */
export interface Choice {
  /** Which choice it is, for Preact to tell the rows apart. */
  id: string;
  /** What the choice is, e.g. "POINTS", and its current value, e.g. "5". */
  name: string;
  value: string;
  /**
   * Every value it can take: the row is as wide as the widest of them, so it never jumps as the
   * choice steps. Left out, it is as wide as the value shown.
   */
  values?: readonly string[];
  color: ButtonColor;
  /** Steps the choice on to its next value, or back to its previous one; both wrap around. */
  onNext: () => void;
  onPrevious: () => void;
}

export interface OptionRowProps {
  choice: Choice;
  /** The arrows' names for screen readers. */
  previousLabel: string;
  nextLabel: string;
}

// Keys that step a focused choice back or on; up and down still walk the menu
const STEP_KEYS: Record<string, -1 | 1> = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };

/** A chevron pointing right, or left when `isBack`, drawn in the button's color. */
const Chevron = ({ isBack }: { isBack?: boolean }) => (
  <svg class="option-row__chevron" viewBox="0 0 10 16" aria-hidden="true">
    <path d={isBack ? 'M8 2 2 8l6 6' : 'M2 2l6 6-6 6'} />
  </svg>
);

/**
 * A choice as a row: its name and value between an arrow back and an arrow on. Only the arrows
 * step it: the value is no button, just what is chosen. The keyboard walks onto the value
 * instead (up and down, as through a menu), and its left and right keys step it either way; the
 * arrows are for pointers and fingers.
 */
export function OptionRow({ choice, previousLabel, nextLabel }: OptionRowProps) {
  const step = (event: KeyboardEvent) => {
    const direction = STEP_KEYS[event.code];
    if (!direction || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    (direction < 0 ? choice.onPrevious : choice.onNext)();
  };

  return (
    <div class={`option-row game-button--${choice.color}`}>
      <MenuButton
        color={choice.color}
        class="option-row__arrow"
        isOffKeyboard
        label={previousLabel}
        onClick={choice.onPrevious}
      >
        <Chevron isBack />
      </MenuButton>
      <div
        class="option-row__value"
        role="spinbutton"
        tabIndex={0}
        data-menu-item
        aria-label={choice.name}
        aria-valuetext={choice.value}
        onKeyDown={step}
      >
        <span class="option-row__name">{choice.name}:</span>
        {/* The value over invisible copies of every other, which hold the widest one's room */}
        <span class="option-row__current">
          <span>{choice.value}</span>
          {choice.values?.map((value) => (
            <span key={value} class="option-row__sizer" aria-hidden="true">
              {value}
            </span>
          ))}
        </span>
      </div>
      <MenuButton
        color={choice.color}
        class="option-row__arrow"
        isOffKeyboard
        label={nextLabel}
        onClick={choice.onNext}
      >
        <Chevron />
      </MenuButton>
    </div>
  );
}
