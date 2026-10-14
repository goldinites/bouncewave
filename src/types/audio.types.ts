import { DifficultyLevel } from '@/types/difficulty.types';
import { Language } from '@/types/i18n.types';

export interface TrackConfig {
  bpm: number;
  rootNotes: number[];
  chordTypes: number[];
  arpeggioPattern: number[];
  bassPatternIndex: number;
  arpeggioWave: OscillatorType;
}

export interface UserSettings {
  difficulty: DifficultyLevel;
  soundMuted: boolean;
  musicMuted: boolean;
  language: Language;
}
