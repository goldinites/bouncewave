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
  lname: string;
  pause: string;
  win: string;
  lose: string;
  ready: string;
  hintK: string;
  hintT: string;
  d: [DifficultyDescription, DifficultyDescription, DifficultyDescription, DifficultyDescription];
}
