import { MenuButton } from '@/ui/screens/MenuButton';

export interface ChallengeCardProps {
  /** What the match is and what passing it brings, as label and value. */
  rows: readonly { label: string; value: string }[];
  /** Shown when the challenge has been passed already (it can be played again). */
  passedLabel: string | null;
  startLabel: string;
  backLabel: string;
  onStart: () => void;
  onBack: () => void;
}

/**
 * A challenge's card under its name and goal (the screen's title and subtitle): its match and its
 * reward, whether it is passed, then START and BACK. Texts come in ready to show.
 */
export function ChallengeCard({
  rows,
  passedLabel,
  startLabel,
  backLabel,
  onStart,
  onBack,
}: ChallengeCardProps) {
  return (
    <div class="challenge-card">
      <dl class="challenge-card__rows">
        {rows.map((row) => (
          <div key={row.label} class="challenge-card__row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {passedLabel && <p class="challenge-card__passed">{passedLabel}</p>}
      <div class="screen-buttons">
        <MenuButton onClick={onStart}>{startLabel}</MenuButton>
        <MenuButton color="purple" onClick={onBack}>
          {backLabel}
        </MenuButton>
      </div>
    </div>
  );
}
