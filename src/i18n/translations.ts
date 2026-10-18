import { ChallengeId } from '@/match/challenges';
import { DifficultyLevel } from '@/match/difficulty';
import { ModeId } from '@/match/modes';
import { BackgroundChoice } from '@/shared/scenes';
export type Language = 'en' | 'ru';

export type DifficultyDescription = [name: string, description: string];

/** A challenge's name, and what it takes to pass it. */
export type ChallengeDescription = [name: string, goal: string];

export interface TranslationSchema {
  play: string;
  settings: string;
  again: string;
  resume: string;
  restart: string;
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
  /** The pause button's label for screen readers. */
  pauseButton: string;
  win: string;
  lose: string;
  ready: string;
  /** Shown instead of `ready` before the point that decides the match. */
  decider: string;
  /** Controls and rules under the court, as HTML: a row of keycaps, then a line of rules. */
  hintK: string;
  hintT: string;
  /** The PLAY menu's title. */
  mode: string;
  /** Every game mode's name, by mode. */
  modes: Record<ModeId, string>;
  /** The quick match's setup: its title is the mode's name; its options and start button. */
  background: string;
  points: string;
  start: string;
  /** The arrows either side of a quick match choice, for screen readers. */
  previousChoice: string;
  nextChoice: string;
  /** The statistics screen: its title (and the main menu's button), and its rows. */
  stats: string;
  statPlayed: string;
  statWon: string;
  statStreak: string;
  statBestStreak: string;
  statRally: string;
  statPerfect: string;
  statPower: string;
  statByDifficulty: string;
  /** Wiping the statistics: the button, and what it asks before it does. */
  resetStats: string;
  resetStatsConfirm: string;
  /** Local multiplayer, on the main menu before it is playable (stage 3). */
  multiplayer: string;
  /** Every backdrop's name, and random's, by choice. */
  backgrounds: Record<BackgroundChoice, string>;
  /** Name and description of every difficulty level, by level. */
  d: Record<DifficultyLevel, DifficultyDescription>;
  /** Name and goal of every challenge, by challenge. */
  challenges: Record<ChallengeId, ChallengeDescription>;
}

export const TRANSLATIONS: Record<Language, TranslationSchema> = {
  en: {
    play: 'PLAY',
    settings: 'SETTINGS',
    again: 'PLAY AGAIN',
    resume: 'RESUME',
    restart: 'RESTART',
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
    pauseButton: 'Pause',
    win: 'YOU WIN',
    lose: 'GAME OVER',
    ready: 'GET READY',
    decider: 'MATCH POINT',
    hintK: `<span class="game-hint__keys"><span><kbd>W</kbd><kbd>S</kbd><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Esc</kbd> pause</span><span><kbd>F</kbd> fullscreen</span><span><kbd>M</kbd> music</span><span><kbd>N</kbd> next track</span></span><span class="game-hint__rules">Paddle center = perfect shot · 3&nbsp;in&nbsp;a&nbsp;row&nbsp;=&nbsp;Overdrive</span>`,
    hintT: `<span class="game-hint__keys">Drag your finger to move the paddle</span><span class="game-hint__rules">Paddle center = perfect shot · 3&nbsp;in&nbsp;a&nbsp;row&nbsp;=&nbsp;Overdrive</span>`,
    mode: 'GAME MODE',
    modes: { story: 'STORY', challenges: 'CHALLENGE', quick: 'QUICK MATCH' },
    background: 'BACKGROUND',
    points: 'POINTS',
    start: 'START',
    previousChoice: 'Previous',
    nextChoice: 'Next',
    stats: 'STATISTICS',
    statPlayed: 'MATCHES',
    statWon: 'WINS',
    statStreak: 'WIN STREAK',
    statBestStreak: 'BEST STREAK',
    statRally: 'LONGEST RALLY',
    statPerfect: 'PERFECT HITS',
    statPower: 'OVERDRIVE SHOTS',
    statByDifficulty: 'WINS BY DIFFICULTY',
    resetStats: 'RESET',
    resetStatsConfirm: 'SURE? RESET',
    multiplayer: 'MULTIPLAYER',
    backgrounds: {
      random: 'RANDOM',
      lasers: 'LASERS',
      memphis: 'MEMPHIS',
      outrun: 'OUTRUN',
      neonCity: 'NEON CITY',
      fuji: 'FUJI',
      jungle: 'JUNGLE',
    },
    d: {
      [DifficultyLevel.NORMAL]: ['NORMAL', 'vs CPU: a balanced opponent'],
      [DifficultyLevel.HARD]: ['HARD', 'vs CPU: fast and accurate'],
      [DifficultyLevel.INSANE]: ['INSANE', 'vs CPU: barely makes mistakes'],
    },
    challenges: {
      warmUp: ['WARM-UP', 'Win the match'],
      blitz: ['BLITZ', 'Win in two minutes: first to 5, or ahead when time is up'],
      longRally: ['LONG RALLY', 'Keep a rally going for 20 hits within a minute'],
      shutout: ['SHUTOUT', 'Win without losing a point'],
      twoBalls: ['TWO BALLS', 'Win with two balls in play'],
      survival: ['SURVIVAL', 'Score 15 points before you lose three lives'],
      giant: ['GIANT', 'Win against a CPU with a paddle half as long again'],
      overload: ['OVERLOAD', 'Win with 5 Overdrive shots'],
      insanity: ['INSANITY', 'Win on Insane'],
    },
  },
  ru: {
    play: 'ИГРАТЬ',
    settings: 'НАСТРОЙКИ',
    again: 'ИГРАТЬ СНОВА',
    resume: 'ПРОДОЛЖИТЬ',
    restart: 'ЗАНОВО',
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
    pauseButton: 'Пауза',
    win: 'YOU WIN',
    lose: 'GAME OVER',
    ready: 'GET READY',
    decider: 'MATCH POINT',
    hintK: `<span class="game-hint__keys"><span><kbd>W</kbd><kbd>S</kbd><kbd>↑</kbd><kbd>↓</kbd> ракетка</span><span><kbd>Esc</kbd> пауза</span><span><kbd>F</kbd> полный экран</span><span><kbd>M</kbd> музыка</span><span><kbd>N</kbd> следующий трек</span></span><span class="game-hint__rules">Центр ракетки — идеальный удар · 3&nbsp;подряд&nbsp;—&nbsp;Overdrive</span>`,
    hintT: `<span class="game-hint__keys">Двигайте ракетку пальцем</span><span class="game-hint__rules">Центр ракетки — идеальный удар · 3&nbsp;подряд&nbsp;—&nbsp;Overdrive</span>`,
    mode: 'РЕЖИМ ИГРЫ',
    modes: { story: 'СЮЖЕТ', challenges: 'ИСПЫТАНИЕ', quick: 'БЫСТРЫЙ МАТЧ' },
    background: 'ФОН',
    points: 'ОЧКИ',
    start: 'НАЧАТЬ',
    previousChoice: 'Предыдущий вариант',
    nextChoice: 'Следующий вариант',
    stats: 'СТАТИСТИКА',
    statPlayed: 'МАТЧИ',
    statWon: 'ПОБЕДЫ',
    statStreak: 'СЕРИЯ ПОБЕД',
    statBestStreak: 'ЛУЧШАЯ СЕРИЯ',
    statRally: 'ДЛИННЕЙШИЙ РОЗЫГРЫШ',
    statPerfect: 'ИДЕАЛЬНЫЕ УДАРЫ',
    statPower: 'УДАРЫ OVERDRIVE',
    statByDifficulty: 'ПОБЕДЫ ПО СЛОЖНОСТИ',
    resetStats: 'СБРОСИТЬ',
    resetStatsConfirm: 'ТОЧНО СБРОСИТЬ?',
    multiplayer: 'МУЛЬТИПЛЕЕР',
    backgrounds: {
      random: 'СЛУЧАЙНЫЙ',
      lasers: 'ЛАЗЕРНЫЙ',
      memphis: 'МЕМФИС',
      outrun: 'АУТРАН',
      neonCity: 'ГОРОД',
      fuji: 'ФУДЗИ',
      jungle: 'ДЖУНГЛИ',
    },
    d: {
      [DifficultyLevel.NORMAL]: ['СРЕДНЯЯ', 'Против CPU: сбалансированный соперник'],
      [DifficultyLevel.HARD]: ['СЛОЖНАЯ', 'Против CPU: быстрый и точный'],
      [DifficultyLevel.INSANE]: ['БЕЗУМИЕ', 'Против CPU: почти не ошибается'],
    },
    challenges: {
      warmUp: ['РАЗМИНКА', 'Выиграй матч'],
      blitz: ['БЛИЦ', 'Выиграй за две минуты: до 5 очков или по счёту в конце'],
      longRally: ['ДОЛГИЙ РОЗЫГРЫШ', 'Розыгрыш в 20 ударов за минуту'],
      shutout: ['ВСУХУЮ', 'Выиграй, не пропустив ни одного очка'],
      twoBalls: ['ДВА МЯЧА', 'Выиграй, когда в игре два мяча'],
      survival: ['ВЫЖИВАНИЕ', 'Набери 15 очков, пока не кончились три жизни'],
      giant: ['ВЕЛИКАН', 'Выиграй у CPU с ракеткой в полтора раза длиннее'],
      overload: ['ПЕРЕГРУЗКА', 'Выиграй, сделав 5 ударов Overdrive'],
      insanity: ['БЕЗУМИЕ', 'Выиграй на безумной сложности'],
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
