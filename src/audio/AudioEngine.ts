import { MasterLevels, Mixer } from '@/audio/Mixer';
import { MusicState } from '@/audio/music/intensity';
import { MusicEngine } from '@/audio/music/MusicEngine';
import { Ps1MusicEngine } from '@/audio/music/Ps1MusicEngine';
import { ACTION_PITCHED, ACTION_SAMPLES } from '@/audio/samples/actions';
import { TRANSITION_SAMPLES } from '@/audio/samples/transitions';
import { SampleBank } from '@/audio/samples/SampleBank';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { Look } from '@/shared/look';
import { Volume, VOLUME, volumeGain } from '@/shared/volume';

const VOLUME_RAMP = 0.03; // s, time constant of a volume change: quick, and without a click

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
  /** Whether the listening stand plays everything through a phone speaker's stand-in. */
  private isPhoneSpeaker = false;
  /** The player's volumes, set on the mixer's buses once it exists. */
  private volumes: { music: Volume; sound: Volume } = { music: VOLUME.MAX, sound: VOLUME.MAX };

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
      // and grow louder as the music heats up
      () => this.music.getHeat(),
    );

    // Silence the whole audio graph while the tab is hidden (the game pauses itself separately):
    // shut at its output first, so nothing already on its way out is heard as the app goes (a
    // stray echo of the game as a phone's app was closed), then stopped; opened again as it comes
    // back
    document.addEventListener(
      'visibilitychange',
      () => {
        if (!this.audioContext) return;
        if (document.hidden) {
          this.mixer?.silence(true);
          void this.audioContext.suspend();
        } else if (!this.isStandPaused) {
          void this.audioContext.resume().then(() => this.mixer?.silence(false));
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
    else if (!document.hidden) {
      void this.audioContext.resume().then(() => this.mixer?.silence(false));
    }
  }

  /** The listening stand hears the game through a phone's speaker (Mixer), or as it is. */
  public setPhoneSpeaker(isOn: boolean): void {
    this.isPhoneSpeaker = isOn;
    this.mixer?.setPhoneSpeaker(isOn);
  }

  /**
   * The player's volumes (settings): the music's on the music bus, the sounds' on the action and
   * menu buses. Only acts when one changes.
   */
  public setVolumes(music: Volume, sound: Volume): void {
    if (music === this.volumes.music && sound === this.volumes.sound) return;
    this.volumes = { music, sound };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    const mixer = this.mixer;
    if (!mixer) return;
    const now = mixer.context.currentTime;
    const set = (bus: GainNode, volume: Volume) =>
      bus.gain.setTargetAtTime(volumeGain(volume), now, VOLUME_RAMP);
    set(mixer.music, this.volumes.music);
    set(mixer.sfx, this.volumes.sound);
    set(mixer.menu, this.volumes.sound);
  }

  /** A paddle hit, heard behind the menus too: the sound volume being set, heard as it plays. */
  public previewSound(): void {
    this.unlock();
    this.isAuditioning = true;
    try {
      this.sfx.playPaddleHit(1, false, 0);
    } finally {
      this.isAuditioning = false;
    }
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

  /** Whether the synthwave music is heard now (not muted, not the classic look's loop). */
  public get isMusicHeard(): boolean {
    return this.music.isHeard;
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
      // Its output was shut as the game was hidden: open, now that a gesture brings it back
      void ac
        .resume()
        .then(() => {
          if (!document.hidden) this.mixer?.silence(false);
        })
        .catch(() => {});
      // iOS keeps a resumed context silent until a sound is started inside a gesture, so the
      // music stayed mute until the first paddle hit. A one-sample silent buffer is enough
      this.playSilence(ac);
    }

    if (!this.mixer) {
      this.mixer = new Mixer(ac);
      this.applyVolumes();
      if (this.isPhoneSpeaker) this.mixer.setPhoneSpeaker(true);
      // Rendered off the frame, in the background; the live synths play until they are ready.
      // The action sounds first, the first hit comes within seconds; then the transitions,
      // which every song plays. A song's own instruments are rendered by the music for the song
      // playing and the one coming up (audio/music/palette.ts), and freed after
      const rate = ac.sampleRate;
      void this.samples.renderFirst(rate, ACTION_SAMPLES, ACTION_PITCHED);
      void this.samples.render(rate, TRANSITION_SAMPLES);
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
