import { ChallengeId } from '@/match/challenges';
import { ChallengeState } from '@/profile/ChallengeProgress';
import { ButtonColor } from '@/ui/UIManager';
import { MenuButton } from '@/ui/screens/MenuButton';

export interface ChallengeListEntry {
  id: ChallengeId;
  name: string;
  state: ChallengeState;
}

export interface ChallengeListProps {
  /** Every challenge, easiest first. */
  challenges: readonly ChallengeListEntry[];
  backLabel: string;
  onPick: (challenge: ChallengeId) => void;
  onBack: () => void;
}

/** Passed ones in green, the ones still to pass in the menus' cyan. */
const STATE_COLORS: Record<ChallengeState, ButtonColor> = {
  passed: 'green',
  open: 'cyan',
};

/** A tick for a passed challenge, in the button's color. */
const Mark = ({ state }: { state: ChallengeState }) =>
  state === 'passed' ? (
    <svg class="challenge-list__mark" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  ) : null;

/**
 * The challenges from easiest to hardest, three to a row, every one open; the passed ones ticked.
 * The count of passed ones is the screen's subtitle. Texts come in ready to show.
 */
export function ChallengeList({ challenges, backLabel, onPick, onBack }: ChallengeListProps) {
  return (
    <div class="challenge-list">
      <div class="challenge-list__grid">
        {challenges.map((challenge) => (
          <MenuButton
            key={challenge.id}
            color={STATE_COLORS[challenge.state]}
            class={`challenge-list__item challenge-list__item--${challenge.state}`}
            onClick={() => onPick(challenge.id)}
          >
            {challenge.name}
            <Mark state={challenge.state} />
          </MenuButton>
        ))}
      </div>
      <div class="screen-buttons">
        <MenuButton onClick={onBack}>{backLabel}</MenuButton>
      </div>
    </div>
  );
}
