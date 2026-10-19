import { ChallengeId } from '@/match/challenges';
import { DifficultyLevel } from '@/match/difficulty';
import { ModeId } from '@/match/modes';
import { BackgroundChoice } from '@/shared/scenes';
export type Language = 'en' | 'ru';

export type DifficultyDescription = [name: string, description: string];

/** A challenge's name, and what it takes to pass it and what sets its match apart. */
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
  /**
   * The challenges' screens; a text's `{placeholders}` are filled by `I18nManager.format`.
   * The list's count and the statistics' heading and row, as "PASSED: 4 / 9".
   */
  challengesHeading: string;
  challengesPassed: string;
  /** An attempt's outcome: passed or not, every challenge passed, and its buttons. */
  attemptPassed: string;
  attemptFailed: string;
  attemptAllPassed: string;
  nextChallenge: string;
  tryAgain: string;
  toChallenges: string;
  /** A challenge's condition in the HUD, as it stands: "RALLY 12 / 20 · 0:41". */
  hudRally: string;
  hudPowerShots: string;
  hudPoints: string;
  /** What a failed attempt fell short by: how far it got toward the goal, or what spoilt it. */
  shortRally: string;
  shortPoints: string;
  shortPowerShots: string;
  shortConceded: string;
  shortLost: string;
  /** Every backdrop's name, and random's, by choice. */
  backgrounds: Record<BackgroundChoice, string>;
  /** Name and description of every difficulty level, by level. */
  d: Record<DifficultyLevel, DifficultyDescription>;
  /**
   * Name and description of every challenge, by challenge. The description is all the card says
   * of it: its goal and whatever sets its match apart (points to win, clock, level, paddles).
   */
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
    challengesHeading: 'CHALLENGES',
    challengesPassed: 'PASSED',
    attemptPassed: 'PASSED!',
    attemptFailed: 'NOT PASSED',
    attemptAllPassed: 'EVERY CHALLENGE PASSED',
    nextChallenge: 'NEXT',
    tryAgain: 'TRY AGAIN',
    toChallenges: 'ALL CHALLENGES',
    hudRally: 'RALLY {n} / {target}',
    hudPowerShots: 'OVERDRIVE {n} / {target}',
    hudPoints: 'POINTS {n} / {target}',
    shortRally: 'RALLY: {n} OF {target}',
    shortPoints: 'POINTS: {n} OF {target}',
    shortPowerShots: 'OVERDRIVE SHOTS: {n} OF {target}',
    shortConceded: 'A POINT WAS LOST',
    shortLost: 'THE MATCH WAS LOST',
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
      [DifficultyLevel.EASY]: ['EASY', 'Opponent: calm, to warm up on'],
      [DifficultyLevel.NORMAL]: ['NORMAL', 'Opponent: balanced'],
      [DifficultyLevel.HARD]: ['HARD', 'Opponent: fast and accurate'],
      [DifficultyLevel.INSANE]: ['INSANE', 'Opponent: barely makes mistakes'],
    },
    challenges: {
      warmUp: ['WARM-UP', 'Win a match to 3 points'],
      blitz: ['BLITZ', 'Win to 3 before the two minutes are up'],
      longRally: ['LONG RALLY', 'Keep a rally going for 20 hits within a minute'],
      shutout: ['SHUTOUT', 'Win to 3 without losing a single point'],
      twoBalls: ['TWO BALLS', 'Win to 5 with two balls in play at once'],
      survival: [
        'SURVIVAL',
        'Score 10 before you lose three lives; the opponent grows stronger every point',
      ],
      giant: ['GIANT', 'Win to 5 against a Normal opponent whose paddle is half as long again'],
      overload: ['OVERLOAD', 'Beat a Normal opponent to 7, landing 5 Overdrive shots'],
      insanity: ['INSANITY', 'Win to 5 against an Insane opponent'],
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
    challengesHeading: 'ИСПЫТАНИЯ',
    challengesPassed: 'ПРОЙДЕНО',
    attemptPassed: 'ПРОЙДЕНО!',
    attemptFailed: 'НЕ ПРОЙДЕНО',
    attemptAllPassed: 'ВСЕ ИСПЫТАНИЯ ПРОЙДЕНЫ',
    nextChallenge: 'СЛЕДУЮЩЕЕ',
    tryAgain: 'ЕЩЁ РАЗ',
    toChallenges: 'К СПИСКУ',
    hudRally: 'РОЗЫГРЫШ {n} / {target}',
    hudPowerShots: 'OVERDRIVE {n} / {target}',
    hudPoints: 'ОЧКИ {n} / {target}',
    shortRally: 'РОЗЫГРЫШ: {n} ИЗ {target}',
    shortPoints: 'ОЧКИ: {n} ИЗ {target}',
    shortPowerShots: 'УДАРЫ OVERDRIVE: {n} ИЗ {target}',
    shortConceded: 'ПРОПУЩЕНО ОЧКО',
    shortLost: 'МАТЧ ПРОИГРАН',
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
      [DifficultyLevel.EASY]: ['ЛЁГКАЯ', 'Противник: спокойный, чтобы освоиться'],
      [DifficultyLevel.NORMAL]: ['СРЕДНЯЯ', 'Противник: сбалансированный'],
      [DifficultyLevel.HARD]: ['СЛОЖНАЯ', 'Противник: быстрый и точный'],
      [DifficultyLevel.INSANE]: ['БЕЗУМИЕ', 'Противник: почти не ошибается'],
    },
    challenges: {
      warmUp: ['РАЗМИНКА', 'Выиграй матч до 3 очков'],
      blitz: ['БЛИЦ', 'Выиграй до 3 очков, пока не прошли две минуты'],
      longRally: ['ДОЛГИЙ РОЗЫГРЫШ', 'Розыгрыш в 20 ударов за минуту'],
      shutout: ['ВСУХУЮ', 'Выиграй до 3 очков, не пропустив ни одного'],
      twoBalls: ['ДВА МЯЧА', 'Выиграй до 5 очков, когда в игре сразу два мяча'],
      survival: [
        'ВЫЖИВАНИЕ',
        'Набери 10 очков, пока не кончились три жизни; противник сильнее с каждым очком',
      ],
      giant: [
        'ВЕЛИКАН',
        'Выиграй до 5 очков у противника средней сложности с ракеткой в полтора раза длиннее',
      ],
      overload: [
        'ПЕРЕГРУЗКА',
        'Выиграй у противника средней сложности до 7 очков, сделав 5 ударов Overdrive',
      ],
      insanity: ['БЕЗУМИЕ', 'Выиграй до 5 очков у безумного противника'],
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
