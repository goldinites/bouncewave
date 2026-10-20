import { ChallengeId, ChallengeTier } from '@/match/challenges';
import { ModifierId } from '@/match/modifiers/Modifier';
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
  /** Local multiplayer, on the main menu. */
  multiplayer: string;
  /** Two players on one device: the setup's title, and how each steers under it. */
  twoPlayers: string;
  twoPlayersHint: string;
  /** Who won a match of two players, in place of `win` / `lose`. */
  player1Wins: string;
  player2Wins: string;
  /** Each side's label under its score in a match of two players: [left, right]. */
  playerLabels: [string, string];
  /**
   * The challenges' screens; a text's `{placeholders}` are filled by `I18nManager.format`.
   * The list's count and the statistics' heading and row, as "PASSED: 4 / 9".
   */
  challengesHeading: string;
  challengesPassed: string;
  /** The challenges' list a tier at a time: each tier's tab, a rank on the player's way. */
  challengeTiers: Record<ChallengeTier, string>;
  /** An attempt's outcome: passed or not, every challenge passed, and its buttons. */
  attemptPassed: string;
  attemptFailed: string;
  attemptAllPassed: string;
  nextChallenge: string;
  tryAgain: string;
  toChallenges: string;
  /** A challenge's condition in the HUD, as it stands: "RALLY 12 / 20 · 0:41". */
  hudRally: string;
  hudPoints: string;
  /** The modifier coming next when they take turns (Chaos): "WIND · NEXT: DARKNESS". */
  hudNextModifier: string;
  /** What a failed attempt fell short by: how far it got toward the goal, or what spoilt it. */
  shortRally: string;
  shortPoints: string;
  shortConceded: string;
  /**
   * The finale's sign over a failed attempt, in place of `lose` where it would mislead: the clock
   * ran out, a point was lost in a shutout, the lives ran out.
   */
  finaleTimeUp: string;
  finaleConceded: string;
  finaleNoLives: string;
  /** Every match modifier's name, as the HUD names it when they take turns. */
  modifiers: Record<ModifierId, string>;
  /** Every backdrop's name, and random's, by choice. */
  backgrounds: Record<BackgroundChoice, string>;
  /** Name and description of every difficulty level, by level. */
  d: Record<DifficultyLevel, DifficultyDescription>;
  /**
   * Name and description of every challenge, by challenge. The description is all the card says
   * of it: its goal and whatever sets its match apart (points to win, clock, level, paddles,
   * modifiers).
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
    twoPlayers: '2 PLAYERS',
    twoPlayersHint: 'Left: W/S, right: arrows. On a touch screen, each on their own half',
    player1Wins: 'PLAYER 1 WINS',
    player2Wins: 'PLAYER 2 WINS',
    playerLabels: ['P1', 'P2'],
    challengesHeading: 'CHALLENGES',
    challengesPassed: 'PASSED',
    challengeTiers: { warehouse: 'ROOKIE', dojo: 'MASTER', brokenNet: 'LEGEND' },
    attemptPassed: 'PASSED!',
    attemptFailed: 'NOT PASSED',
    attemptAllPassed: 'EVERY CHALLENGE PASSED',
    nextChallenge: 'NEXT',
    tryAgain: 'TRY AGAIN',
    toChallenges: 'ALL CHALLENGES',
    hudRally: 'RALLY {n} / {target}',
    hudPoints: 'POINTS {n} / {target}',
    hudNextModifier: 'NEXT: {name}',
    shortRally: 'RALLY: {n} OF {target}',
    shortPoints: 'POINTS: {n} OF {target}',
    shortConceded: 'A POINT WAS LOST',
    finaleTimeUp: 'TIME UP',
    finaleConceded: 'POINT LOST',
    finaleNoLives: 'OUT OF LIVES',
    modifiers: {
      wind: 'WIND',
      darkness: 'DARKNESS',
      twoOpponents: 'TWO OPPONENTS',
      turbo: 'TURBO',
      shrinkingPaddle: 'MELTING PADDLE',
      bumpers: 'BUMPERS',
      invisibleBand: 'GHOST BAND',
      ice: 'ICE',
      bricks: 'BRICKS',
    },
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
      warmUp: ['FIRST SERVE', 'Win a match to 3 points'],
      twoBalls: ['SPLIT', 'Win to 5 with two balls in play at once'],
      longRally: ['MARATHON', 'Keep a rally going for 20 hits within a minute'],
      bricks: [
        'BREAKOUT',
        'Win to 5 against a Normal opponent through a wall of bricks the ball breaks',
      ],
      wind: [
        'CROSSWIND',
        'Win to 5 against a Normal opponent in a gusting wind that turns now and then',
      ],
      turbo: ['OVERHEAT', 'Win to 5 against a Normal opponent: the ball speeds up in flight'],
      shrinkingPaddle: [
        'ATTRITION',
        'Keep a rally going for 20 hits within a minute; your paddle shrinks with every hit',
      ],
      darkness: ['BLACKOUT', 'Win to 5 against a Normal opponent on a court in the dark'],
      blitz: ['COUNTDOWN', 'Win to 3 before the two minutes are up'],
      bumpers: ['PINBALL', 'Win to 5 against a Hard opponent, posts standing on the centre line'],
      ice: ['SLIDE', 'Win to 5 against a Hard opponent on ice: the paddles slide'],
      ghost: ['DEAD ZONE', 'Win to 5 against a Hard opponent: the ball vanishes across the middle'],
      twoOnOne: [
        'TAG TEAM',
        'Win to 5 against two Normal opponents, each holding half of the court',
      ],
      giant: ['GOLIATH', 'Win to 5 against a Normal opponent whose paddle is half as long again'],
      shutout: ['PERFECT GAME', 'Win to 3 without losing a single point'],
      survival: [
        'SURVIVAL',
        'Score 10 before you lose three lives; the opponent grows stronger every point',
      ],
      insanity: ['INSANITY', 'Win to 5 against an Insane opponent'],
      chaos: [
        'CHAOS',
        'Win to 7 against a Hard opponent while the modifiers take turns, two points each',
      ],
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
    twoPlayers: '2 ИГРОКА',
    twoPlayersHint: 'Левый — W/S, правый — стрелки. На сенсорном экране — каждый на своей половине',
    // In English, as the finale's YOU WIN is
    player1Wins: 'PLAYER 1 WINS',
    player2Wins: 'PLAYER 2 WINS',
    playerLabels: ['P1', 'P2'],
    challengesHeading: 'ИСПЫТАНИЯ',
    challengesPassed: 'ПРОЙДЕНО',
    challengeTiers: { warehouse: 'НОВИЧОК', dojo: 'МАСТЕР', brokenNet: 'ЛЕГЕНДА' },
    attemptPassed: 'ПРОЙДЕНО!',
    attemptFailed: 'НЕ ПРОЙДЕНО',
    attemptAllPassed: 'ВСЕ ИСПЫТАНИЯ ПРОЙДЕНЫ',
    nextChallenge: 'СЛЕДУЮЩЕЕ',
    tryAgain: 'ЕЩЁ РАЗ',
    toChallenges: 'К СПИСКУ',
    hudRally: 'РОЗЫГРЫШ {n} / {target}',
    hudPoints: 'ОЧКИ {n} / {target}',
    hudNextModifier: 'ДАЛЕЕ: {name}',
    shortRally: 'РОЗЫГРЫШ: {n} ИЗ {target}',
    shortPoints: 'ОЧКИ: {n} ИЗ {target}',
    shortConceded: 'ПРОПУЩЕНО ОЧКО',
    // In English, as the finale's GAME OVER is
    finaleTimeUp: 'TIME UP',
    finaleConceded: 'POINT LOST',
    finaleNoLives: 'OUT OF LIVES',
    modifiers: {
      wind: 'ВЕТЕР',
      darkness: 'ТЬМА',
      twoOpponents: 'ДВОЕ СОПЕРНИКОВ',
      turbo: 'ТУРБО',
      shrinkingPaddle: 'ТАЮЩАЯ РАКЕТКА',
      bumpers: 'ОТБОЙНИКИ',
      invisibleBand: 'НЕВИДИМАЯ ПОЛОСА',
      ice: 'ЛЁД',
      bricks: 'КИРПИЧИ',
    },
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
      warmUp: ['ПЕРВАЯ ПОДАЧА', 'Выиграй матч до 3 очков'],
      twoBalls: ['РАЗДВОЕНИЕ', 'Выиграй до 5 очков, когда в игре сразу два мяча'],
      longRally: ['МАРАФОН', 'Розыгрыш в 20 ударов за минуту'],
      bricks: [
        'НАПРОЛОМ',
        'Выиграй до 5 очков у противника средней сложности сквозь стену из кирпичей, которые мяч разбивает',
      ],
      wind: [
        'СКВОЗНЯК',
        'Выиграй до 5 очков у противника средней сложности на порывистом ветру, который меняет направление',
      ],
      turbo: [
        'ПЕРЕГРЕВ',
        'Выиграй до 5 очков у противника средней сложности: мяч разгоняется в полёте',
      ],
      shrinkingPaddle: [
        'ИСТОЩЕНИЕ',
        'Розыгрыш в 20 ударов за минуту; твоя ракетка короче с каждым ударом',
      ],
      darkness: ['БЛЭКАУТ', 'Выиграй до 5 очков у противника средней сложности на тёмном корте'],
      blitz: ['ОТСЧЁТ', 'Выиграй до 3 очков, пока не прошли две минуты'],
      bumpers: [
        'ПИНБОЛ',
        'Выиграй до 5 очков у сложного противника, когда на центральной линии стоят отбойники',
      ],
      ice: ['СКОЛЬЖЕНИЕ', 'Выиграй до 5 очков у сложного противника на льду: ракетки скользят'],
      ghost: [
        'МЁРТВАЯ ЗОНА',
        'Выиграй до 5 очков у сложного противника: в середине корта мяч невидим',
      ],
      twoOnOne: [
        'ТАНДЕМ',
        'Выиграй до 5 очков у двух противников средней сложности, каждый держит свою половину',
      ],
      giant: [
        'ГОЛИАФ',
        'Выиграй до 5 очков у противника средней сложности с ракеткой в полтора раза длиннее',
      ],
      shutout: ['ИДЕАЛЬНАЯ ИГРА', 'Выиграй до 3 очков, не пропустив ни одного'],
      survival: [
        'ВЫЖИВАНИЕ',
        'Набери 10 очков, пока не кончились три жизни; противник сильнее с каждым очком',
      ],
      insanity: ['БЕЗУМИЕ', 'Выиграй до 5 очков у безумного противника'],
      chaos: [
        'ХАОС',
        'Выиграй до 7 очков у сложного противника, пока модификаторы сменяют друг друга каждые 2 очка',
      ],
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
