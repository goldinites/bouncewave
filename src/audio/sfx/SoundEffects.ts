import { dbToGain } from '@/audio/curves';
import { Mixer } from '@/audio/Mixer';
import { Harmony } from '@/audio/music/HarmonyTimeline';
import { HIT_BODIES, HIT_CLICK } from '@/audio/samples/actions';
import { SampleBank } from '@/audio/samples/SampleBank';
import { getClimbingRallyNote, getRallyNote, getWallNote, MELODY_LOW } from '@/audio/sfx/harmony';
import { CHANNEL_SURF } from '@/shared/channelSurf';
import { clamp, midiToFrequency } from '@/shared/math';

const SFX_FREQUENCIES = {
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

// The layered sounds (audio/samples/actions.ts): the Overdrive, its meter filling and the wall.
// dB they sit at, an ordinary hit's level in a verse, each sound's own on top
const LAYER_MIX = {
  LEVEL: -11,
  // The Overdrive's power shot, this much louder: a weapon of neon, electricity and laser (the
  // user, 24.10.2026), one whole sound that evolves rather than a string of them: everything
  // starts with the hit, and what comes later blooms out of it (`SWELL`, s to rise) as the
  // earlier voices fade — the crack and the hit (a click, the tuned bodies, a thump, a boom,
  // sparks), the laser shot diving onto the note, the electric arc buzzing up, a small explosion
  // (organic, not overdone), the neon tube on the note and an octave above, ringing out last
  POWER: {
    LEVEL: 9,
    CLICK: 0.25,
    CRACK: 0.5,
    BODY: 0.168,
    THUMP: 0.28,
    BOOM: 0.25,
    SPARK: 0.18,
    TAIL: 0.08,
    PEW: 0.55,
    HIGH_PEW: 0.25,
    ARC: 0.65,
    ARC_FOR: 0.45, // s the arc buzzes
    BLAST: 0.28,
    TUBE: 0.3,
    HIGH_TUBE: 0.15,
    SWELL: { ARC: 0.1, BLAST: 0.08, TUBE: 0.22 },
  },
  // The meter filling, the Overdrive's weapon ready (the user: the lock-on and neon sketches in
  // one), one short gesture, each part in its turn so it is heard: a laser sight's two beeps
  // rising, the chord glowing up tone by tone as neon tubes sparking, an arc humming up on the
  // root under it all; s for the times
  READY: {
    LEVEL: 0,
    HIGH_TUBE: 0.2,
    HUM: 0.18,
    HUM_FOR: 0.45,
    HUM_SWELL: 0.08,
    BEAM: 0.2,
    BEEP: 0.05,
    LOCK_STEP: 0.06, // between the beeps
    TUBE: 0.45,
    TUBE_SWELL: 0.03, // the tubes glow up rather than click on
    RING: 0.35, // how long each tube rings once lit, well short of the Overdrive's
    HIGH_SWELL: 0.1,
    SPARK: 0.1,
    LIGHT: 0.11, // the first tube lit, as the beeps end
    STEP: 0.05, // between the tubes
  },
  // A wall: a muted knock, well under a paddle's hit
  WALL: { LEVEL: -5, KNOCK: 0.5, THUMP: 0.12 },
  // Takes in a row differ: the unpitched layers' pitch and every layer's level, as shares
  JITTER: { RATE: 0.04, GAIN: 0.1 },
  // How fast a layer heard only as an attack fades once cut, time constant in s
  CUT_FADE: 0.03,
  // A wide layer: a copy either side of where it sounds, this far apart, this much out of tune
  // (a share of its pitch, about 9 cents), each at this share of its gain
  WIDE: { PAN: 0.7, DETUNE: 0.005, GAIN: 0.75 },
} as const;

// How far across the stereo field a sound at the court's edge sits
const COURT_PAN = 0.6;

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

// The paddle hits, the old beeps refined (the user after the playtest, 24.10.2026: Pong lives on
// its beep, and a short clean tone plays as a note of the music, where layered hits fought the
// chord and the kick). Peaks and lengths in s. An ordinary hit: the player's square and the
// opponent's triangle answering each other, each dropping onto its note so it snaps rather than
// beeps, brighter and louder the harder it is struck. A perfect hit, the reward: a sine and its
// octave with a glint two octaves up, landing with a punch — a console's noise channel cracking
// and a square dropping from an octave under the note two octaves further, an 8-bit kick
const HIT = {
  PLAYER: { WAVE: 'square', VOLUME: 0.1, LENGTH: 0.12 },
  CPU: { WAVE: 'triangle', VOLUME: 0.16, LENGTH: 0.14 },
  // Hz a lowpass opens to from the softest hit to the hardest, and the softest's share of volume
  BRIGHT: { SOFT: 2500, HARD: 9000 },
  SOFT_VOLUME: 0.8,
  // Semitones above the note a hit starts, s it takes to drop onto it
  SNAP: { FROM: 2, TIME: 0.015 },
  PERFECT: {
    VOLUME: 0.18,
    LENGTH: 0.22,
    OCTAVE: 0.06,
    OCTAVE_LENGTH: 0.16,
    GLINT: 0.05,
    GLINT_LENGTH: 0.12,
  },
  PUNCH: { NOISE: 0.14, NOISE_LENGTH: 0.05, KICK: 0.2, KICK_LENGTH: 0.1, GLIDE: 0.08 },
  NOISE_HOLD: 4, // samples each noise value is held, for a console's grit
  JITTER: 0.1, // share either way the volume differs from hit to hit
} as const;

// The point's sounds (5.7b), in the hits' beep idiom and on the chord the music is on; two
// sketches of each to choose from by ear (`setPointSketches`, the sound stand). Peaks and
// lengths in s, notes as offsets over the chord's root (MIDI 28-39).
// - The serve: a quiet countdown — two ticks, then a pip as the ball leaves — so the player can
//   time it by ear; on the deciding point a sting announces it in place of the ticks.
// - A point won rises up the chord, a reward; a point lost falls two notes, darker and shorter,
//   never a buzzer: losing one of many points must not sting. Both from the goal it went in
export const POINT_SKETCHES = ['a', 'b'] as const;
export type PointSketch = (typeof POINT_SKETCHES)[number];
export const POINT_SOUNDS = ['serve', 'won', 'lost', 'decider'] as const;
export type PointSound = (typeof POINT_SOUNDS)[number];
export type PointSketches = Record<PointSound, PointSketch>;

const POINT = {
  // a: a sine blip on the root; b: a triangle snapping onto the fifth
  TICK: { OFFSET: 36, VOLUME: 0.035, LENGTH: 0.04, SNAP_VOLUME: 0.05, SNAP_LENGTH: 0.05 },
  // a: a square pip an octave over the tick, snapping; b: the root and its fifth flicked up
  GO: { OFFSET: 48, VOLUME: 0.06, LENGTH: 0.09, CUTOFF: 4000, STEP: 0.05, FLICK_LENGTH: 0.07 },
  // a: a square arpeggio with the noise channel's crack; b: a sine one, the top ringing with a glint
  WON: {
    OFFSET: 36,
    VOLUME: 0.09,
    STEP: 0.05,
    LENGTH: 0.12,
    CUTOFF: 6000,
    CRACK: 0.1,
    CRACK_LENGTH: 0.05,
    RING: 0.35,
    SINE_VOLUME: 0.12,
    GLINT: 0.04,
  },
  // a: a triangle falling fifth to root; b: a muffled square third to root, sagging a semitone
  LOST: { OFFSET: 24, VOLUME: 0.12, STEP: 0.1, LENGTH: 0.12, SQUARE: 0.07, CUTOFF: 1500, SAG: 0.2 },
  // a: a low chord through a closed filter; b: a gong, a struck bar's inharmonic partials
  DECIDER: {
    OFFSET: 12,
    VOLUME: 0.07,
    LENGTH: 1.2,
    CUTOFF: 900,
    GONG_OFFSET: 24,
    GONG: [
      { ratio: 1, volume: 0.15, length: 1.6 },
      { ratio: 2.76, volume: 0.06, length: 0.9 },
      { ratio: 5.4, volume: 0.03, length: 0.5 },
    ],
  },
} as const;

/** One tone of a hit. */
interface Tone {
  frequency: number;
  wave: OscillatorType;
  volume: number;
  length: number;
  pan: number;
  /** Hz of a lowpass over it, if any. */
  cutoff?: number;
  /** Semitones above `frequency` it starts at, dropping onto it. */
  from?: number;
  /** s it takes to drop from `from` onto the note; a snap's if not given. */
  glide?: number;
  /** s from now it is struck. */
  delay?: number;
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
  private pointSketches: PointSketches = { serve: 'a', won: 'a', lost: 'a', decider: 'a' };
  /** The punch's console noise, rendered once for `noiseContext`. */
  private noise: AudioBuffer | null = null;
  private noiseContext: AudioContext | null = null;

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

  /** Which sketch each of the point's sounds plays (the sound stand's). */
  public get pointSketch(): Readonly<PointSketches> {
    return this.pointSketches;
  }

  public setPointSketch(sound: PointSound, sketch: PointSketch): void {
    this.pointSketches = { ...this.pointSketches, [sound]: sketch };
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
    const { WALL } = LAYER_MIX;
    const layers: Layer[] = [
      { tuned: 'wall', note, gain: WALL.KNOCK },
      { shot: 'thump', gain: WALL.THUMP, rate: 1.4 },
    ];
    if (this.playLayers(layers, LAYER_MIX.LEVEL + WALL.LEVEL, pan)) return;
    this.beep(midiToFrequency(note), 0.06, 'triangle', 0.07);
  }

  /**
   * Each hit plays the next tone of the chord the music is on, so a rally climbs it as a
   * melody; the player and the CPU get different timbres, like a call and response. Heard where
   * it was struck (`feel.pan`), brighter and louder the harder (`feel.force`); a perfect hit
   * rings out over it as the reward, landing with a punch, the music dipping under it.
   */
  public playPaddleHit(
    rally: number,
    isPerfect = false,
    paddleIndex = 0,
    { pan = 0, force = 0.5 }: HitFeel = {},
  ): void {
    const note = getClimbingRallyNote(this.harmonyGetter(), rally);
    const ac = this.audioContextGetter();
    if (!ac || this.isMutedGetter() || !this.isGameplayAudibleGetter()) return;

    const hard = clamp(force, 0, 1);
    const trim = dbToGain(heatLevel(this.heatGetter()));
    const at = clamp(pan, -1, 1) * COURT_PAN;
    const frequency = midiToFrequency(note);
    if (isPerfect) {
      const { PERFECT } = HIT;
      const tones: Tone[] = [
        { frequency, wave: 'sine', volume: PERFECT.VOLUME, length: PERFECT.LENGTH, pan: at },
        {
          frequency: frequency * 2,
          wave: 'sine',
          volume: PERFECT.OCTAVE,
          length: PERFECT.OCTAVE_LENGTH,
          pan: at,
        },
        {
          frequency: frequency * 4,
          wave: 'triangle',
          volume: PERFECT.GLINT,
          length: PERFECT.GLINT_LENGTH,
          pan: at,
        },
      ];
      for (const tone of tones) this.hitTone(ac, { ...tone, volume: tone.volume * trim });
      this.punch(ac, note, at, trim);
      this.duckMusic(HIT_DUCK.PERFECT);
      this.mixerGetter()?.carveForHit(1);
      return;
    }

    const voice = paddleIndex === 0 ? HIT.PLAYER : HIT.CPU;
    const strength = HIT.SOFT_VOLUME + (1 - HIT.SOFT_VOLUME) * hard;
    this.hitTone(ac, {
      frequency,
      wave: voice.WAVE,
      volume: voice.VOLUME * strength * trim * this.jitter(HIT.JITTER),
      length: voice.LENGTH,
      pan: at,
      cutoff: HIT.BRIGHT.SOFT + (HIT.BRIGHT.HARD - HIT.BRIGHT.SOFT) * hard,
      from: HIT.SNAP.FROM,
    });
    this.mixerGetter()?.carveForHit(0.5 + 0.5 * hard);
  }

  /** The context and the level the point's sounds play at, or null while they can't be heard. */
  private pointContext(): {
    ac: AudioContext;
    trim: number;
    root: number;
    chord: readonly number[];
  } | null {
    const ac = this.audioContextGetter();
    if (!ac || this.isMutedGetter() || !this.isGameplayAudibleGetter()) return null;
    const { root, chord } = this.harmonyGetter() ?? { root: 33, chord: [0, 3, 7] };
    return { ac, trim: dbToGain(heatLevel(this.heatGetter())), root, chord };
  }

  /** A tick of the serve's countdown, the ball still waiting. */
  public playServeTick(): void {
    const at = this.pointContext();
    if (!at) return;
    const { ac, trim, root, chord } = at;
    const { TICK } = POINT;
    if (this.pointSketches.serve === 'a') {
      const frequency = midiToFrequency(root + TICK.OFFSET);
      this.hitTone(ac, {
        frequency,
        wave: 'sine',
        volume: TICK.VOLUME * trim,
        length: TICK.LENGTH,
        pan: 0,
      });
    } else {
      const frequency = midiToFrequency(root + TICK.OFFSET + chord[chord.length - 1]);
      this.hitTone(ac, {
        frequency,
        wave: 'triangle',
        volume: TICK.SNAP_VOLUME * trim,
        length: TICK.SNAP_LENGTH,
        pan: 0,
        from: HIT.SNAP.FROM,
      });
    }
  }

  /** The serve's last beat: the ball leaves. */
  public playServeGo(): void {
    const at = this.pointContext();
    if (!at) return;
    const { ac, trim, root, chord } = at;
    const { GO } = POINT;
    const base = root + GO.OFFSET;
    if (this.pointSketches.serve === 'a') {
      this.hitTone(ac, {
        frequency: midiToFrequency(base),
        wave: 'square',
        volume: GO.VOLUME * trim,
        length: GO.LENGTH,
        pan: 0,
        cutoff: GO.CUTOFF,
        from: HIT.SNAP.FROM,
      });
    } else {
      [base - 12, base - 12 + chord[chord.length - 1]].forEach((note, i) =>
        this.hitTone(ac, {
          frequency: midiToFrequency(note),
          wave: 'square',
          volume: GO.VOLUME * trim,
          length: GO.FLICK_LENGTH,
          pan: 0,
          cutoff: GO.CUTOFF,
          delay: i * GO.STEP,
        }),
      );
    }
  }

  /** A point won, heard from the goal it went in (`pan`). */
  public playPointWon(pan = 0): void {
    const at = this.pointContext();
    if (!at) return;
    const { ac, trim, root, chord } = at;
    const { WON } = POINT;
    const side = clamp(pan, -1, 1) * COURT_PAN;
    const notes = [...chord, 12].map((step) => root + WON.OFFSET + step);
    if (this.pointSketches.won === 'a') {
      notes.forEach((note, i) =>
        this.hitTone(ac, {
          frequency: midiToFrequency(note),
          wave: 'square',
          volume: WON.VOLUME * trim,
          length: WON.LENGTH,
          pan: side,
          cutoff: WON.CUTOFF,
          delay: i * WON.STEP,
        }),
      );
      this.crack(ac, WON.CRACK * trim, WON.CRACK_LENGTH, side);
    } else {
      notes.forEach((note, i) => {
        const isTop = i === notes.length - 1;
        this.hitTone(ac, {
          frequency: midiToFrequency(note),
          wave: 'sine',
          volume: WON.SINE_VOLUME * trim,
          length: isTop ? WON.RING : WON.LENGTH,
          pan: side,
          delay: i * WON.STEP,
        });
        if (isTop) {
          this.hitTone(ac, {
            frequency: midiToFrequency(note + 24),
            wave: 'triangle',
            volume: WON.GLINT * trim,
            length: WON.LENGTH,
            pan: side,
            delay: i * WON.STEP,
          });
        }
      });
    }
  }

  /** A point lost, heard from the goal it went in (`pan`): falling, but no buzzer. */
  public playPointLost(pan = 0): void {
    const at = this.pointContext();
    if (!at) return;
    const { ac, trim, root, chord } = at;
    const { LOST } = POINT;
    const side = clamp(pan, -1, 1) * COURT_PAN;
    const base = root + LOST.OFFSET;
    if (this.pointSketches.lost === 'a') {
      [base + chord[chord.length - 1], base].forEach((note, i) =>
        this.hitTone(ac, {
          frequency: midiToFrequency(note),
          wave: 'triangle',
          volume: LOST.VOLUME * trim,
          length: LOST.LENGTH,
          pan: side,
          delay: i * LOST.STEP,
        }),
      );
    } else {
      // The root reached from a semitone above, sagging onto it
      [
        { note: base + chord[1], from: 0, length: LOST.LENGTH },
        { note: base, from: 1, length: LOST.SAG + LOST.LENGTH },
      ].forEach(({ note, from, length }, i) =>
        this.hitTone(ac, {
          frequency: midiToFrequency(note),
          wave: 'square',
          volume: LOST.SQUARE * trim,
          length,
          pan: side,
          cutoff: LOST.CUTOFF,
          from: from || undefined,
          glide: LOST.SAG,
          delay: i * LOST.STEP,
        }),
      );
    }
  }

  /** The deciding point announced as it is served, in place of the countdown's ticks. */
  public playDeciderSting(): void {
    const at = this.pointContext();
    if (!at) return;
    const { ac, trim, root, chord } = at;
    const { DECIDER } = POINT;
    if (this.pointSketches.decider === 'a') {
      const base = root + DECIDER.OFFSET;
      [base, base + chord[chord.length - 1], base + 12].forEach((note) =>
        this.hitTone(ac, {
          frequency: midiToFrequency(note),
          wave: 'square',
          volume: DECIDER.VOLUME * trim,
          length: DECIDER.LENGTH,
          pan: 0,
          cutoff: DECIDER.CUTOFF,
        }),
      );
    } else {
      const frequency = midiToFrequency(root + DECIDER.GONG_OFFSET);
      for (const partial of DECIDER.GONG) {
        this.hitTone(ac, {
          frequency: frequency * partial.ratio,
          wave: 'sine',
          volume: partial.volume * trim,
          length: partial.length,
          pan: 0,
        });
      }
    }
  }

  /** The perfect hit's punch under its tone: the noise channel's crack and an 8-bit kick. */
  private punch(ac: AudioContext, note: number, pan: number, trim: number): void {
    const { PUNCH } = HIT;
    this.hitTone(ac, {
      frequency: midiToFrequency(note - 36),
      wave: 'square',
      volume: PUNCH.KICK * trim,
      length: PUNCH.KICK_LENGTH,
      pan,
      from: 24,
      glide: PUNCH.GLIDE,
    });
    this.crack(ac, PUNCH.NOISE * trim, PUNCH.NOISE_LENGTH, pan);
  }

  /** The console noise channel's crack: struck at `volume`, gone after `length` s. */
  private crack(ac: AudioContext, volume: number, length: number, pan: number): void {
    try {
      const source = ac.createBufferSource();
      source.buffer = this.consoleNoise(ac);
      const start = ac.currentTime;
      const gain = ac.createGain();
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      const panner = ac.createStereoPanner();
      panner.pan.value = pan;
      source.connect(gain).connect(panner).connect(this.output(ac));
      // From a random place in it, so no two cracks are the same
      source.start(start, Math.random() * 0.5);
      source.stop(start + length);
    } catch {
      // Audio playback fails silently if browser policy blocks it
    }
  }

  /** A second of noise held in steps, a console's noise channel, rendered once per context. */
  private consoleNoise(ac: AudioContext): AudioBuffer {
    if (this.noise && this.noiseContext === ac) return this.noise;
    const buffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = buffer.getChannelData(0);
    let value = 0;
    for (let i = 0; i < data.length; i++) {
      if (i % HIT.NOISE_HOLD === 0) value = Math.random() * 2 - 1;
      data[i] = value;
    }
    this.noise = buffer;
    this.noiseContext = ac;
    return buffer;
  }

  /** One tone of a hit: struck at `volume` and dying away over its `length`. */
  private hitTone(ac: AudioContext, tone: Tone): void {
    try {
      const start = ac.currentTime + (tone.delay ?? 0);
      const osc = ac.createOscillator();
      osc.type = tone.wave;
      if (tone.from) {
        osc.frequency.setValueAtTime(tone.frequency * 2 ** (tone.from / 12), start);
        osc.frequency.exponentialRampToValueAtTime(
          tone.frequency,
          start + (tone.glide ?? HIT.SNAP.TIME),
        );
      } else {
        osc.frequency.setValueAtTime(tone.frequency, start);
      }
      const gain = ac.createGain();
      gain.gain.setValueAtTime(tone.volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.length);
      const panner = ac.createStereoPanner();
      panner.pan.value = tone.pan;
      let chainEnd: AudioNode = osc;
      if (tone.cutoff) {
        const lowpass = ac.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = tone.cutoff;
        chainEnd = chainEnd.connect(lowpass);
      }
      chainEnd.connect(gain).connect(panner).connect(this.output(ac));
      osc.start(start);
      osc.stop(start + tone.length);
    } catch {
      // Audio playback fails silently if browser policy blocks it
    }
  }

  /** The Overdrive's tuned bodies at `note`, `gain` shared out among them. */
  private bodies(note: number, gain: number): Layer[] {
    return HIT_BODIES.map((body) => ({
      tuned: body.id,
      note,
      gain: gain * body.gain,
      cut: body.cut,
    }));
  }

  /**
   * Plays rendered layers together, at `levelDb` with the music's heat on top, at `pan`; false if
   * they aren't rendered yet, for the live synth to play instead (true and silent while the game
   * can't be heard).
   */
  private playLayers(layers: Layer[], levelDb: number, pan: number): boolean {
    const samples = this.samplesGetter();
    // The layers are rendered all at once, the bodies last
    if (!samples?.pickNote(HIT_BODIES[0].id, MELODY_LOW)) return false;
    const ac = this.audioContextGetter();
    if (!ac || this.isMutedGetter() || !this.isGameplayAudibleGetter()) return true;

    const trim = dbToGain(levelDb + heatLevel(this.heatGetter()));
    const at = { ac, trim, pan: clamp(pan, -1, 1) * COURT_PAN };
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
        const { PAN, DETUNE, GAIN } = LAYER_MIX.WIDE;
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
        const rate = (layer.rate ?? 1) * this.jitter(LAYER_MIX.JITTER.RATE);
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
      const peak = gain * trim * this.jitter(LAYER_MIX.JITTER.GAIN);
      level.gain.value = peak;
      if (swell !== undefined) {
        level.gain.setValueAtTime(0.0001, start);
        level.gain.exponentialRampToValueAtTime(peak, start + swell);
      }
      if (cut !== undefined) level.gain.setTargetAtTime(0, start + cut, LAYER_MIX.CUT_FADE);
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
    const { POWER } = LAYER_MIX;
    const { SWELL } = POWER;
    const layers: Layer[] = [
      { shot: HIT_CLICK, gain: POWER.CLICK },
      { shot: 'crack', gain: POWER.CRACK },
      ...this.bodies(note, POWER.BODY),
      { shot: 'thump', gain: POWER.THUMP },
      { shot: 'boom', gain: POWER.BOOM },
      { shot: 'spark', gain: POWER.SPARK },
      { tuned: 'pew', note, gain: POWER.PEW, wide: true },
      { tuned: 'pew', note: note + 12, gain: POWER.HIGH_PEW, wide: true },
      { tuned: 'arc', note, gain: POWER.ARC, swell: SWELL.ARC, cut: POWER.ARC_FOR, wide: true },
      { shot: 'blast', gain: POWER.BLAST, swell: SWELL.BLAST },
      { tuned: 'tube', note, gain: POWER.TUBE, swell: SWELL.TUBE, wide: true },
      { tuned: 'tube', note: note + 12, gain: POWER.HIGH_TUBE, swell: SWELL.TUBE, wide: true },
      { shot: 'tail', gain: POWER.TAIL },
    ];
    const level = LAYER_MIX.LEVEL + POWER.LEVEL;
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

  /** The meter's chime on the chord the music is on: locked on, lit. */
  private readyLayers(harmony: Harmony | null): Layer[] {
    const { READY } = LAYER_MIX;
    const tone = (step: number) => getRallyNote(harmony, step) + 12;
    const lit = (step: number) => READY.LIGHT + step * READY.STEP;
    return [
      {
        tuned: 'arc',
        note: tone(1) - 12,
        gain: READY.HUM,
        swell: READY.HUM_SWELL,
        cut: READY.HUM_FOR,
        wide: true,
      },
      { tuned: 'beam', note: tone(1), gain: READY.BEAM, cut: READY.BEEP },
      {
        tuned: 'beam',
        note: tone(3),
        gain: READY.BEAM,
        delay: READY.LOCK_STEP,
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
   * The Overdrive meter just filled, its weapon ready: a laser sight locking on, the chord lit
   * as neon tubes.
   */
  public playOverdriveReady(pan = 0): void {
    const harmony = this.harmonyGetter();
    const { READY } = LAYER_MIX;
    const layers = this.readyLayers(harmony);
    if (this.playLayers(layers, LAYER_MIX.LEVEL + READY.LEVEL, pan)) return;
    this.beep(1046.5, 0.16, 'triangle', 0.05, 1.5);
    this.beep(1568, 0.26, 'sine', 0.035);
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
