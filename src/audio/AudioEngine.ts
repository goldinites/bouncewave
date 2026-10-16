import { MusicEngine } from '@/audio/music/MusicEngine';
import { Ps1MusicEngine } from '@/audio/music/Ps1MusicEngine';
import { SoundEffects } from '@/audio/sfx/SoundEffects';

/** Owns the AudioContext (created on the first user gesture) and the music and SFX on it. */
export class AudioEngine {
  private audioContext: AudioContext | null = null;
  public readonly sfx: SoundEffects;
  public readonly music = new MusicEngine();
  /** The classic-mode easter egg's own loop, independent of the synthwave mix. */
  public readonly classicMusic = new Ps1MusicEngine();
  private readonly listeners = new AbortController();

  /**
   * Both getters are read live, at the moment a sound plays, so a settings toggle or a
   * state change in the middle of a frame is honoured immediately.
   * @param isSoundMuted       the player's sound-effects setting
   * @param isGameplayAudible  whether gameplay sounds should play now (false behind menus)
   */
  constructor(isSoundMuted: () => boolean, isGameplayAudible: () => boolean) {
    this.sfx = new SoundEffects(
      () => this.audioContext,
      isSoundMuted,
      isGameplayAudible,
      // Hits are tuned to whatever chord the music is playing right now
      () => this.music.getHarmony(),
    );

    // Silence the whole audio graph while the tab is hidden (the game pauses itself separately)
    document.addEventListener(
      'visibilitychange',
      () => {
        if (!this.audioContext) return;
        if (document.hidden) {
          this.audioContext.suspend();
        } else {
          this.audioContext.resume();
        }
      },
      { signal: this.listeners.signal },
    );
  }

  public dispose(): void {
    this.listeners.abort();
    this.music.dispose();
    this.classicMusic.dispose();
    void this.audioContext?.close();
    this.audioContext = null;
  }

  public unlock(): void {
    if (!this.audioContext) {
      try {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioCtxClass();
      } catch {
        return;
      }
    }

    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    if (this.audioContext) {
      this.music.init(this.audioContext);
      this.classicMusic.init(this.audioContext);
    }
  }
}
