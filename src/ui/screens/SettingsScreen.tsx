import { ButtonColor } from '@/ui/UIManager';
import { MenuButton } from '@/ui/screens/MenuButton';
import { Choice, OptionRow } from '@/ui/screens/OptionRow';

/** An on/off setting (music, sound): a button that is filled while on. */
export interface Toggle {
  id: string;
  label: string;
  color: ButtonColor;
  isOn: boolean;
  onToggle: () => void;
}

/** A button that opens another screen from the settings (the controls). */
export interface Link {
  id: string;
  label: string;
  color: ButtonColor;
  onClick: () => void;
}

export type SettingsItem =
  ({ kind: 'toggle' } & Toggle) | ({ kind: 'choice' } & Choice) | ({ kind: 'link' } & Link);

export interface SettingsScreenProps {
  items: readonly SettingsItem[];
  /** The arrows' names for screen readers. */
  previousLabel: string;
  nextLabel: string;
  backLabel: string;
  onBack: () => void;
}

/**
 * The settings, top to bottom, then BACK: the on/off ones as toggles, the ones picked from a
 * list (the language) as rows stepped by their arrows, a screen of their own (the controls) as a
 * button.
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
        item.kind === 'toggle' ? (
          <MenuButton key={item.id} color={item.color} pressed={item.isOn} onClick={item.onToggle}>
            {item.label}
          </MenuButton>
        ) : item.kind === 'link' ? (
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
