import { MenuButton } from '@/ui/screens/MenuButton';
import { Choice, OptionRow } from '@/ui/screens/OptionRow';

export interface QuickMatchSetupProps {
  options: readonly Choice[];
  /** The arrows' names for screen readers. */
  previousLabel: string;
  nextLabel: string;
  startLabel: string;
  backLabel: string;
  onStart: () => void;
  onBack: () => void;
}

/** The quick match's setup: a row per choice (background, difficulty, points), START and BACK. */
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
      {options.map((option) => (
        <OptionRow
          key={option.id}
          choice={option}
          previousLabel={previousLabel}
          nextLabel={nextLabel}
        />
      ))}
      {/* Under the choices, or beside each other where height is short (menu.css) */}
      <div class="screen-buttons__actions">
        <MenuButton onClick={onStart}>{startLabel}</MenuButton>
        <MenuButton color="purple" onClick={onBack}>
          {backLabel}
        </MenuButton>
      </div>
    </div>
  );
}
