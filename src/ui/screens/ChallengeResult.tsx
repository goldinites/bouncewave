import { ButtonColor } from '@/ui/UIManager';
import { MenuButton } from '@/ui/screens/MenuButton';

export interface ChallengeResultAction {
  id: string;
  label: string;
  color: ButtonColor;
  onClick: () => void;
}

export interface ChallengeResultProps {
  /** What the attempt came to: what passing it opened, or what it fell short by. */
  message: string;
  /** Whether the message announces something just opened, which comes in with a flourish. */
  isUnlock: boolean;
  actions: readonly ChallengeResultAction[];
}

/**
 * How an attempt went, in place of the game-over menu, under PASSED! or NOT PASSED (the screen's
 * title): what it opened or fell short by, then the way on. Texts come in ready to show.
 */
export function ChallengeResult({ message, isUnlock, actions }: ChallengeResultProps) {
  return (
    <div class="challenge-result">
      <p class={`challenge-result__message${isUnlock ? ' challenge-result__message--unlock' : ''}`}>
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
