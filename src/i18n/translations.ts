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
  on: string;
  off: string;
  lang: string;
  lang_name: string;
  pause: string;
  win: string;
  lose: string;
  ready: string;
  hintK: string;
  hintT: string;
  d: [DifficultyDescription, DifficultyDescription, DifficultyDescription, DifficultyDescription];
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
    on: 'ON',
    off: 'OFF',
    lang: 'LANGUAGE',
    lang_name: 'ENGLISH',
    pause: 'PAUSED',
    win: 'YOU WIN',
    lose: 'GAME OVER',
    ready: 'GET READY',
    hintK: `Paddle: W / S or ↑ / ↓ · mouse or touch works too<br>Esc / P — pause · first to ${WINNING_SCORE} points`,
    hintT: `Drag your finger to move the paddle<br>First to ${WINNING_SCORE} points`,
    d: [
      ['EASY', 'vs CPU: slow, misses often'],
      ['NORMAL', 'vs CPU: a balanced opponent'],
      ['HARD', 'vs CPU: fast and accurate'],
      ['INSANE', 'vs CPU: barely makes mistakes'],
    ],
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
    on: 'ВКЛ',
    off: 'ВЫКЛ',
    lang: 'ЯЗЫК',
    lang_name: 'РУССКИЙ',
    pause: 'ПАУЗА',
    win: 'ПОБЕДА',
    lose: 'ИГРА ОКОНЧЕНА',
    ready: 'ГОТОВЬСЬ',
    hintK: `Ракетка: W / S или ↑ / ↓ · мышь или касание тоже работают<br>Esc / P — пауза · играем до ${WINNING_SCORE} очков`,
    hintT: `Двигайте ракетку пальцем<br>Играем до ${WINNING_SCORE} очков`,
    d: [
      ['ЛЁГКАЯ', 'Против CPU: медленный, часто мажет'],
      ['СРЕДНЯЯ', 'Против CPU: сбалансированный соперник'],
      ['СЛОЖНАЯ', 'Против CPU: быстрый и точный'],
      ['БЕЗУМИЕ', 'Против CPU: почти не ошибается'],
    ],
  },
};
