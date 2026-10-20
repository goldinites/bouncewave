import { useState } from 'preact/hooks';
import { MenuButton } from '@/ui/screens/MenuButton';

export interface StatsSection {
  /** Left out for the first, the overall record. */
  heading?: string;
  rows: readonly { label: string; value: string }[];
}

export interface StatsScreenProps {
  sections: readonly StatsSection[];
  /**
   * The reset button, and what it says once pressed, asking to be pressed again; none when left
   * out (the controls, listed the same way).
   */
  reset?: { label: string; confirmLabel: string; onReset: () => void };
  backLabel: string;
  onBack: () => void;
}

/**
 * The player's statistics: sections of label and value, side by side where the court is wide
 * enough and one under another where it isn't, then RESET and BACK. RESET wipes them only when
 * pressed twice: the first press asks. Texts come in ready to show. The controls screen lists its
 * rows the same way, with no RESET.
 */
export function StatsScreen({ sections, reset, backLabel, onBack }: StatsScreenProps) {
  const [isConfirming, setConfirming] = useState(false);
  const pressReset = () => {
    if (!reset) return;
    if (!isConfirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    reset.onReset();
  };

  return (
    <div class="stats">
      <div class="stats__sections">
        {sections.map((section, index) => (
          <section key={index} class="stats__section">
            {section.heading && <h2 class="stats__heading">{section.heading}</h2>}
            <dl class="stats__rows">
              {section.rows.map((row) => (
                <div key={row.label} class="stats__row">
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <div class="screen-buttons stats__buttons">
        {reset && (
          <MenuButton color="pink" onClick={pressReset}>
            {isConfirming ? reset.confirmLabel : reset.label}
          </MenuButton>
        )}
        <MenuButton onClick={onBack}>{backLabel}</MenuButton>
      </div>
    </div>
  );
}
