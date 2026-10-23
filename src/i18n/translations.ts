import { ChallengeId, ChallengeTier } from '@/match/challenges';
import { ModifierId } from '@/match/modifiers/Modifier';
import { DifficultyLevel } from '@/match/difficulty';
import { ModeId } from '@/match/modes';
import { TutorialCard, TutorialFeedback, TutorialStep } from '@/match/tutorial';
import { BackgroundChoice } from '@/shared/scenes';
export type Language = 'en' | 'ru';

export type DifficultyDescription = [name: string, description: string];

/** The tutorial's texts (step 4.8): its offer, each step, its hint and its card, its end. */
export interface TutorialTexts {
  /** Offered on PLAY until gone through or turned down: its title, its question, the answers. */
  offerTitle: string;
  offerText: string;
  yes: string;
  no: string;
  /** What each step asks, over the court; moving as a person with keys or a finger does it. */
  steps: Record<TutorialStep, string>;
  moveByTouch: string;
  /** Shown in a step's place once a few tries have missed it. */
  hints: Record<TutorialStep, string>;
  /** Overdrive charged: what the very next return does. */
  charged: string;
  /** Told for a moment after a try that didn't count: why not. */
  feedback: Record<TutorialFeedback, string>;
  /**
   * The cards that open the steps, the match paused: the move, what it gives, and its catch or
   * how it is made. Their button.
   */
  cards: Record<TutorialCard, { title: string; why: string; how: string }>;
  ok: string;
  /** Its end. */
  doneTitle: string;
  doneText: string;
}

/** The controls screen (in the settings): each row's name, and how keys or a touch do it. */
export interface ControlsTexts {
  title: string;
  /** The heading over the shots. */
  shots: string;
  rows: Record<ControlId, { name: string; keys: string; touch: string }>;
}

/** The controls screen's rows, the controls' and then the shots'. */
export const CONTROL_ROWS = {
  controls: ['paddle', 'pause', 'fullscreen', 'music', 'twoPlayers'],
  shots: ['perfect', 'angle', 'aim', 'overdrive'],
} as const;

export type ControlId = (typeof CONTROL_ROWS)[keyof typeof CONTROL_ROWS][number];

/** A challenge's name, and what it takes to pass it and what sets its match apart. */
export type ChallengeDescription = [name: string, goal: string];

export interface TranslationSchema {
  play: string;
  settings: string;
  again: string;
  /** A won quick match's end: play again a level up; `{level}` is its name. */
  harder: string;
  /** Over the court while a long rally is in overtime (match/overtime.ts). */
  overtime: string;
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
  tutorial: TutorialTexts;
  controls: ControlsTexts;
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
    harder: 'TRY {level}',
    overtime: 'OVERTIME',
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
    modes: { story: 'STORY', challenges: 'CHALLENGE', quick: 'QUICK MATCH', tutorial: 'TUTORIAL' },
    tutorial: {
      offerTitle: 'FIRST TIME?',
      offerText: 'Take the tutorial? It’s a minute on the controls and the shots',
      yes: 'YES',
      no: 'NO',
      steps: {
        move: 'MOVE: W/S, ↑/↓ OR THE MOUSE',
        hit: 'RETURN THE BALL',
        angle: 'A STEEP RETURN OFF AN EDGE',
        perfect: 'PERFECT HIT',
        overdrive: 'PERFECT HITS IN A ROW',
      },
      moveByTouch: 'MOVE: SLIDE A FINGER',
      hints: {
        move: 'MOVE THE PADDLE',
        hit: 'GET IN THE BALL’S PATH',
        angle: 'TAKE IT NEARER THE PADDLE’S END',
        perfect: 'TAKE IT ON THE LIT MIDDLE',
        overdrive: 'HOLD STILL, TAKE IT ON THE MIDDLE',
      },
      charged: 'CHARGED: THE NEXT HIT IS A POWER SHOT',
      feedback: {
        flat: 'TOO FLAT',
        offCenter: 'OFF CENTER',
        chargeLost: 'OFF CENTER: METER EMPTIED',
        missed: 'MISSED',
      },
      cards: {
        angle: {
          title: 'ANGLE',
          why: 'The nearer the paddle’s end, the steeper the return. A steep ball comes off the walls and is harder to read.',
          how: 'The risk: right at the end, it’s easy to miss.',
        },
        perfect: {
          title: 'PERFECT HIT',
          why: 'A hit off the paddle’s middle is perfect: the ball speeds up and the opponent reacts later.',
          how: 'Perfect hits in a row build up Overdrive.',
        },
        overdrive: {
          title: 'OVERDRIVE',
          why: 'Three perfect hits in a row charge the meter: your next hit is a power shot, very hard to return.',
          how: 'A hit that isn’t perfect empties the meter.',
        },
      },
      ok: 'GOT IT',
      doneTitle: 'WELL PLAYED!',
      doneText: 'Now for a real match',
    },
    controls: {
      title: 'CONTROLS',
      shots: 'SHOTS',
      rows: {
        paddle: { name: 'Paddle', keys: 'W/S · ↑/↓ · mouse', touch: 'Slide a finger' },
        pause: { name: 'Pause', keys: 'P · Esc · right click', touch: 'The ❚❚ button' },
        fullscreen: { name: 'Fullscreen', keys: 'F', touch: 'Install the app' },
        music: { name: 'Music', keys: 'M', touch: 'In the settings' },
        twoPlayers: { name: 'Two players', keys: 'W/S and ↑/↓', touch: 'Each on their half' },
        perfect: {
          name: 'Perfect hit',
          keys: 'Off the middle: a faster ball',
          touch: 'Off the middle: a faster ball',
        },
        angle: {
          name: 'Angle',
          keys: 'Off an end: a steeper return',
          touch: 'Off an end: a steeper return',
        },
        aim: {
          name: 'Aim',
          keys: 'Perfect on the move: goes your way',
          touch: 'Perfect on the move: goes your way',
        },
        overdrive: {
          name: 'Overdrive',
          keys: '3 perfect in a row: a power shot',
          touch: '3 perfect in a row: a power shot',
        },
      },
    },
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
      neonCity: 'NEON CITY',
      fuji: 'FUJI',
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
        'Score 7 before a Hard opponent scores 5, while the modifiers take turns, two points each',
      ],
    },
  },
  ru: {
    play: 'ИГРАТЬ',
    settings: 'НАСТРОЙКИ',
    again: 'ИГРАТЬ СНОВА',
    harder: 'СЛОЖНЕЕ: {level}',
    overtime: 'ОВЕРТАЙМ',
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
    modes: { story: 'СЮЖЕТ', challenges: 'ИСПЫТАНИЕ', quick: 'БЫСТРЫЙ МАТЧ', tutorial: 'ОБУЧЕНИЕ' },
    tutorial: {
      offerTitle: 'ВПЕРВЫЕ?',
      offerText: 'Пройти обучение? Это минута на управление и приёмы',
      yes: 'ДА',
      no: 'НЕТ',
      steps: {
        move: 'ДВИГАЙ РАКЕТКУ: W/S, ↑/↓ ИЛИ МЫШЬ',
        hit: 'ОТБЕЙ МЯЧ',
        angle: 'КРУТОЙ ОТСКОК КРАЕМ',
        perfect: 'ИДЕАЛЬНЫЙ УДАР',
        overdrive: 'ИДЕАЛЬНЫЕ ПОДРЯД',
      },
      moveByTouch: 'ВЕДИ РАКЕТКУ ПАЛЬЦЕМ',
      hints: {
        move: 'ДВИГАЙ РАКЕТКУ',
        hit: 'ВСТАНЬ НА ПУТЬ МЯЧА',
        angle: 'ЛОВИ МЯЧ БЛИЖЕ К КОНЦУ РАКЕТКИ',
        perfect: 'ЛОВИ МЯЧ ПОДСВЕЧЕННОЙ СЕРЕДИНОЙ',
        overdrive: 'СТОЙ И ЛОВИ СЕРЕДИНОЙ',
      },
      charged: 'ЗАРЯЖЕНО: СЛЕДУЮЩИЙ УДАР МОЩНЫЙ',
      feedback: {
        flat: 'СЛИШКОМ ПРЯМО',
        offCenter: 'НЕ ПО ЦЕНТРУ',
        chargeLost: 'НЕ ПО ЦЕНТРУ — ШКАЛА СБРОШЕНА',
        missed: 'МИМО',
      },
      cards: {
        angle: {
          title: 'УГОЛ',
          why: 'Чем ближе к краю ракетки, тем круче отскок. Крутой мяч отражается от стен, и его труднее прочитать.',
          how: 'Риск: у самого края легко промахнуться.',
        },
        perfect: {
          title: 'ИДЕАЛЬНЫЙ УДАР',
          why: 'Удар серединой ракетки — идеальный: мяч ускоряется, и соперник реагирует позже.',
          how: 'Идеальные удары подряд копят Overdrive.',
        },
        overdrive: {
          title: 'OVERDRIVE',
          why: 'Три идеальных удара подряд заряжают шкалу: следующий удар — мощный, его очень трудно отбить.',
          how: 'Неидеальный удар обнуляет шкалу.',
        },
      },
      ok: 'ПОНЯТНО',
      doneTitle: 'ГОТОВО!',
      doneText: 'Теперь — настоящий матч',
    },
    controls: {
      title: 'УПРАВЛЕНИЕ',
      shots: 'ПРИЁМЫ',
      rows: {
        paddle: { name: 'Ракетка', keys: 'W/S · ↑/↓ · мышь', touch: 'Веди пальцем' },
        pause: { name: 'Пауза', keys: 'P · Esc · правая кнопка', touch: 'Кнопка ❚❚' },
        fullscreen: { name: 'Полный экран', keys: 'F', touch: 'Установи приложение' },
        music: { name: 'Музыка', keys: 'M', touch: 'В настройках' },
        twoPlayers: { name: 'Двое', keys: 'W/S и ↑/↓', touch: 'Каждый на своей половине' },
        perfect: {
          name: 'Идеальный удар',
          keys: 'Серединой: мяч быстрее',
          touch: 'Серединой: мяч быстрее',
        },
        angle: {
          name: 'Угол',
          keys: 'Краем: отскок круче',
          touch: 'Краем: отскок круче',
        },
        aim: {
          name: 'Прицел',
          keys: 'Идеальный на ходу: мяч, куда ведёшь',
          touch: 'Идеальный на ходу: мяч, куда ведёшь',
        },
        overdrive: {
          name: 'Overdrive',
          keys: '3 идеальных подряд: удар мощнее',
          touch: '3 идеальных подряд: удар мощнее',
        },
      },
    },
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
      neonCity: 'ГОРОД',
      fuji: 'ФУДЗИ',
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
        'Набери 7 очков раньше, чем сложный противник наберёт 5; модификаторы сменяются каждые 2 очка',
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
