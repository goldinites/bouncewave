import { Harmony } from '@/audio/music/HarmonyTimeline';
import { getRallyNote, getWallNote } from '@/audio/sfx/harmony';
import { CHANNEL_SURF } from '@/shared/channelSurf';
import { midiToFrequency } from '@/shared/math';

const SFX_FREQUENCIES = {
  SCORE: 300,
  SETTINGS_CLICK: 660,
  GAME_OVER_CHIME: [523, 659, 784, 1047],
  VICTORY_CHORD: [261.63, 523.25, 659.25, 783.99, 1046.5], // C major, root doubled below
  DEFEAT_LINE: [440, 349.23, 293.66, 220], // A4 F4 D4 A3, falling minor
  FIREWORK_POP_MIN: 600,
  FIREWORK_POP_MAX: 950,
} as const;

// Heartbeat on the deciding point: "lub", then a softer "dub"
const HEARTBEAT = [
  { delay: 0, volume: 0.16 },
  { delay: 0.17, volume: 0.11 },
];

// Shared echo used by the victory sting
const ECHO = { TIME: 0.28, FEEDBACK: 0.35, WET: 0.5 } as const;

export class SoundEffects {
  private audioContextGetter: () => AudioContext | null;
  private isMutedGetter: () => boolean;
  private isGameplayAudibleGetter: () => boolean;
  private harmonyGetter: () => Harmony | null;
  private echoInput: AudioNode | null = null;
  private echoContext: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private noiseContext: AudioContext | null = null;

  /**
   * @param getIsGameplayAudible whether gameplay sounds should play right now (false behind
   *   menus and in the attract-mode demo); `force` beeps ignore it
   */
  constructor(
    getAudioContext: () => AudioContext | null,
    getIsMuted: () => boolean,
    getIsGameplayAudible: () => boolean,
    getHarmony: () => Harmony | null = () => null,
  ) {
    this.audioContextGetter = getAudioContext;
    this.isMutedGetter = getIsMuted;
    this.isGameplayAudibleGetter = getIsGameplayAudible;
    this.harmonyGetter = getHarmony;
  }

  private beep(
    frequency: number,
    duration = 0.08,
    type: OscillatorType = 'square',
    volume = 0.06,
    slide = 0,
    force = false,
  ): void {
    const ac = this.audioContextGetter();
    if (!ac || this.isMutedGetter() || (!this.isGameplayAudibleGetter() && !force)) {
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
    const freq = midiToFrequency(getWallNote(this.harmonyGetter()));
    this.beep(freq, 0.06, 'triangle', 0.07);
  }

  /**
   * Each hit plays the next tone of the chord the music is on, so a rally climbs as a melody.
   * The player and the CPU get different timbres, like a call and response.
   */
  public playPaddleHit(rally: number, isPerfect = false, paddleIndex = 0): void {
    const freq = midiToFrequency(getRallyNote(this.harmonyGetter(), rally));

    if (isPerfect) {
      // Clean sine tone with a soft octave overtone instead of the square blip
      this.beep(freq, 0.22, 'sine', 0.09);
      this.beep(freq * 2, 0.16, 'sine', 0.03);
      return;
    }

    if (paddleIndex === 0) {
      this.beep(freq, 0.12, 'square', 0.05);
    } else {
      this.beep(freq, 0.14, 'triangle', 0.08);
    }
  }

  /** Overdrive power shot: the rally's note as a rising saw roar with a fifth and an octave. */
  public playPowerShot(rally: number): void {
    const freq = midiToFrequency(getRallyNote(this.harmonyGetter(), rally));
    this.beep(freq, 0.32, 'sawtooth', 0.06, 2);
    this.beep(freq * 1.5, 0.26, 'square', 0.035);
    this.beep(freq * 2, 0.4, 'sine', 0.05);
  }

  /** The Overdrive meter just filled: a bright two-tone chime. */
  public playOverdriveReady(): void {
    this.beep(1046.5, 0.16, 'triangle', 0.05, 1.5);
    this.beep(1568, 0.26, 'sine', 0.035);
  }

  public playScore(): void {
    this.beep(SFX_FREQUENCIES.SCORE, 0.35, 'sawtooth', 0.07, 0.3);
  }

  /** Victory sting: rising chime into a sustained major chord with an echo tail. */
  public playVictory(): void {
    const ac = this.getUnmutedContext();
    if (!ac) return;

    try {
      const now = ac.currentTime;
      const echo = this.getEchoInput(ac);

      SFX_FREQUENCIES.GAME_OVER_CHIME.forEach((freq, index) => {
        this.tone(ac, freq, now + index * 0.07, 0.18, 'square', 0.05, 0.005, echo);
      });

      const chordStart = now + 0.3;
      SFX_FREQUENCIES.VICTORY_CHORD.forEach((freq, index) => {
        const isRoot = index === 0;
        this.tone(
          ac,
          freq,
          chordStart,
          1.9,
          isRoot ? 'sine' : 'triangle',
          isRoot ? 0.08 : 0.05,
          0.02,
          echo,
        );
        if (!isRoot) {
          // Slightly detuned saw layer for a synth-brass shimmer
          this.tone(ac, freq * 1.004, chordStart, 1.6, 'sawtooth', 0.012, 0.04, echo);
        }
      });
    } catch {
      // Audio playback fails silently if browser policy blocks it
    }
  }

  /** Defeat: a falling minor line whose last note droops like a dying tape. */
  public playDefeat(): void {
    const ac = this.getUnmutedContext();
    if (!ac) return;

    try {
      const now = ac.currentTime;
      const line = SFX_FREQUENCIES.DEFEAT_LINE;

      line.forEach((freq, index) => {
        const isLast = index === line.length - 1;
        const start = now + index * 0.17;
        this.tone(
          ac,
          freq,
          start,
          isLast ? 0.9 : 0.26,
          'sawtooth',
          0.05,
          0.01,
          null,
          isLast ? 0.55 : 0.97,
        );
      });
    } catch {
      // Audio playback fails silently if browser policy blocks it
    }
  }

  public playFireworkPop(): void {
    const { FIREWORK_POP_MIN: min, FIREWORK_POP_MAX: max } = SFX_FREQUENCIES;
    this.beep(min + Math.random() * (max - min), 0.07, 'triangle', 0.045, 0.45, true);
  }

  /**
   * One heartbeat for the deciding point: a low "lub-dub" of falling sine thumps. A quiet
   * overtone an octave up keeps it audible on phone speakers that can't play the low end.
   */
  public playHeartbeat(): void {
    const ac = this.getUnmutedContext();
    if (!ac || !this.isGameplayAudibleGetter()) return;

    try {
      const now = ac.currentTime;
      HEARTBEAT.forEach(({ delay, volume }) => {
        const start = now + delay;
        this.tone(ac, 110, start, 0.18, 'sine', volume, 0.005, null, 0.5);
        this.tone(ac, 220, start, 0.08, 'triangle', volume * 0.25, 0.005, null, 0.5);
      });
    } catch {
      // Audio playback fails silently if browser policy blocks it
    }
  }

  private getUnmutedContext(): AudioContext | null {
    const ac = this.audioContextGetter();
    return ac && !this.isMutedGetter() ? ac : null;
  }

  /** A single enveloped note; `slide` < 1 bends the pitch down over its length. */
  private tone(
    ac: AudioContext,
    frequency: number,
    start: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    attack: number,
    echo: AudioNode | null,
    slide = 1,
  ): void {
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (slide !== 1) {
      osc.frequency.exponentialRampToValueAtTime(frequency * slide, start + duration);
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(ac.destination);
    if (echo) gain.connect(echo);

    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  /** Lazily built feedback echo shared by stings, so they ring out instead of cutting off. */
  private getEchoInput(ac: AudioContext): AudioNode {
    if (this.echoInput && this.echoContext === ac) return this.echoInput;

    const input = ac.createGain();
    const delay = ac.createDelay(1);
    const feedback = ac.createGain();
    const tone = ac.createBiquadFilter();
    const wet = ac.createGain();

    delay.delayTime.value = ECHO.TIME;
    feedback.gain.value = ECHO.FEEDBACK;
    tone.frequency.value = 3000;
    wet.gain.value = ECHO.WET;

    input.connect(delay);
    delay.connect(tone);
    tone.connect(feedback);
    feedback.connect(delay);
    tone.connect(wet);
    wet.connect(ac.destination);

    this.echoInput = input;
    this.echoContext = ac;
    return input;
  }

  /**
   * The channel surf at the start of a match: a crackle of static at every switch, the last
   * one hissing away as the picture settles.
   */
  public playChannelSurf(): void {
    const ac = this.getUnmutedContext();
    if (!ac) return;

    try {
      const now = ac.currentTime;
      const noise = this.getNoiseBuffer(ac);
      for (let i = 0; i < CHANNEL_SURF.CHANNELS; i++) {
        const isLast = i === CHANNEL_SURF.CHANNELS - 1;
        const start = now + i * CHANNEL_SURF.STEP;
        const duration = isLast ? CHANNEL_SURF.SETTLE : CHANNEL_SURF.STEP * 0.6;
        const source = ac.createBufferSource();
        const band = ac.createBiquadFilter();
        const gain = ac.createGain();

        source.buffer = noise;
        band.type = 'bandpass';
        band.frequency.value = 1800 + i * 400;
        band.Q.value = 0.7;
        gain.gain.setValueAtTime(isLast ? 0.05 : 0.07, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        source.connect(band);
        band.connect(gain);
        gain.connect(ac.destination);
        source.start(start);
        source.stop(start + duration + 0.02);
      }
    } catch {
      // Audio playback fails silently if browser policy blocks it
    }
  }

  /** Half a second of white noise, made once per audio context. */
  private getNoiseBuffer(ac: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseContext === ac) return this.noiseBuffer;

    const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    this.noiseContext = ac;
    return buffer;
  }

  /** UI feedback: settings are only reachable from menus, so it must bypass the gameplay gate. */
  public playSettingsClick(): void {
    this.beep(SFX_FREQUENCIES.SETTINGS_CLICK, 0.08, 'square', 0.06, 0, true);
  }
}
