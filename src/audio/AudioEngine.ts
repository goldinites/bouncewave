import { MasterLevels, Mixer } from '@/audio/Mixer';
import { MusicState } from '@/audio/music/intensity';
import { MusicEngine } from '@/audio/music/MusicEngine';
import { Ps1MusicEngine } from '@/audio/music/Ps1MusicEngine';
import { ACTION_PITCHED, ACTION_SAMPLES } from '@/audio/samples/actions';
import { DRUM_SAMPLES } from '@/audio/samples/drums';
import { PITCHED_SAMPLES } from '@/audio/samples/pitched';
import { TRANSITION_SAMPLES } from '@/audio/samples/transitions';
import { SampleBank } from '@/audio/samples/SampleBank';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { Look } from '@/shared/look';

/**
 * Owns the AudioContext (created on the first user gesture), the mixer every sound ends in, and
 * the music and SFX on it.
 */
export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private mixer: Mixer | null = null;
  public readonly sfx: SoundEffects;
  public readonly music = new MusicEngine();
  /** The instruments rendered from code once the audio starts (docs/AUDIO.md). */
  public readonly samples = new SampleBank();
  /** The classic look's own loop, independent of the synthwave mix. */
  private readonly classicMusic = new Ps1MusicEngine();
  /** The look the music follows: the classic one plays its loop in place of the synthwave mix. */
  private look: Look = 'neon';
  private readonly listeners = new AbortController();
  /** Set by the listening stand while it plays a sound, so it is heard behind the menus too. */
  public isAuditioning = false;
  /** The listening stand's pause: the audio clock stopped, the music held where it was. */
  private isStandPaused = false;

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
      () => this.isAuditioning || isGameplayAudible(),
      // Hits are tuned to whatever chord the music is playing right now
      () => this.music.getHarmony(),
      () => this.mixer,
      () => this.samples,
    );

    // Silence the whole audio graph while the tab is hidden (the game pauses itself separately)
    document.addEventListener(
      'visibilitychange',
      () => {
        if (!this.audioContext) return;
        if (document.hidden) {
          this.audioContext.suspend();
        } else if (!this.isStandPaused) {
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
    this.mixer = null;
  }

  /**
   * How late the output is on this device, in seconds: the browser's own processing and the
   * device's output (Bluetooth adds a lot); null before the context exists.
   */
  public getLatency(): { base: number; output: number } | null {
    const ac = this.audioContext;
    if (!ac) return null;
    return { base: ac.baseLatency ?? 0, output: ac.outputLatency ?? 0 };
  }

  /** How loud the master is now, for the listening stand; null before the audio starts. */
  public getMasterLevels(): MasterLevels | null {
    return this.mixer?.getLevels() ?? null;
  }

  public get isPaused(): boolean {
    return this.isStandPaused;
  }

  /**
   * The listening stand pauses everything: the audio clock stops, so the music's scheduler, which
   * runs on it, waits where it was, and resumes from the same step.
   */
  public setPaused(isPaused: boolean): void {
    this.isStandPaused = isPaused;
    if (!this.audioContext) return;
    if (isPaused) void this.audioContext.suspend();
    else if (!document.hidden) void this.audioContext.resume();
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
    // falls back to after a call or the app switcher, and only a gesture's resume() clears it.
    // The stand's pause holds it stopped, whatever gesture comes
    if (ac.state !== 'running' && !this.isStandPaused) {
      void ac.resume().catch(() => {});
      // iOS keeps a resumed context silent until a sound is started inside a gesture, so the
      // music stayed mute until the first paddle hit. A one-sample silent buffer is enough
      this.playSilence(ac);
    }

    if (!this.mixer) {
      this.mixer = new Mixer(ac);
      // Rendered off the frame, in the background; the live synths play until they are ready.
      // The action sounds first, the first hit comes within seconds; then the drums: they are
      // small, and every song needs them from its first bar
      const rate = ac.sampleRate;
      void this.samples
        .render(rate, ACTION_SAMPLES)
        .then(() => this.samples.renderPitched(rate, ACTION_PITCHED))
        .then(() => this.samples.render(rate, DRUM_SAMPLES))
        .then(() => this.samples.renderPitched(rate, PITCHED_SAMPLES))
        .then(() => this.samples.render(rate, TRANSITION_SAMPLES));
    }
    this.music.init(ac, this.mixer.music, this.samples);
    this.classicMusic.init(ac, this.mixer.music);
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
