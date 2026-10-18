import { MenuButton } from '@/ui/screens/MenuButton';

export interface StatsSection {
  /** Left out for the first, the overall record. */
  heading?: string;
  rows: readonly { label: string; value: string }[];
}

export interface StatsScreenProps {
  sections: readonly StatsSection[];
  backLabel: string;
  onBack: () => void;
}

/**
 * The player's statistics: sections of label and value, side by side where the court is wide
 * enough and one under another where it isn't, then BACK. Texts come in ready to show.
 */
export function StatsScreen({ sections, backLabel, onBack }: StatsScreenProps) {
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
      <div class="screen-buttons">
        <MenuButton onClick={onBack}>{backLabel}</MenuButton>
      </div>
    </div>
  );
}
