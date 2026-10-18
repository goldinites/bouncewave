import { ButtonColor } from '@/ui/UIManager';
import { MenuButton } from '@/ui/screens/MenuButton';

export interface SetupOption {
  /** Which choice it is, for Preact to tell the rows apart. */
  id: string;
  /** What the choice is, e.g. "POINTS", and its current value, e.g. "5". */
  name: string;
  value: string;
  color: ButtonColor;
  /** Steps the choice on to its next value, or back to its previous one; both wrap around. */
  onNext: () => void;
  onPrevious: () => void;
}

export interface QuickMatchSetupProps {
  options: readonly SetupOption[];
  /** The arrows' names for screen readers. */
  previousLabel: string;
  nextLabel: string;
  startLabel: string;
  backLabel: string;
  onStart: () => void;
  onBack: () => void;
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
 * The quick match's setup: a row per choice, its name and value between an arrow back and
 * an arrow on, then START and BACK. Only the arrows step a choice: the value is no button, just
 * what is chosen. The keyboard walks onto the value instead (up and down, as through a menu),
 * and its left and right keys step it either way; the arrows are for pointers and fingers.
 */
export function QuickMatchSetup({
  options,
  previousLabel,
  nextLabel,
  startLabel,
  backLabel,
  onStart,
  onBack,
}: QuickMatchSetupProps) {
  return (
    <div class="screen-buttons screen-buttons--wide">
      {options.map((option) => {
        const step = (event: KeyboardEvent) => {
          const direction = STEP_KEYS[event.code];
          if (!direction || event.altKey || event.ctrlKey || event.metaKey) return;
          event.preventDefault();
          (direction < 0 ? option.onPrevious : option.onNext)();
        };
        return (
          <div key={option.id} class={`option-row game-button--${option.color}`}>
            <MenuButton
              color={option.color}
              class="option-row__arrow"
              isOffKeyboard
              label={previousLabel}
              onClick={option.onPrevious}
            >
              <Chevron isBack />
            </MenuButton>
            <div
              class="option-row__value"
              role="spinbutton"
              tabIndex={0}
              data-menu-item
              aria-label={option.name}
              aria-valuetext={option.value}
              onKeyDown={step}
            >
              <span class="option-row__name">{option.name}:</span>
              <span class="option-row__current">{option.value}</span>
            </div>
            <MenuButton
              color={option.color}
              class="option-row__arrow"
              isOffKeyboard
              label={nextLabel}
              onClick={option.onNext}
            >
              <Chevron />
            </MenuButton>
          </div>
        );
      })}
      <MenuButton onClick={onStart}>{startLabel}</MenuButton>
      <MenuButton color="purple" onClick={onBack}>
        {backLabel}
      </MenuButton>
    </div>
  );
}
