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

/** What the music is playing right now: bar root (MIDI) and chord intervals in semitones. */
export interface Harmony {
  root: number;
  chord: readonly number[];
}

export interface UserSettings {
  difficulty: DifficultyLevel;
  soundMuted: boolean;
  musicMuted: boolean;
  language: Language;
}
