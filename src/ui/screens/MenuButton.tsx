import { ComponentChildren } from 'preact';
import { ButtonColor } from '@/ui/UIManager';

export interface MenuButtonProps {
  /** Cyan when left out, as in the menus. */
  color?: ButtonColor;
  /** Shown, but can't be pressed (a mode that isn't playable yet). */
  disabled?: boolean;
  /** More classes, after the button's own. */
  class?: string;
  /**
   * Kept out of the keyboard's way: Tab and the menu keys pass it by, and a click doesn't take
   * the focus off the button the keyboard was on.
   */
  isOffKeyboard?: boolean;
  /** Its name for screen readers, when what it shows is no name (an arrow). */
  label?: string;
  onClick: () => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  children: ComponentChildren;
}

/** A neon menu button, as the old menus draw them (`.game-button` and its color modifier). */
export function MenuButton({
  color = 'cyan',
  disabled,
  class: extra,
  isOffKeyboard,
  label,
  onClick,
  onKeyDown,
  children,
}: MenuButtonProps) {
  const classes = ['game-button', color !== 'cyan' && `game-button--${color}`, extra];
  return (
    <button
      type="button"
      class={classes.filter(Boolean).join(' ')}
      disabled={disabled}
      tabIndex={isOffKeyboard ? -1 : undefined}
      onMouseDown={isOffKeyboard ? (event) => event.preventDefault() : undefined}
      aria-label={label}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {children}
    </button>
  );
}
