import { dbToGain } from '@/audio/curves';
import { Mixer } from '@/audio/Mixer';
import { Harmony } from '@/audio/music/HarmonyTimeline';
import { HIT_BODIES, HIT_CLICK } from '@/audio/samples/actions';
import { SampleBank } from '@/audio/samples/SampleBank';
import { getRallyNote, getWallNote } from '@/audio/sfx/harmony';
import { CHANNEL_SURF } from '@/shared/channelSurf';
import { clamp, midiToFrequency } from '@/shared/math';

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

// The channel surf's last channel starts this far flat and glides up onto its note
const TUNE_IN_FLAT = 0.94;

// Shared echo used by the victory sting
const ECHO = { TIME: 0.28, FEEDBACK: 0.35, WET: 0.5 } as const;

// How far the music dips under a strong hit (Mixer.duckMusic), so the hit punches through;
// ordinary hits leave it alone, or a long rally would pump the music on every beat
const HIT_DUCK = { PERFECT: 0.6, POWER_SHOT: 1 } as const;

// A paddle hit's layers (audio/samples/actions.ts), their gains at full strength: the click of
// contact, the tuned body, the thump, sparks off a hard hit; the perfect hit adds the body an
// octave up, a boom and a ringing tail. The harder the hit, the louder the click and the thump
const HIT_MIX = {
  CLICK: 0.25,
  BODY: 0.21,
  THUMP: 0.18,
  SPARK: 0.1,
  PERFECT: { BODY: 0.28, OCTAVE: 0.1, THUMP: 0.28, SPARK: 0.18, BOOM: 0.25, TAIL: 0.08 },
  // dB the whole hit sits at, the opponent's against the player's, and the perfect hit's above an
  // ordinary one (the user, 24.10.2026): an ordinary hit sits back in the game, at the edge of
  // being heard over a peak; a perfect one stands out of it, the reward heard
  LEVEL: -11,
  CPU_LEVEL: -1,
  PERFECT_LEVEL: 5,
  // The opponent's click a little darker, so the two sides answer each other
  CPU_CLICK_RATE: 0.85,
  // Takes in a row differ: the unpitched layers' pitch and every layer's level, as shares
  JITTER: { RATE: 0.04, GAIN: 0.1 },
  // How fast a layer heard only as an attack fades once cut, time constant in s
  CUT_FADE: 0.03,
  // How far across the stereo field a hit at the court's edge sits
  PAN: 0.6,
} as const;

/** Where a hit lands and how hard: `pan` from -1 (the left edge) to 1, `force` from 0 to 1. */
export interface HitFeel {
  pan?: number;
  force?: number;
}

/** Which of the mixer's buses a sound plays on. */
type Bus = 'sfx' | 'menu';

export class SoundEffects {
  private audioContextGetter: () => AudioContext | null;
  private isMutedGetter: () => boolean;
  private isGameplayAudibleGetter: () => boolean;
  private harmonyGetter: () => Harmony | null;
  private mixerGetter: () => Mixer | null;
  private samplesGetter: () => SampleBank | null;
  private echoInput: AudioNode | null = null;
  private echoContext: AudioContext | null = null;

  /**
   * @param getIsGameplayAudible whether gameplay sounds should play right now (false behind
   *   menus and in the attract-mode demo); `force` beeps ignore it
   * @param getMixer the master the sounds play into; without one they go straight out
   * @param getSamples the rendered layers; until they are ready the sounds play as live synths
   */
  constructor(
    getAudioContext: () => AudioContext | null,
    getIsMuted: () => boolean,
    getIsGameplayAudible: () => boolean,
    getHarmony: () => Harmony | null = () => null,
    getMixer: () => Mixer | null = () => null,
    getSamples: () => SampleBank | null = () => null,
  ) {
    this.audioContextGetter = getAudioContext;
    this.isMutedGetter = getIsMuted;
    this.isGameplayAudibleGetter = getIsGameplayAudible;
    this.harmonyGetter = getHarmony;
    this.mixerGetter = getMixer;
    this.samplesGetter = getSamples;
  }

  /** Where a sound on `bus` goes: its bus on the mixer, or the speakers if there is none. */
  private output(ac: AudioContext, bus: Bus = 'sfx'): AudioNode {
    return this.mixerGetter()?.[bus] ?? ac.destination;
  }

  private beep(
    frequency: number,
    duration = 0.08,
    type: OscillatorType = 'square',
    volume = 0.06,
    slide = 0,
    force = false,
    bus: Bus = 'sfx',
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

      osc.connect(gain).connect(this.output(ac, bus));
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
  public playPaddleHit(
    rally: number,
    isPerfect = false,
    paddleIndex = 0,
    feel: HitFeel = {},
  ): void {
    const note = getRallyNote(this.harmonyGetter(), rally);
    if (this.playLayeredHit(note, isPerfect, paddleIndex, feel)) return;
    const freq = midiToFrequency(note);

    if (isPerfect) {
      this.duckMusic(HIT_DUCK.PERFECT);
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

  /**
   * The hit from its rendered layers, mixed by how hard it is; false if they aren't rendered
   * yet, for the live synth to play instead.
   */
  private playLayeredHit(
    note: number,
    isPerfect: boolean,
    paddleIndex: number,
    { pan = 0, force = 0.5 }: HitFeel,
  ): boolean {
    const samples = this.samplesGetter();
    const isCpu = paddleIndex !== 0;
    const bodies = HIT_BODIES.map(({ id, gain, cut }) => ({
      note: samples?.pickNote(`${id}${isCpu ? '.cpu' : ''}`, note),
      gain,
      cut,
    }));
    if (!samples || bodies.some((body) => !body.note)) return false;

    const ac = this.audioContextGetter();
    if (!ac || this.isMutedGetter() || !this.isGameplayAudibleGetter()) return true;

    const hard = clamp(force, 0, 1);
    const strength = isPerfect ? 1 : 0.5 + 0.5 * hard;
    const trim = dbToGain(
      HIT_MIX.LEVEL + (isCpu ? HIT_MIX.CPU_LEVEL : 0) + (isPerfect ? HIT_MIX.PERFECT_LEVEL : 0),
    );
    const at = { ac, pan: clamp(pan, -1, 1) * HIT_MIX.PAN, trim };
    const unpitched = (id: string, gain: number, rate = 1) => {
      const buffer = samples.pick(id);
      if (buffer)
        this.layer({ ...at, buffer, gain, rate: rate * this.jitter(HIT_MIX.JITTER.RATE) });
    };

    unpitched(HIT_CLICK, HIT_MIX.CLICK * strength, isCpu ? HIT_MIX.CPU_CLICK_RATE : 1);
    const playBodies = (level: number) => {
      for (const body of bodies) {
        const { buffer, rate } = body.note!;
        this.layer({ ...at, buffer, rate, gain: level * body.gain, cut: body.cut });
      }
    };
    if (isPerfect) {
      const { PERFECT } = HIT_MIX;
      playBodies(PERFECT.BODY);
      const octave = samples.pickNote(HIT_BODIES[0].id, note + 12);
      if (octave)
        this.layer({ ...at, buffer: octave.buffer, rate: octave.rate, gain: PERFECT.OCTAVE });
      unpitched('thump', PERFECT.THUMP);
      unpitched('spark', PERFECT.SPARK);
      unpitched('boom', PERFECT.BOOM);
      unpitched('tail', PERFECT.TAIL);
      this.duckMusic(HIT_DUCK.PERFECT);
    } else {
      playBodies(HIT_MIX.BODY);
      unpitched('thump', HIT_MIX.THUMP * (0.4 + 0.6 * hard));
      if (hard > 0.5) unpitched('spark', HIT_MIX.SPARK * (hard - 0.5) * 2);
    }
    this.mixerGetter()?.carveForHit(strength);
    return true;
  }

  /** A share of 1 either way, for takes in a row that differ a little. */
  private jitter(share: number): number {
    return 1 + (Math.random() * 2 - 1) * share;
  }

  /**
   * One rendered layer, now, at `gain` (jittered), panned, played at `rate`; faded out after
   * `cut` seconds, if given, for a layer heard only as an attack.
   */
  private layer({
    ac,
    buffer,
    gain,
    rate,
    pan,
    trim,
    cut,
  }: {
    ac: AudioContext;
    buffer: AudioBuffer;
    gain: number;
    rate: number;
    pan: number;
    /** The hit's own level, on every layer. */
    trim: number;
    cut?: number;
  }): void {
    try {
      const source = ac.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      const level = ac.createGain();
      level.gain.value = gain * trim * this.jitter(HIT_MIX.JITTER.GAIN);
      if (cut !== undefined) level.gain.setTargetAtTime(0, ac.currentTime + cut, HIT_MIX.CUT_FADE);
      const panner = ac.createStereoPanner();
      panner.pan.value = pan;
      source.connect(level).connect(panner).connect(this.output(ac));
      source.start();
    } catch {
      // Audio playback fails silently if browser policy blocks it
    }
  }

  /** Overdrive power shot: the rally's note as a rising saw roar with a fifth and an octave. */
  public playPowerShot(rally: number): void {
    const freq = midiToFrequency(getRallyNote(this.harmonyGetter(), rally));
    this.duckMusic(HIT_DUCK.POWER_SHOT);
    this.beep(freq, 0.32, 'sawtooth', 0.06, 2);
    this.beep(freq * 1.5, 0.26, 'square', 0.035);
    this.beep(freq * 2, 0.4, 'sine', 0.05);
  }

  /** A ball sent off spinning (Arc): a whistle, higher the harder it curves, `strength` in [0, 1]. */
  public playSpin(strength: number): void {
    const freq = 900 + 900 * strength;
    this.beep(freq, 0.34, 'sine', 0.025 + 0.025 * strength, 1.35);
  }

  /** A shot read ahead (Analyzer): a quiet machine chirp, two short rising blips. */
  public playScan(): void {
    this.beep(1760, 0.05, 'square', 0.018, 1.2);
    this.beep(2349, 0.07, 'sine', 0.02, 1.1);
  }

  /** The world slows down (Reflex): a glitch, then a falling drone. */
  public playTimeWarp(): void {
    this.beep(1320, 0.06, 'square', 0.035, 0.5);
    this.beep(660, 0.09, 'square', 0.03, 1.8);
    this.beep(196, 0.6, 'sawtooth', 0.04, 0.6);
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

  /** The music dips for a moment under a strong hit, if the hit is heard at all. */
  private duckMusic(strength: number): void {
    if (this.isMutedGetter() || !this.isGameplayAudibleGetter()) return;
    this.mixerGetter()?.duckMusic(strength);
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
    gain.connect(this.output(ac));
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
    wet.connect(this.output(ac));

    this.echoInput = input;
    this.echoContext = ac;
    return input;
  }

  /**
   * The channel surf at the start of a match: a synth blip at every switch, climbing the chord
   * the music is playing like a retro set's channel-up button, then the last channel tunes in,
   * gliding up onto the top note and ringing out through the echo.
   */
  public playChannelSurf(): void {
    const ac = this.getUnmutedContext();
    if (!ac) return;

    try {
      const now = ac.currentTime;
      const harmony = this.harmonyGetter();
      const last = CHANNEL_SURF.CHANNELS - 1;

      for (let i = 0; i < last; i++) {
        const start = now + i * CHANNEL_SURF.STEP;
        const frequency = midiToFrequency(getRallyNote(harmony, i + 1));
        // A click of the button, then the blip itself
        this.tone(ac, 2400, start, 0.012, 'triangle', 0.03, 0.001, null);
        this.tone(
          ac,
          frequency,
          start + 0.005,
          CHANNEL_SURF.STEP * 0.7,
          'square',
          0.04,
          0.004,
          null,
        );
      }

      const start = now + last * CHANNEL_SURF.STEP;
      const frequency = midiToFrequency(getRallyNote(harmony, CHANNEL_SURF.CHANNELS));
      const echo = this.getEchoInput(ac);
      this.tone(ac, 2400, start, 0.012, 'triangle', 0.03, 0.001, null);
      // Tuning in: from a little flat up onto the note, the way a dial finds the station
      this.tone(
        ac,
        frequency * TUNE_IN_FLAT,
        start,
        0.5,
        'triangle',
        0.06,
        0.01,
        echo,
        1 / TUNE_IN_FLAT,
      );
      this.tone(ac, frequency * 2, start + 0.06, 0.4, 'sine', 0.025, 0.02, echo);
    } catch {
      // Audio playback fails silently if browser policy blocks it
    }
  }

  /** UI feedback: settings are only reachable from menus, so it must bypass the gameplay gate. */
  public playSettingsClick(): void {
    this.beep(SFX_FREQUENCIES.SETTINGS_CLICK, 0.08, 'square', 0.06, 0, true, 'menu');
  }
}
