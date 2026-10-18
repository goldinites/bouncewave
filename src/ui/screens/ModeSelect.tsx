import { ModeId } from '@/match/modes';
import { ButtonColor } from '@/ui/UIManager';

export interface ModeCard {
  id: ModeId;
  name: string;
  description: string;
  color: ButtonColor;
}

/** A button's classes for its color: cyan is the plain button's own. */
const buttonClass = (color: ButtonColor) =>
  color === 'cyan' ? 'game-button' : `game-button game-button--${color}`;

export interface ModeSelectProps {
  modes: readonly ModeCard[];
  backLabel: string;
  onPick: (mode: ModeId) => void;
  onBack: () => void;
}

/**
 * The mode screen: a card per mode, its name over what it is, then BACK. Texts come in ready
 * to show, so the screen knows nothing of languages.
 */
export function ModeSelect({ modes, backLabel, onPick, onBack }: ModeSelectProps) {
  return (
    <div class="mode-select">
      <ul class="mode-select__list">
        {modes.map((mode) => (
          <li key={mode.id}>
            <button
              type="button"
              class={`${buttonClass(mode.color)} mode-card`}
              onClick={() => onPick(mode.id)}
            >
              <span class="mode-card__name">{mode.name}</span>
              <span class="mode-card__description">{mode.description}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" class="game-button" onClick={onBack}>
        {backLabel}
      </button>
    </div>
  );
}
