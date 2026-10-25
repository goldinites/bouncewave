import { ButtonColor } from '@/ui/UIManager';
import { MenuButton } from '@/ui/screens/MenuButton';
import { Choice, OptionRow } from '@/ui/screens/OptionRow';

/** A button that opens another screen from the settings (the controls). */
export interface Link {
  id: string;
  label: string;
  color: ButtonColor;
  onClick: () => void;
}

export type SettingsItem = ({ kind: 'choice' } & Choice) | ({ kind: 'link' } & Link);

export interface SettingsScreenProps {
  items: readonly SettingsItem[];
  /** The arrows' names for screen readers. */
  previousLabel: string;
  nextLabel: string;
  backLabel: string;
  onBack: () => void;
}

/**
 * The settings, top to bottom, then BACK: the ones stepped through values (the volumes, the
 * language) as rows stepped by their arrows, a screen of their own (the controls) as a button.
 */
export function SettingsScreen({
  items,
  previousLabel,
  nextLabel,
  backLabel,
  onBack,
}: SettingsScreenProps) {
  return (
    <div class="screen-buttons screen-buttons--wide screen-buttons--settings">
      {items.map((item) =>
        item.kind === 'link' ? (
          <MenuButton key={item.id} color={item.color} onClick={item.onClick}>
            {item.label}
          </MenuButton>
        ) : (
          <OptionRow
            key={item.id}
            choice={item}
            previousLabel={previousLabel}
            nextLabel={nextLabel}
          />
        ),
      )}
      <MenuButton onClick={onBack}>{backLabel}</MenuButton>
    </div>
  );
}
