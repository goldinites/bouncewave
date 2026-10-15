import { MusicEngine, MusicEngineStateProvider } from '@/audio/MusicEngine';
import { SoundEffects } from '@/audio/SoundEffects';

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  public readonly sfx: SoundEffects;
  public readonly music: MusicEngine;

  constructor(isSoundMutedGetter: () => boolean, musicStateProvider: MusicEngineStateProvider) {
    this.music = new MusicEngine(musicStateProvider);
    this.sfx = new SoundEffects(
      () => this.audioContext,
      isSoundMutedGetter,
      () => (musicStateProvider.getGameState() === 'play' ? 1 : 0),
      // Hits are tuned to whatever chord the music is playing right now
      () => this.music.getHarmony(),
    );

    document.addEventListener('visibilitychange', () => {
      if (!this.audioContext) return;
      if (document.hidden) {
        this.audioContext.suspend();
      } else {
        this.audioContext.resume();
      }
    });
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
    }
  }
}
