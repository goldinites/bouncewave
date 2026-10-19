import { ButtonColor } from '@/ui/UIManager';
import { MenuButton } from '@/ui/screens/MenuButton';

export interface ChallengeResultAction {
  id: string;
  label: string;
  color: ButtonColor;
  onClick: () => void;
}

export interface ChallengeResultProps {
  /** What the attempt came to: what it fell short by, or that every challenge is passed. */
  message: string;
  /** Whether the message celebrates (every challenge passed): it comes in with a flourish. */
  isCelebration: boolean;
  actions: readonly ChallengeResultAction[];
}

/**
 * How an attempt went, in place of the game-over menu, under PASSED! or NOT PASSED (the screen's
 * title): what it fell short by, if anything, then the way on. Texts come in ready to show.
 */
export function ChallengeResult({ message, isCelebration, actions }: ChallengeResultProps) {
  return (
    <div class="challenge-result">
      <p
        class={`challenge-result__message${isCelebration ? ' challenge-result__message--celebration' : ''}`}
      >
        {message}
      </p>
      <div class="screen-buttons">
        {actions.map((action) => (
          <MenuButton key={action.id} color={action.color} onClick={action.onClick}>
            {action.label}
          </MenuButton>
        ))}
      </div>
    </div>
  );
}
