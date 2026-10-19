import { MusicState } from '@/audio/music/intensity';
import { MusicEngine } from '@/audio/music/MusicEngine';
import { Ps1MusicEngine } from '@/audio/music/Ps1MusicEngine';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { Look } from '@/shared/look';

/** Owns the AudioContext (created on the first user gesture) and the music and SFX on it. */
export class AudioEngine {
  private audioContext: AudioContext | null = null;
  public readonly sfx: SoundEffects;
  public readonly music = new MusicEngine();
  /** The classic look's own loop, independent of the synthwave mix. */
  private readonly classicMusic = new Ps1MusicEngine();
  /** The look the music follows: the classic one plays its loop in place of the synthwave mix. */
  private look: Look = 'neon';
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

  public setLook(look: Look): void {
    this.look = look;
  }

  /**
   * The music for this frame: the synthwave mix building with the match, or in the classic look
   * its own loop with the mix kept silent. Read on the music's own scheduler tick.
   */
  public playMusic(state: MusicState): void {
    const isClassic = this.look === 'classic';
    this.music.setState(isClassic ? { ...state, isMuted: true } : state);
    this.classicMusic.setActive(isClassic && !state.isMuted);
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

    const ac = this.audioContext;
    // Not only 'suspended': iOS also has 'interrupted', which a home-screen app can start in and
    // falls back to after a call or the app switcher, and only a gesture's resume() clears it
    if (ac.state !== 'running') {
      void ac.resume().catch(() => {});
      // iOS keeps a resumed context silent until a sound is started inside a gesture, so the
      // music stayed mute until the first paddle hit. A one-sample silent buffer is enough
      this.playSilence(ac);
    }

    this.music.init(ac);
    this.classicMusic.init(ac);
  }

  private playSilence(ac: AudioContext): void {
    try {
      const source = ac.createBufferSource();
      source.buffer = ac.createBuffer(1, 1, ac.sampleRate);
      source.connect(ac.destination);
      source.start();
    } catch {
      // Nothing more to try if the context refuses even this
    }
  }
}
