import { ButtonColor } from '@/ui/UIManager';
import { MenuButton } from '@/ui/screens/MenuButton';

export interface SetupOption {
  /** Which choice it is, for Preact to tell the buttons apart. */
  id: string;
  /** The choice and its current value, e.g. "POINTS TO WIN: 5". */
  label: string;
  color: ButtonColor;
  /** Switches the choice to its next value. */
  onCycle: () => void;
}

export interface QuickMatchSetupProps {
  options: readonly SetupOption[];
  startLabel: string;
  backLabel: string;
  onStart: () => void;
  onBack: () => void;
}

/**
 * The quick match's setup: a button per choice, each stepping through its values as the
 * settings menu's do, then START and BACK.
 */
export function QuickMatchSetup({
  options,
  startLabel,
  backLabel,
  onStart,
  onBack,
}: QuickMatchSetupProps) {
  return (
    <div class="screen-buttons">
      {options.map((option) => (
        <MenuButton key={option.id} color={option.color} onClick={option.onCycle}>
          {option.label}
        </MenuButton>
      ))}
      <MenuButton onClick={onStart}>{startLabel}</MenuButton>
      <MenuButton color="purple" onClick={onBack}>
        {backLabel}
      </MenuButton>
    </div>
  );
}
