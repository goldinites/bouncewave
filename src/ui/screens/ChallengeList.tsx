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
  /** Every challenge, in the order they open. */
  challenges: readonly ChallengeListEntry[];
  backLabel: string;
  onPick: (challenge: ChallengeId) => void;
  onBack: () => void;
}

/** Passed ones in green, the open one in the menus' cyan, locked ones dimmed. */
const STATE_COLORS: Record<ChallengeState, ButtonColor> = {
  passed: 'green',
  open: 'cyan',
  locked: 'purple',
};

/** A tick for a passed challenge, a padlock for a locked one, in the button's color. */
const Mark = ({ state }: { state: ChallengeState }) =>
  state === 'open' ? null : (
    <svg class="challenge-list__mark" viewBox="0 0 16 16" aria-hidden="true">
      {state === 'passed' ? (
        <path d="M3 8.5 6.5 12 13 4.5" />
      ) : (
        <path d="M4 7.5h8v6H4zM5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5" />
      )}
    </svg>
  );

/**
 * The challenges in the order they open, in a grid where the court is wide: the passed ones
 * ticked, the next one open, the rest locked (their names shown, but they can't be picked). The
 * count of passed ones is the screen's subtitle. Texts come in ready to show.
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
            disabled={challenge.state === 'locked'}
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
