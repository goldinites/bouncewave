import { SFX_FREQUENCIES } from '@/constants/audio.constants';
import { GameMode } from '@/types/game.types';

export class SoundEffects {
  private audioContextGetter: () => AudioContext | null;
  private isMutedGetter: () => boolean;
  private gameModeGetter: () => GameMode;

  constructor(
    getAudioContext: () => AudioContext | null,
    getIsMuted: () => boolean,
    getGameMode: () => GameMode,
  ) {
    this.audioContextGetter = getAudioContext;
    this.isMutedGetter = getIsMuted;
    this.gameModeGetter = getGameMode;
  }

  public beep(
    frequency: number,
    duration = 0.08,
    type: OscillatorType = 'square',
    volume = 0.06,
    slide = 0,
    force = false,
  ): void {
    const ac = this.audioContextGetter();
    if (!ac || this.isMutedGetter() || (this.gameModeGetter() === GameMode.DEMO && !force)) {
      return;
    }

    try {
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);

      if (slide) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * slide), now + duration);
      }

      gain.gain.setValueAtTime(volume * 2, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain).connect(ac.destination);
      osc.start();
      osc.stop(now + duration);
    } catch {
      // Audio playback fails silently if browser policy blocks it
    }
  }

  public playWallBounce(): void {
    this.beep(SFX_FREQUENCIES.WALL_BOUNCE, 0.05, 'triangle', 0.07);
  }

  public playPaddleHit(rally: number, isPerfect = false): void {
    const freq = SFX_FREQUENCIES.PADDLE_HIT_BASE + rally * SFX_FREQUENCIES.PADDLE_HIT_STEP;

    if (isPerfect) {
      // Clean sine tone with a soft octave overtone instead of the square blip
      this.beep(freq, 0.22, 'sine', 0.09);
      this.beep(freq * 2, 0.16, 'sine', 0.03);
      return;
    }

    this.beep(freq, 0.09);
  }

  public playScore(): void {
    this.beep(SFX_FREQUENCIES.SCORE, 0.35, 'sawtooth', 0.07, 0.3);
  }

  public playGameOver(): void {
    SFX_FREQUENCIES.GAME_OVER_CHIME.forEach((freq, index) => {
      setTimeout(() => {
        this.beep(freq, 0.18, 'square', 0.06, 0, true);
      }, index * 110);
    });
  }

  public playSettingsClick(): void {
    this.beep(SFX_FREQUENCIES.SETTINGS_CLICK, 0.08);
  }
}
