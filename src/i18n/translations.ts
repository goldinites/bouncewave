import { DifficultyLevel } from '@/match/difficulty';
import { WINNING_SCORE } from '@/match/config';
export type Language = 'en' | 'ru';

export type DifficultyDescription = [name: string, description: string];

export interface TranslationSchema {
  play: string;
  settings: string;
  again: string;
  resume: string;
  menu: string;
  back: string;
  diff: string;
  sound: string;
  music: string;
  /** The now-playing chip's skip button. */
  next: string;
  on: string;
  off: string;
  lang: string;
  lang_name: string;
  pause: string;
  win: string;
  lose: string;
  ready: string;
  /** Shown instead of `ready` before the point that decides the match. */
  decider: string;
  /** Controls and rules under the court, as HTML: a row of keycaps, then a line of rules. */
  hintK: string;
  hintT: string;
  /** Name and description of every difficulty level, by level. */
  d: Record<DifficultyLevel, DifficultyDescription>;
}

export const TRANSLATIONS: Record<Language, TranslationSchema> = {
  en: {
    play: 'PLAY',
    settings: 'SETTINGS',
    again: 'PLAY AGAIN',
    resume: 'RESUME',
    menu: 'MAIN MENU',
    back: 'BACK',
    diff: 'DIFFICULTY',
    sound: 'SOUND EFFECTS',
    music: 'MUSIC',
    next: 'NEXT TRACK',
    on: 'ON',
    off: 'OFF',
    lang: 'LANGUAGE',
    lang_name: 'ENGLISH',
    pause: 'PAUSED',
    win: 'YOU WIN',
    lose: 'GAME OVER',
    ready: 'GET READY',
    decider: 'MATCH POINT',
    hintK: `<span class="game-hint__keys"><span><kbd>W</kbd><kbd>S</kbd><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Esc</kbd> pause</span><span><kbd>F</kbd> fullscreen</span><span><kbd>M</kbd> music</span><span><kbd>N</kbd> next track</span></span><span class="game-hint__rules">First to ${WINNING_SCORE} · paddle center = perfect shot · 3 in a row = Overdrive</span>`,
    hintT: `<span class="game-hint__keys">Drag your finger to move the paddle</span><span class="game-hint__rules">First to ${WINNING_SCORE} · paddle center = perfect shot</span>`,
    d: {
      [DifficultyLevel.NORMAL]: ['NORMAL', 'vs CPU: a balanced opponent'],
      [DifficultyLevel.HARD]: ['HARD', 'vs CPU: fast and accurate'],
      [DifficultyLevel.INSANE]: ['INSANE', 'vs CPU: barely makes mistakes'],
    },
  },
  ru: {
    play: 'ИГРАТЬ',
    settings: 'НАСТРОЙКИ',
    again: 'ИГРАТЬ СНОВА',
    resume: 'ПРОДОЛЖИТЬ',
    menu: 'В МЕНЮ',
    back: 'НАЗАД',
    diff: 'СЛОЖНОСТЬ',
    sound: 'ЗВУКОВЫЕ ЭФФЕКТЫ',
    music: 'МУЗЫКА',
    next: 'СЛЕДУЮЩИЙ ТРЕК',
    on: 'ВКЛ',
    off: 'ВЫКЛ',
    lang: 'ЯЗЫК',
    lang_name: 'РУССКИЙ',
    pause: 'ПАУЗА',
    win: 'YOU WIN',
    lose: 'GAME OVER',
    ready: 'GET READY',
    decider: 'MATCH POINT',
    hintK: `<span class="game-hint__keys"><span><kbd>W</kbd><kbd>S</kbd><kbd>↑</kbd><kbd>↓</kbd> ракетка</span><span><kbd>Esc</kbd> пауза</span><span><kbd>F</kbd> полный экран</span><span><kbd>M</kbd> музыка</span><span><kbd>N</kbd> следующий трек</span></span><span class="game-hint__rules">До ${WINNING_SCORE} очков · центр ракетки — идеальный удар · 3 подряд — Overdrive</span>`,
    hintT: `<span class="game-hint__keys">Двигайте ракетку пальцем</span><span class="game-hint__rules">До ${WINNING_SCORE} очков · центр ракетки — идеальный удар</span>`,
    d: {
      [DifficultyLevel.NORMAL]: ['СРЕДНЯЯ', 'Против CPU: сбалансированный соперник'],
      [DifficultyLevel.HARD]: ['СЛОЖНАЯ', 'Против CPU: быстрый и точный'],
      [DifficultyLevel.INSANE]: ['БЕЗУМИЕ', 'Против CPU: почти не ошибается'],
    },
  },
};

/** Every language there is a dictionary for. */
export const LANGUAGES = Object.keys(TRANSLATIONS) as Language[];

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language);
}

/** The next language in the list, wrapping around. */
export function nextLanguage(language: Language): Language {
  return LANGUAGES[(LANGUAGES.indexOf(language) + 1) % LANGUAGES.length];
}
