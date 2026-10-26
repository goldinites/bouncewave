import { I18nManager } from '@/i18n/I18nManager';
import { LANGUAGES, TRANSLATIONS } from '@/i18n/translations';
import { DIFFICULTY_LEVELS } from '@/match/difficulty';
import { MATCH_POINTS } from '@/match/modes';
import { UserSettings } from '@/settings/UserSettings';
import { Look } from '@/shared/look';
import { BACKGROUND_CHOICES } from '@/shared/scenes';
import { Volume, VOLUMES } from '@/shared/volume';
import { MenuContext } from '@/ui/menus/MenuContext';
import { Choice } from '@/ui/screens/OptionRow';
import { ButtonColor } from '@/ui/UIManager';

/** A setting picked from a list: its name and value between arrows that step it either way. */
export interface ChoiceEntry {
  kind: 'choice';
  key: keyof UserSettings;
  name: (i18n: I18nManager) => string;
  value: (settings: UserSettings, i18n: I18nManager) => string;
  /** Every value it can show, so its row keeps the widest one's room. */
  values: (i18n: I18nManager) => string[];
  color: ButtonColor;
  /** A hit plays after the change, at the volume it set (the sound volume). */
  previews?: boolean;
}

/** A volume as the settings show it: in percent, OFF at none. */
const volumeText = (i18n: I18nManager, volume: Volume) =>
  volume === 0 ? i18n.t('off') : `${volume}%`;

/** The settings menu, top to bottom. */
export const SETTINGS_MENU: ChoiceEntry[] = [
  {
    kind: 'choice',
    key: 'musicVolume',
    color: 'pink',
    name: (i18n) => i18n.t('music'),
    value: (s, i18n) => volumeText(i18n, s.musicVolume),
    values: (i18n) => VOLUMES.map((volume) => volumeText(i18n, volume)),
  },
  {
    kind: 'choice',
    key: 'soundVolume',
    color: 'purple',
    name: (i18n) => i18n.t('sound'),
    value: (s, i18n) => volumeText(i18n, s.soundVolume),
    values: (i18n) => VOLUMES.map((volume) => volumeText(i18n, volume)),
    previews: true,
  },
  {
    kind: 'choice',
    key: 'language',
    color: 'green',
    name: (i18n) => i18n.t('lang'),
    value: (_, i18n) => i18n.t('lang_name'),
    // Each language is named in itself, whichever the menus are in
    values: () => LANGUAGES.map((language) => TRANSLATIONS[language].lang_name),
  },
];

/**
 * The quick match's choices, top to bottom. They are kept with the settings, so the next quick
 * match is set up as the last one was.
 */
export const QUICK_MATCH_SETUP: ChoiceEntry[] = [
  {
    kind: 'choice',
    key: 'matchBackground',
    color: 'green',
    name: (i18n) => i18n.t('background'),
    value: (s, i18n) => i18n.getBackgroundName(s.matchBackground),
    values: (i18n) => BACKGROUND_CHOICES.map((choice) => i18n.getBackgroundName(choice)),
  },
  {
    kind: 'choice',
    key: 'difficulty',
    color: 'yellow',
    name: (i18n) => i18n.t('diff'),
    value: (s, i18n) => i18n.getDifficultyInfo(s.difficulty)[0],
    values: (i18n) => DIFFICULTY_LEVELS.map((level) => i18n.getDifficultyInfo(level)[0]),
  },
  {
    kind: 'choice',
    key: 'matchPoints',
    color: 'pink',
    name: (i18n) => i18n.t('points'),
    value: (s) => String(s.matchPoints),
    values: () => MATCH_POINTS.map(String),
  },
];

/**
 * The choices of a match of two players: the quick match's, but its difficulty, which sets how
 * well the CPU plays. They share the settings with it: the backdrop and length the players like.
 */
export const TWO_PLAYER_SETUP = (): ChoiceEntry[] =>
  QUICK_MATCH_SETUP.filter((entry) => entry.key !== 'difficulty');

/** A match's setup in a look: the classic one draws no backdrop, so it has none to choose. */
export const setupIn = (look: Look, entries: ChoiceEntry[]): ChoiceEntry[] =>
  look === 'classic' ? entries.filter((entry) => entry.key !== 'matchBackground') : entries;

/**
 * A choice as its row shows it, its arrows stepping the setting either way; the screen showing
 * it is drawn again by itself.
 */
export function choiceOf(
  { i18n, settings: store, actions }: MenuContext,
  entry: ChoiceEntry,
  settings: UserSettings,
): Choice {
  const change = (step: 1 | -1) => {
    store.cycle(entry.key, step);
    // Silent at none
    if (entry.previews) actions.onSoundVolume?.();
  };
  return {
    id: entry.key,
    name: entry.name(i18n),
    value: entry.value(settings, i18n),
    values: entry.values(i18n),
    color: entry.color,
    onNext: () => change(1),
    onPrevious: () => change(-1),
  };
}
