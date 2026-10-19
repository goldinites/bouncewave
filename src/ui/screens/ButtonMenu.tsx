import { ButtonColor } from '@/ui/UIManager';
import { MenuButton } from '@/ui/screens/MenuButton';

export interface ButtonMenuItem {
  /** Which item it is, for Preact to tell the buttons apart. */
  id: string;
  label: string;
  /** Cyan when left out. */
  color?: ButtonColor;
  onClick: () => void;
}

export interface ButtonMenuProps {
  items: readonly ButtonMenuItem[];
}

/** A column of buttons, top to bottom: the main menu, the pause, the end of a match. */
export function ButtonMenu({ items }: ButtonMenuProps) {
  return (
    <div class="screen-buttons">
      {items.map((item) => (
        <MenuButton key={item.id} color={item.color} onClick={item.onClick}>
          {item.label}
        </MenuButton>
      ))}
    </div>
  );
}
