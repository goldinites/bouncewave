import { ModeId } from '@/match/modes';
import { ButtonColor } from '@/ui/UIManager';
import { MenuButton } from '@/ui/screens/MenuButton';

export interface PlayMenuEntry {
  id: ModeId;
  name: string;
  color: ButtonColor;
  isPlayable: boolean;
}

export interface PlayMenuProps {
  modes: readonly PlayMenuEntry[];
  backLabel: string;
  onPick: (mode: ModeId) => void;
  onBack: () => void;
}

/**
 * The PLAY menu: a button per mode, those not playable yet shown but switched off, then BACK.
 * Texts come in ready to show, so the screen knows nothing of languages.
 */
export function PlayMenu({ modes, backLabel, onPick, onBack }: PlayMenuProps) {
  return (
    <div class="screen-buttons">
      {modes.map((mode) => (
        <MenuButton
          key={mode.id}
          color={mode.color}
          disabled={!mode.isPlayable}
          onClick={() => onPick(mode.id)}
        >
          {mode.name}
        </MenuButton>
      ))}
      <MenuButton onClick={onBack}>{backLabel}</MenuButton>
    </div>
  );
}
