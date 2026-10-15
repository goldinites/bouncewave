import { TrackConfig } from '@/types/audio.types';

export const CHORD_TYPES: number[][] = [
  [0, 3, 7], // Minor triad
  [0, 4, 7], // Major triad
];

export const BASS_PATTERNS: string[] = ['1010101010101010', '1001001010010010', '0010001000100010'];

export const MUSIC_TRACKS: TrackConfig[] = [
  {
    bpm: 92,
    rootNotes: [33, 29, 36, 31],
    chordTypes: [0, 1, 1, 1],
    arpeggioPattern: [0, 2, 4, 2, 1, 3, 5, 3, 0, 2, 4, 5, 3, 2, 1, 2],
    bassPatternIndex: 0,
    arpeggioWave: 'square',
  },
  {
    bpm: 100,
    rootNotes: [38, 34, 29, 36],
    chordTypes: [0, 1, 1, 1],
    arpeggioPattern: [0, 1, 2, 1, 3, 4, 5, 4, 0, 2, 1, 3, 2, 4, 3, 5],
    bassPatternIndex: 1,
    arpeggioWave: 'sawtooth',
  },
  {
    bpm: 108,
    rootNotes: [40, 36, 31, 38],
    chordTypes: [0, 1, 1, 1],
    arpeggioPattern: [2, 0, 1, 2, 5, 3, 4, 5, 2, 0, 1, 2, 5, 4, 3, 1],
    bassPatternIndex: 2,
    arpeggioWave: 'square',
  },
  {
    bpm: 116,
    rootNotes: [36, 32, 34, 31],
    chordTypes: [0, 1, 1, 0],
    arpeggioPattern: [0, 3, 1, 4, 2, 5, 2, 4, 0, 3, 1, 5, 2, 4, 3, 1],
    bassPatternIndex: 0,
    arpeggioWave: 'sawtooth',
  },
];

export const SFX_FREQUENCIES = {
  WALL_BOUNCE: 220,
  PADDLE_HIT_BASE: 440,
  PADDLE_HIT_STEP: 18,
  SCORE: 300,
  SETTINGS_CLICK: 660,
  GAME_OVER_CHIME: [523, 659, 784, 1047],
} as const;

// Low-pass cutoff of the music bus at full match-point drama (fully open at level 0)
export const DRAMA_FILTER_MIN_FREQ = 550;
export const DRAMA_FILTER_MAX_FREQ = 20000;

export const LOCAL_STORAGE_KEY = 'neonpong';
