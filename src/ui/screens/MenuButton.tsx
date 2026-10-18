import { ComponentChildren } from 'preact';
import { ButtonColor } from '@/ui/UIManager';

export interface MenuButtonProps {
  /** Cyan when left out, as in the menus. */
  color?: ButtonColor;
  /** Shown, but can't be pressed (a mode that isn't playable yet). */
  disabled?: boolean;
  onClick: () => void;
  children: ComponentChildren;
}

/** A neon menu button, as the old menus draw them (`.game-button` and its color modifier). */
export function MenuButton({ color = 'cyan', disabled, onClick, children }: MenuButtonProps) {
  const className = color === 'cyan' ? 'game-button' : `game-button game-button--${color}`;
  return (
    <button type="button" class={className} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
