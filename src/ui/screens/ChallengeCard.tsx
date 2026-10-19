import { MenuButton } from '@/ui/screens/MenuButton';

export interface ChallengeCardProps {
  /** Shown when the challenge has been passed already (it can be played again). */
  passedLabel: string | null;
  startLabel: string;
  backLabel: string;
  onStart: () => void;
  onBack: () => void;
}

/**
 * A challenge's card under its name and description (the screen's title and subtitle): whether
 * it is passed, then START and BACK. Texts come in ready to show.
 */
export function ChallengeCard({
  passedLabel,
  startLabel,
  backLabel,
  onStart,
  onBack,
}: ChallengeCardProps) {
  return (
    <div class="challenge-card">
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
