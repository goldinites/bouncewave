import { dbToGain } from '@/audio/curves';
import { Mixer } from '@/audio/Mixer';
import { Harmony } from '@/audio/music/HarmonyTimeline';
import { HIT_BODIES, HIT_CLICK } from '@/audio/samples/actions';
import { SampleBank } from '@/audio/samples/SampleBank';
import { getRallyNote, getWallNote, MELODY_LOW } from '@/audio/sfx/harmony';
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
  // The Overdrive's power shot, this much louder than a perfect hit: a weapon of neon,
  // electricity and laser (the user, 24.10.2026), one whole sound that evolves rather than a
  // string of them: everything starts with the hit, and what comes later blooms out of it
  // (`SWELL`, s to rise) as the earlier voices fade — the crack and the hit, the laser shot
  // diving onto the note, the electric arc buzzing up, a small explosion (organic, not
  // overdone), the neon tube on the note and an octave above, ringing out last
  POWER: {
    LEVEL: 4,
    CRACK: 0.5,
    BODY: 0.6, // share of a perfect hit's bodies
    PEW: 0.55,
    HIGH_PEW: 0.25,
    ARC: 0.65,
    ARC_FOR: 0.45, // s the arc buzzes
    BLAST: 0.28,
    TUBE: 0.3,
    HIGH_TUBE: 0.15,
    SWELL: { ARC: 0.1, BLAST: 0.08, TUBE: 0.22 },
  },
  // The meter filling, the Overdrive's weapon ready (the user: the armed, neon and lock-on
  // sketches in one), one gesture of a third of a second, each part in its turn so it is heard:
  // the weapon cocked in two clicks, a laser sight's two beeps rising, the chord glowing up tone
  // by tone as neon tubes sparking, an arc humming up on the root under it all; s for the times
  READY: {
    LEVEL: 0,
    HIGH_TUBE: 0.2,
    ARM: 0.45,
    HUM: 0.18,
    HUM_FOR: 0.45,
    HUM_SWELL: 0.08,
    BEAM: 0.2,
    BEEP: 0.05,
    LOCK: 0.05, // the first beep, after the clicks
    LOCK_STEP: 0.06, // between the beeps
    TUBE: 0.45,
    TUBE_SWELL: 0.03, // the tubes glow up rather than click on
    RING: 0.35, // how long each tube rings once lit, well short of the Overdrive's
    HIGH_SWELL: 0.1,
    SPARK: 0.1,
    LIGHT: 0.16, // the first tube lit, as the beeps end
    STEP: 0.05, // between the tubes
  },
  // A wall: a muted knock, well under a paddle's hit
  WALL: { LEVEL: -5, KNOCK: 0.5, THUMP: 0.12 },
  // The opponent's click a little darker, so the two sides answer each other
  CPU_CLICK_RATE: 0.85,
  // Takes in a row differ: the unpitched layers' pitch and every layer's level, as shares
  JITTER: { RATE: 0.04, GAIN: 0.1 },
  // How fast a layer heard only as an attack fades once cut, time constant in s
  CUT_FADE: 0.03,
  // A wide layer: a copy either side of where it sounds, this far apart, this much out of tune
  // (a share of its pitch, about 9 cents), each at this share of its gain
  WIDE: { PAN: 0.7, DETUNE: 0.005, GAIN: 0.75 },
  // How far across the stereo field a hit at the court's edge sits
  PAN: 0.6,
} as const;

// The action sounds grow with the music's heat (MusicEngine.getHeat), dB against a verse's: soft
// on the serve and in calm moments, louder as the rally heats up and the music climbs to its
// peak, where they would otherwise sink (the user, 24.10.2026). Straight between the points
const HEAT_LEVEL = [
  { heat: 0.25, db: -3 }, // the serve
  { heat: 0.45, db: 0 }, // a rally under way, the verses
  { heat: 0.85, db: 4 }, // the peak
] as const;

/** dB the action sounds play at, at the music's `heat`. */
export function heatLevel(heat: number): number {
  const first = HEAT_LEVEL[0];
  const last = HEAT_LEVEL[HEAT_LEVEL.length - 1];
  if (heat <= first.heat) return first.db;
  if (heat >= last.heat) return last.db;
  const upper = HEAT_LEVEL.findIndex((point) => point.heat >= heat);
  const [a, b] = [HEAT_LEVEL[upper - 1], HEAT_LEVEL[upper]];
  return a.db + ((heat - a.heat) / (b.heat - a.heat)) * (b.db - a.db);
}

/** Where a hit lands and how hard: `pan` from -1 (the left edge) to 1, `force` from 0 to 1. */
export interface HitFeel {
  pan?: number;
  force?: number;
}

/** One rendered layer to play: a tuned body at a note, or a one-shot. */
type Layer =
  | {
      tuned: string;
      note: number;
      gain: number;
      cut?: number;
      delay?: number;
      wide?: boolean;
      /** Where it sounds, in place of the action's own place. */
      pan?: number;
      swell?: number;
    }
  | { shot: string; gain: number; rate?: number; delay?: number; swell?: number };

/** Which of the mixer's buses a sound plays on. */
type Bus = 'sfx' | 'menu';

export class SoundEffects {
  private audioContextGetter: () => AudioContext | null;
  private isMutedGetter: () => boolean;
  private isGameplayAudibleGetter: () => boolean;
  private harmonyGetter: () => Harmony | null;
  private mixerGetter: () => Mixer | null;
  private samplesGetter: () => SampleBank | null;
  private heatGetter: () => number;
  private echoInput: AudioNode | null = null;
  private echoContext: AudioContext | null = null;
  /** While set, the layered sounds play as their live synths (`playAsSynth`). */
  private isSynthOnly = false;

  /**
   * @param getIsGameplayAudible whether gameplay sounds should play right now (false behind
   *   menus and in the attract-mode demo); `force` beeps ignore it
   * @param getMixer the master the sounds play into; without one they go straight out
   * @param getSamples the rendered layers; until they are ready the sounds play as live synths
   * @param getHeat how hot the music is, 0-1: the sounds grow louder with it; a verse's if none
   */
  constructor(
    getAudioContext: () => AudioContext | null,
    getIsMuted: () => boolean,
    getIsGameplayAudible: () => boolean,
    getHarmony: () => Harmony | null = () => null,
    getMixer: () => Mixer | null = () => null,
    getSamples: () => SampleBank | null = () => null,
    getHeat: () => number = () => HEAT_LEVEL[1].heat,
  ) {
    this.audioContextGetter = getAudioContext;
    this.isMutedGetter = getIsMuted;
    this.isGameplayAudibleGetter = getIsGameplayAudible;
    this.harmonyGetter = getHarmony;
    this.mixerGetter = getMixer;
    this.samplesGetter = getSamples;
    this.heatGetter = getHeat;
  }

  /**
   * Plays whatever `play` plays with the layered sounds as their live synths, the game's sounds
   * before they were rendered in layers — for the sound stand to compare the old with the new.
   */
  public playAsSynth(play: () => void): void {
    this.isSynthOnly = true;
    try {
      play();
    } finally {
      this.isSynthOnly = false;
    }
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

  /** A wall bounce: a muted knock on the chord's fifth, where on the court it bounced (`pan`). */
  public playWallBounce(pan = 0): void {
    const note = getWallNote(this.harmonyGetter());
    const { WALL } = HIT_MIX;
    const layers: Layer[] = [
      { tuned: 'wall', note, gain: WALL.KNOCK },
      { shot: 'thump', gain: WALL.THUMP, rate: 1.4 },
    ];
    if (this.playLayers(layers, HIT_MIX.LEVEL + WALL.LEVEL, pan)) return;
    this.beep(midiToFrequency(note), 0.06, 'triangle', 0.07);
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
    const isCpu = paddleIndex !== 0;
    const hard = clamp(force, 0, 1);
    const strength = isPerfect ? 1 : 0.5 + 0.5 * hard;
    const click: Layer = {
      shot: HIT_CLICK,
      gain: HIT_MIX.CLICK * strength,
      rate: isCpu ? HIT_MIX.CPU_CLICK_RATE : 1,
    };
    const { PERFECT } = HIT_MIX;
    const layers = isPerfect
      ? [
          click,
          ...this.bodies(note, PERFECT.BODY, isCpu),
          { tuned: HIT_BODIES[0].id, note: note + 12, gain: PERFECT.OCTAVE },
          { shot: 'thump', gain: PERFECT.THUMP },
          { shot: 'spark', gain: PERFECT.SPARK },
          { shot: 'boom', gain: PERFECT.BOOM },
          { shot: 'tail', gain: PERFECT.TAIL },
        ]
      : [
          click,
          ...this.bodies(note, HIT_MIX.BODY, isCpu),
          { shot: 'thump', gain: HIT_MIX.THUMP * (0.4 + 0.6 * hard) },
          ...(hard > 0.5 ? [{ shot: 'spark', gain: HIT_MIX.SPARK * (hard - 0.5) * 2 }] : []),
        ];
    const level =
      HIT_MIX.LEVEL + (isCpu ? HIT_MIX.CPU_LEVEL : 0) + (isPerfect ? HIT_MIX.PERFECT_LEVEL : 0);
    if (!this.playLayers(layers, level, pan)) return false;
    if (isPerfect) this.duckMusic(HIT_DUCK.PERFECT);
    this.mixerGetter()?.carveForHit(strength);
    return true;
  }

  /** The hit's tuned bodies at `note` (the opponent's twins), `gain` shared out among them. */
  private bodies(note: number, gain: number, isCpu = false, whole = false): Layer[] {
    return HIT_BODIES.map((body) => ({
      tuned: `${body.id}${isCpu ? '.cpu' : ''}`,
      note,
      gain: gain * body.gain,
      cut: whole ? undefined : body.cut,
    }));
  }

  /**
   * Plays rendered layers together, at `levelDb` with the music's heat on top, at `pan`; false if
   * they aren't rendered yet, for the live synth to play instead (true and silent while the game
   * can't be heard).
   */
  private playLayers(layers: Layer[], levelDb: number, pan: number): boolean {
    if (this.isSynthOnly) return false;
    const samples = this.samplesGetter();
    // The layers are rendered all at once, the bodies last
    if (!samples?.pickNote(HIT_BODIES[0].id, MELODY_LOW)) return false;
    const ac = this.audioContextGetter();
    if (!ac || this.isMutedGetter() || !this.isGameplayAudibleGetter()) return true;

    const trim = dbToGain(levelDb + heatLevel(this.heatGetter()));
    const at = { ac, trim, pan: clamp(pan, -1, 1) * HIT_MIX.PAN };
    for (const layer of layers) {
      if ('tuned' in layer) {
        const tuned = samples.pickNote(layer.tuned, layer.note);
        if (!tuned) continue;
        const { buffer, rate } = tuned;
        if (!layer.wide) {
          this.layer({ ...at, ...layer, pan: layer.pan ?? at.pan, buffer, rate });
          continue;
        }
        // Wide: a copy either side, a hair apart in pitch, so it fills the whole field
        const { PAN, DETUNE, GAIN } = HIT_MIX.WIDE;
        for (const side of [-1, 1]) {
          this.layer({
            ...at,
            ...layer,
            buffer,
            rate: rate * (1 + side * DETUNE),
            gain: layer.gain * GAIN,
            pan: clamp(at.pan + side * PAN, -1, 1),
          });
        }
      } else {
        const buffer = samples.pick(layer.shot);
        const rate = (layer.rate ?? 1) * this.jitter(HIT_MIX.JITTER.RATE);
        if (buffer) this.layer({ ...at, ...layer, buffer, rate });
      }
    }
    return true;
  }

  /** A share of 1 either way, for takes in a row that differ a little. */
  private jitter(share: number): number {
    return 1 + (Math.random() * 2 - 1) * share;
  }

  /**
   * One rendered layer, `delay` seconds from now, at `gain` (jittered) times the sound's `trim`,
   * panned, played at `rate`; rising over `swell` seconds, if given, for a layer that blooms out
   * of the others; faded out after `cut` seconds, if given, for one heard only as an attack.
   */
  private layer({
    ac,
    buffer,
    gain,
    rate,
    pan,
    trim,
    cut,
    swell,
    delay = 0,
  }: {
    ac: AudioContext;
    buffer: AudioBuffer;
    gain: number;
    rate: number;
    pan: number;
    trim: number;
    cut?: number;
    swell?: number;
    delay?: number;
  }): void {
    try {
      const start = ac.currentTime + delay;
      const source = ac.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      const level = ac.createGain();
      const peak = gain * trim * this.jitter(HIT_MIX.JITTER.GAIN);
      level.gain.value = peak;
      if (swell !== undefined) {
        level.gain.setValueAtTime(0.0001, start);
        level.gain.exponentialRampToValueAtTime(peak, start + swell);
      }
      if (cut !== undefined) level.gain.setTargetAtTime(0, start + cut, HIT_MIX.CUT_FADE);
      const panner = ac.createStereoPanner();
      panner.pan.value = pan;
      source.connect(level).connect(panner).connect(this.output(ac));
      source.start(start);
    } catch {
      // Audio playback fails silently if browser policy blocks it
    }
  }

  /**
   * The Overdrive's power shot, a weapon of neon, electricity and laser (the user, 24.10.2026):
   * the sound barrier cracking, a laser shot, an arc, a neon tube lit on the note; heard where
   * it was struck (`pan`), the music dipping fully under it.
   */
  public playPowerShot(rally: number, pan = 0): void {
    const note = getRallyNote(this.harmonyGetter(), rally);
    const { PERFECT, POWER } = HIT_MIX;
    const { SWELL } = POWER;
    const layers: Layer[] = [
      { shot: HIT_CLICK, gain: HIT_MIX.CLICK },
      { shot: 'crack', gain: POWER.CRACK },
      ...this.bodies(note, PERFECT.BODY * POWER.BODY),
      { shot: 'thump', gain: PERFECT.THUMP },
      { shot: 'boom', gain: PERFECT.BOOM },
      { shot: 'spark', gain: PERFECT.SPARK },
      { tuned: 'pew', note, gain: POWER.PEW, wide: true },
      { tuned: 'pew', note: note + 12, gain: POWER.HIGH_PEW, wide: true },
      { tuned: 'arc', note, gain: POWER.ARC, swell: SWELL.ARC, cut: POWER.ARC_FOR, wide: true },
      { shot: 'blast', gain: POWER.BLAST, swell: SWELL.BLAST },
      { tuned: 'tube', note, gain: POWER.TUBE, swell: SWELL.TUBE, wide: true },
      { tuned: 'tube', note: note + 12, gain: POWER.HIGH_TUBE, swell: SWELL.TUBE, wide: true },
      { shot: 'tail', gain: PERFECT.TAIL },
    ];
    const level = HIT_MIX.LEVEL + HIT_MIX.PERFECT_LEVEL + POWER.LEVEL;
    const played = this.playLayers(layers, level, pan);
    this.duckMusic(HIT_DUCK.POWER_SHOT, true);
    if (played) {
      this.mixerGetter()?.carveForHit(1);
      return;
    }
    const freq = midiToFrequency(note);
    this.beep(freq, 0.32, 'sawtooth', 0.06, 2);
    this.beep(freq * 1.5, 0.26, 'square', 0.035);
    this.beep(freq * 2, 0.4, 'sine', 0.05);
  }

  /** The meter's chime on the chord the music is on: armed, locked on, lit. */
  private readyLayers(harmony: Harmony | null): Layer[] {
    const { READY } = HIT_MIX;
    const tone = (step: number) => getRallyNote(harmony, step) + 12;
    const lit = (step: number) => READY.LIGHT + step * READY.STEP;
    return [
      { shot: 'arm', gain: READY.ARM },
      {
        tuned: 'arc',
        note: tone(1) - 12,
        gain: READY.HUM,
        swell: READY.HUM_SWELL,
        cut: READY.HUM_FOR,
        wide: true,
      },
      { tuned: 'beam', note: tone(1), gain: READY.BEAM, delay: READY.LOCK, cut: READY.BEEP },
      {
        tuned: 'beam',
        note: tone(3),
        gain: READY.BEAM,
        delay: READY.LOCK + READY.LOCK_STEP,
        cut: READY.BEEP,
      },
      ...[0, 1, 2].flatMap((step) => [
        {
          tuned: 'tube',
          note: tone(step + 1),
          gain: READY.TUBE,
          delay: lit(step),
          swell: READY.TUBE_SWELL,
          cut: READY.RING,
          wide: true,
        },
        // The last tube glows an octave higher too, the chime's peak
        ...(step === 2
          ? [
              {
                tuned: 'tube',
                note: tone(3) + 12,
                gain: READY.HIGH_TUBE,
                delay: lit(2),
                swell: READY.HIGH_SWELL,
                cut: READY.RING,
                wide: true,
              },
            ]
          : []),
      ]),
      { shot: 'spark', gain: READY.SPARK, delay: lit(0) },
      { shot: 'spark', gain: READY.SPARK, delay: lit(2) },
    ];
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

  /**
   * The Overdrive meter just filled, its weapon ready: cocked in two clicks, a laser sight
   * locking on, the chord lit as neon tubes.
   */
  public playOverdriveReady(pan = 0): void {
    const harmony = this.harmonyGetter();
    const { READY } = HIT_MIX;
    const layers = this.readyLayers(harmony);
    if (this.playLayers(layers, HIT_MIX.LEVEL + READY.LEVEL, pan)) return;
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
  private duckMusic(strength: number, isLong = false): void {
    if (this.isMutedGetter() || !this.isGameplayAudibleGetter()) return;
    this.mixerGetter()?.duckMusic(strength, isLong);
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
