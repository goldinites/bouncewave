import { ChallengeId, ChallengeTier } from '@/match/challenges';
import { ChallengeState } from '@/profile/ChallengeProgress';
import { ButtonColor } from '@/ui/UIManager';
import { MenuButton } from '@/ui/screens/MenuButton';

export interface ChallengeListEntry {
  id: ChallengeId;
  name: string;
  state: ChallengeState;
}

/** A tier of the list, as its tab shows it. */
export interface ChallengeTierTab {
  id: ChallengeTier;
  name: string;
  /** Its challenges passed, of them all. */
  passed: number;
  total: number;
}

export interface ChallengeListProps {
  /** Every tier, easiest first, and the one shown. */
  tiers: readonly ChallengeTierTab[];
  tier: ChallengeTier;
  onTier: (tier: ChallengeTier) => void;
  /** The shown tier's challenges, easiest first. */
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
 * The challenges from easiest to hardest a tier at a time (six, on its backdrop), three to a row,
 * every one open, the passed ones ticked. The tiers are tabs over them, all in sight with how many
 * of each are passed: the whole road at a glance, any tier a tap away. The count of passed ones
 * is the screen's subtitle. Texts come in ready to show.
 */
export function ChallengeList({
  tiers,
  tier,
  onTier,
  challenges,
  backLabel,
  onPick,
  onBack,
}: ChallengeListProps) {
  return (
    <div class="challenge-list">
      <div class="challenge-tabs" role="tablist">
        {tiers.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === tier}
            class={[
              'challenge-tabs__tab',
              tab.id === tier && 'challenge-tabs__tab--current',
              tab.passed === tab.total && 'challenge-tabs__tab--done',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onTier(tab.id)}
          >
            {tab.name}{' '}
            <span class="challenge-tabs__count">
              {tab.passed}/{tab.total}
            </span>
          </button>
        ))}
      </div>
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
