import { ModeId } from '@/match/modes';

export interface ModeCard {
  id: ModeId;
  name: string;
  description: string;
}

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
            <button type="button" class="game-button mode-card" onClick={() => onPick(mode.id)}>
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
