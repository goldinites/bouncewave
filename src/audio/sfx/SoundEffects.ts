import { dbToGain } from '@/audio/curves';
import { Mixer } from '@/audio/Mixer';
import { Harmony } from '@/audio/music/HarmonyTimeline';
import { HIT_BODIES, HIT_CLICK } from '@/audio/samples/actions';
import { SampleBank } from '@/audio/samples/SampleBank';
import { getClimbingRallyNote, getRallyNote, getWallNote, MELODY_LOW } from '@/audio/sfx/harmony';
import { LoopTarget, LoopVoice } from '@/audio/sfx/LoopVoice';
import { CHANNEL_SURF } from '@/shared/channelSurf';
import { clamp, midiToFrequency } from '@/shared/math';

const SFX_FREQUENCIES = {
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
// The beat's knock, what a phone's speaker plays of it: the 110 Hz thump under it is below what
// a phone can (the user, 24.10.2026). Hz it starts at, s it takes to fall an octave, its share of
// the beat's volume
const HEARTBEAT_KNOCK = { HZ: 330, LENGTH: 0.06, SHARE: 1 } as const;

// The channel surf's last channel starts this far flat and glides up onto its note
// The channel surf (playChannelSurf): a relay's soft thud, Hz, falling from FROM semitones up;
// static under a low-pass, clearing to CLEAR Hz as the last channel settles; the chime, MIDI over
// the chord's root, AFTER s into the last channel
const CHANNEL_SOUND = {
  RELAY: { HZ: 110, FROM: 12, VOLUME: 0.09, LENGTH: 0.05 },
  STATIC: { VOLUME: 0.035, CUTOFF: 3000, CLEAR: 400 },
  CHIME: { OFFSET: 48, VOLUME: 0.05, FIFTH: 0.6, LENGTH: 0.6, AFTER: 0.12 },
} as const;

// Shared echo used by the victory sting
const ECHO = { TIME: 0.28, FEEDBACK: 0.35, WET: 0.5 } as const;

// How far the music dips under a strong hit (Mixer.duckMusic), so the hit punches through;
// ordinary hits leave it alone, or a long rally would pump the music on every beat
const HIT_DUCK = { PERFECT: 0.6, POWER_SHOT: 1 } as const;

// The layered sounds (audio/samples/actions.ts): the Overdrive, its meter filling and the wall.
// dB they sit at, an ordinary hit's level in a verse, each sound's own on top
const LAYER_MIX = {
  LEVEL: -11,
  // The Overdrive's power shot, this much louder — heard over any peak, +15 dB over a chorus, but
  // not cutting (the user, 24.10.2026): a weapon of neon, electricity and laser, one whole sound that evolves rather than a string of them: everything
  // starts with the hit, and what comes later blooms out of it (`SWELL`, s to rise) as the
  // earlier voices fade — the crack and the hit (a click, the tuned bodies, a thump, a boom,
  // sparks), the laser shot diving onto the note, the electric arc buzzing up, a small explosion
  // (organic, not overdone), the neon tube on the note and an octave above, ringing out last
  POWER: {
    LEVEL: 3,
    CLICK: 0.25,
    CRACK: 0.5,
    BODY: 0.168,
    THUMP: 0.28,
    BOOM: 0.25,
    SPARK: 0.18,
    TAIL: 0.08,
    // The laser shot carries most of what the shot has in 2-6 kHz, where it would cut
    PEW: 0.3,
    HIGH_PEW: 0.15,
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
    // dB the whole perfect hit, its punch with it, sits under its peaks below: heard over any
    // peak, +13 dB over a chorus, but not a blow to the ears (the user, 24.10.2026)
    LEVEL: -4.5,
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

// A paddle's size in its hit (5.7c, Goliath's paddle half as long again): a share of the standard
// height over which the hit is fully heavy; how much longer and darker it then rings; under it a
// triangle an octave down, round rather than buzzing, its share of the hit's volume and its
// lowpass, Hz
const SIZE = { FULL_AT: 0.5, LONGER: 0.6, DARKER: 0.8, SUB: 1.2, SUB_CUTOFF: 1200 } as const;

// 5.7c's sounds (chosen by ear with the user, 24.10.2026), in the hits' beep idiom: peaks and
// lengths in s, notes as offsets over the chord's root (MIDI 28-39). The skills say their branch:
// mastery's clean and alive, the implants' digital. The modifiers sound only where the sound
// tells the player something; the clock ticks its last seconds; the menus answer softly
const MOMENT = {
  // Arc, mastery's: a flute's whistle — a triangle with a breath of noise — rising onto the fifth,
  // further the harder it curves
  ARC: { OFFSET: 48, VOLUME: 0.07, LENGTH: 0.3, RISE: 12, GLIDE: 0.22, BREATH: 0.03, CUTOFF: 3000 },
  // Analyzer, an implant's: a radar ping, then the chord read out in quick square blips
  ANALYZER: {
    OFFSET: 60,
    PING: 0.05,
    PING_LENGTH: 0.18,
    BLIP: 0.035,
    READ_AFTER: 0.05,
    STEP: 0.03,
    LENGTH: 0.025,
  },
  // Reflex, an implant's: time braking like a tape — a click, then two squares a fifth apart
  // sinking an octave under a closed filter
  REFLEX: { OFFSET: 36, VOLUME: 0.07, LENGTH: 0.55, CLICK: 0.08, CUTOFF: 1800 },
  // The wind turning: a gust of noise sweeping down or up as it now blows, Hz
  WIND: { VOLUME: 0.12, LENGTH: 0.6, LOW: 300, HIGH: 2400 },
  // The middle post rising: a square climbing an octave, filtered, under a ratchet of clicks
  POST_RISE: { OFFSET: 24, VOLUME: 0.06, LENGTH: 0.4, CLICKS: 4, CLICK: 0.06, STEP: 0.08 },
  // A post's bounce, a pinball bumper's: a ding, the note and its fifth
  POST: { OFFSET: 48, VOLUME: 0.06, LENGTH: 0.18 },
  // A brick breaking: the noise channel's crack and glassy shards of the chord
  BRICK: { CRACK: 0.1, SHARD: 0.03, SHARDS: 3, SHARD_STEP: 0.025 },
  // A paddle shrinking: a sigh sliding down onto a note a semitone lower for each tenth lost
  SHRINK: { OFFSET: 48, VOLUME: 0.07, SIGH: 5, LENGTH: 0.14 },
  // Ice: on a hit, two glassy tones over it
  ICE: { TINK: 0.025, TINK_LENGTH: 0.08 },
  // A person's paddle on ice moves as a skate does (5.9): a blade's "shhk" as it pushes off, rising
  // through the band, louder the harder; a thin hiss as it glides, as loud as it is fast; a hockey
  // stop's spray as it brakes — falling, brighter and longer, with a crunch of ice under it. Hz
  SKATE: {
    PUSH: 0.13,
    PUSH_LENGTH: 0.14,
    PUSH_FROM: 2200,
    PUSH_TO: 5500,
    GLIDE: 0.035,
    GLIDE_HZ: 4200,
    GLIDE_SPEED_HZ: 2500, // the hiss brightens by this at full speed
    GLIDE_Q: 5,
    STOP: 0.2,
    STOP_LENGTH: 0.32,
    STOP_FROM: 7000,
    STOP_TO: 2600,
    CRUNCH: 0.09,
    CRUNCH_HZ: 900,
  },
  // The ball in the dark (5.9): its air as it flies, a soft rush of noise held while it is live —
  // near silent far away and going away, swelling as it closes on a person's goal; panned across,
  // its band higher the higher it flies and brighter the faster. A guide under the game, not a
  // sound of it: on the goal it sits about 12 dB under a paddle hit (-46 against -35 dBFS RMS,
  // measured in a browser; at 0.16 it was as loud as a hit, and held), mid-court about 9 dB lower. Hz
  BALL_AIR: {
    VOLUME: 0.04,
    FAR: 0.12, // share of the volume far from the goal, or flying away
    LOW: 500,
    HIGH: 2000,
    FAST: 0.7, // the band rises by this share at the top speed
    Q: 1.4,
  },
  // The clock's last seconds: a woodblock's tick and tock, Hz
  CLOCK: { VOLUME: 0.06, LENGTH: 0.03, TICK: 1300, TOCK: 950 },
  // The menus: soft sines on the chord the music is on; one at a time, the next within
  // ONE_AT_A_TIME s kept quiet
  MENU: { OFFSET: 48, VOLUME: 0.056, LENGTH: 0.05, STEP: 0.04, ONE_AT_A_TIME: 0.03 },
} as const;

// The point's sounds (5.7b; chosen by ear with the user, 24.10.2026), in the hits' beep idiom
// and on the chord the music is on. Peaks and lengths in s, notes as offsets over the chord's
// root (MIDI 28-39).
// - The serve counts down quietly, so the player can time it by ear: two triangle ticks snapping
//   onto the fifth, then the root and its fifth flicked up as the ball leaves.
// - The deciding point is announced as it is served, in place of the ticks: a low chord, root,
//   fifth and octave, in squares through a closed filter.
// - A point won rises up the chord in sines, a reward, its top ringing with a glint; a point lost
//   falls from the third to the root in a muffled square, the root sagging onto its note — never
//   a buzzer: losing one of many points must not sting. Both from the goal the ball went in
const POINT = {
  TICK: { OFFSET: 36, VOLUME: 0.05, LENGTH: 0.05 },
  GO: { OFFSET: 36, VOLUME: 0.06, LENGTH: 0.07, STEP: 0.05, CUTOFF: 4000 },
  WON: { OFFSET: 36, VOLUME: 0.12, STEP: 0.05, LENGTH: 0.12, RING: 0.35, GLINT: 0.04 },
  LOST: { OFFSET: 24, VOLUME: 0.07, STEP: 0.1, LENGTH: 0.12, CUTOFF: 1500, SAG: 0.2 },
  DECIDER: { OFFSET: 12, VOLUME: 0.07, LENGTH: 1.2, CUTOFF: 900 },
} as const;

/** One filtered burst of the console noise. */
/** Where the ball is in the dark, as its sound follows it. */
export interface BallInDark {
  /** Across the court, -1 the left edge to 1 the right. */
  x: number;
  /** 0 at the bottom to 1 at the top. */
  height: number;
  /** 0 far from the goal it flies at (or flying at no person's goal) to 1 on it. */
  nearness: number;
  /** 0 to 1 of the level's top speed. */
  speed: number;
}

interface NoiseBurst {
  volume: number;
  length: number;
  pan: number;
  filter: BiquadFilterType;
  /** Hz the filter starts at, and glides to over the burst. */
  from: number;
  to?: number;
  q?: number;
  delay?: number;
  /** Smooth noise, in place of the console's stepped noise channel. */
  smooth?: boolean;
}

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
  bus?: Bus;
}

/** Where a hit lands and how hard: `pan` from -1 (the left edge) to 1, `force` from 0 to 1. */
export interface HitFeel {
  /** The paddle's height as a share of the standard one's: a bigger paddle sounds heavier. */
  size?: number;
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
  private lastMenuSoundAt = -Infinity;
  /** The punch's console noise, rendered once for `noiseContext`. */
  private noise: AudioBuffer | null = null;
  private noiseContext: AudioContext | null = null;
  /** Smooth white noise, looped by the held sounds, rendered once per context. */
  private hiss: AudioBuffer | null = null;
  private hissContext: AudioContext | null = null;
  // The held sounds: the ball's air in the dark, a skate's glide
  private readonly ballAir = new LoopVoice((ac) => this.hissSource(ac), 'bandpass');
  private readonly skateGlide = new LoopVoice((ac) => this.hissSource(ac), 'bandpass');

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
    { pan = 0, force = 0.5, size = 1 }: HitFeel = {},
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
      const level = trim * dbToGain(PERFECT.LEVEL);
      for (const tone of tones) this.hitTone(ac, { ...tone, volume: tone.volume * level });
      this.punch(ac, note, at, level);
      this.duckMusic(HIT_DUCK.PERFECT);
      this.mixerGetter()?.carveForHit(1);
      return;
    }

    const voice = paddleIndex === 0 ? HIT.PLAYER : HIT.CPU;
    const strength = HIT.SOFT_VOLUME + (1 - HIT.SOFT_VOLUME) * hard;
    const volume = voice.VOLUME * strength * trim * this.jitter(HIT.JITTER);
    const cutoff = HIT.BRIGHT.SOFT + (HIT.BRIGHT.HARD - HIT.BRIGHT.SOFT) * hard;
    // A bigger paddle rings longer and darker over a voice an octave down; a smaller one shorter
    const big = clamp((size - 1) / SIZE.FULL_AT, 0, 1);
    this.hitTone(ac, {
      frequency,
      wave: voice.WAVE,
      volume,
      length: voice.LENGTH * (size < 1 ? size : 1 + big * SIZE.LONGER),
      pan: at,
      cutoff: cutoff / (1 + big * SIZE.DARKER),
      from: HIT.SNAP.FROM,
    });
    if (big > 0) {
      this.hitTone(ac, {
        frequency: frequency / 2,
        wave: 'triangle',
        volume: volume * big * SIZE.SUB,
        length: voice.LENGTH * (1 + SIZE.LONGER),
        pan: at,
        cutoff: SIZE.SUB_CUTOFF,
        from: HIT.SNAP.FROM,
      });
    }
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
    this.hitTone(ac, {
      frequency: midiToFrequency(root + TICK.OFFSET + chord[chord.length - 1]),
      wave: 'triangle',
      volume: TICK.VOLUME * trim,
      length: TICK.LENGTH,
      pan: 0,
      from: HIT.SNAP.FROM,
    });
  }

  /** The serve's last beat, as the ball leaves: the root and its fifth flicked up. */
  public playServeGo(): void {
    const at = this.pointContext();
    if (!at) return;
    const { ac, trim, root, chord } = at;
    const { GO } = POINT;
    const base = root + GO.OFFSET;
    [base, base + chord[chord.length - 1]].forEach((note, i) =>
      this.hitTone(ac, {
        frequency: midiToFrequency(note),
        wave: 'square',
        volume: GO.VOLUME * trim,
        length: GO.LENGTH,
        pan: 0,
        cutoff: GO.CUTOFF,
        delay: i * GO.STEP,
      }),
    );
  }

  /** A point won, heard from the goal it went in (`pan`): up the chord, its top ringing. */
  public playPointWon(pan = 0): void {
    const at = this.pointContext();
    if (!at) return;
    const { ac, trim, root, chord } = at;
    const { WON } = POINT;
    const side = clamp(pan, -1, 1) * COURT_PAN;
    const notes = [...chord, 12].map((step) => root + WON.OFFSET + step);
    notes.forEach((note, i) => {
      const isTop = i === notes.length - 1;
      const tone = { pan: side, delay: i * WON.STEP };
      this.hitTone(ac, {
        ...tone,
        frequency: midiToFrequency(note),
        wave: 'sine',
        volume: WON.VOLUME * trim,
        length: isTop ? WON.RING : WON.LENGTH,
      });
      if (isTop) {
        this.hitTone(ac, {
          ...tone,
          frequency: midiToFrequency(note + 24),
          wave: 'triangle',
          volume: WON.GLINT * trim,
          length: WON.LENGTH,
        });
      }
    });
  }

  /** A point lost, heard from the goal it went in (`pan`): falling, but no buzzer. */
  public playPointLost(pan = 0): void {
    const at = this.pointContext();
    if (!at) return;
    const { ac, trim, root, chord } = at;
    const { LOST } = POINT;
    const base = root + LOST.OFFSET;
    // The third, then the root reached from a semitone above, sagging onto it
    [
      { note: base + chord[1], length: LOST.LENGTH },
      { note: base, from: 1, length: LOST.SAG + LOST.LENGTH },
    ].forEach(({ note, from, length }, i) =>
      this.hitTone(ac, {
        frequency: midiToFrequency(note),
        wave: 'square',
        volume: LOST.VOLUME * trim,
        length,
        pan: clamp(pan, -1, 1) * COURT_PAN,
        cutoff: LOST.CUTOFF,
        from,
        glide: LOST.SAG,
        delay: i * LOST.STEP,
      }),
    );
  }

  /** The deciding point announced as it is served, in place of the countdown's ticks. */
  public playDeciderSting(): void {
    const at = this.pointContext();
    if (!at) return;
    const { ac, trim, root, chord } = at;
    const { DECIDER } = POINT;
    const base = root + DECIDER.OFFSET;
    for (const note of [base, base + chord[chord.length - 1], base + 12]) {
      this.hitTone(ac, {
        frequency: midiToFrequency(note),
        wave: 'square',
        volume: DECIDER.VOLUME * trim,
        length: DECIDER.LENGTH,
        pan: 0,
        cutoff: DECIDER.CUTOFF,
      });
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

  /** A burst of the console noise through a filter gliding from `from` to `to`. */
  private noiseBurst(ac: AudioContext, burst: NoiseBurst): void {
    try {
      const source = ac.createBufferSource();
      source.buffer = burst.smooth ? this.hissBuffer(ac) : this.consoleNoise(ac);
      const start = ac.currentTime + (burst.delay ?? 0);
      const filter = ac.createBiquadFilter();
      filter.type = burst.filter;
      filter.Q.value = burst.q ?? 1;
      filter.frequency.setValueAtTime(burst.from, start);
      if (burst.to) filter.frequency.exponentialRampToValueAtTime(burst.to, start + burst.length);
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(burst.volume, start + burst.length * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + burst.length);
      const panner = ac.createStereoPanner();
      panner.pan.value = burst.pan;
      source.connect(filter).connect(gain).connect(panner).connect(this.output(ac));
      source.start(start, Math.random() * 0.5);
      source.stop(start + burst.length);
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
      chainEnd.connect(gain).connect(panner).connect(this.output(ac, tone.bus));
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

  /** A ball sent off curving (Arc, mastery's): a flute's whistle, higher the harder it curves. */
  public playSpin(strength: number): void {
    const at = this.pointContext();
    if (!at) return;
    const { ac, trim, root, chord } = at;
    const { ARC } = MOMENT;
    const frequency = midiToFrequency(root + ARC.OFFSET + chord[chord.length - 1]);
    this.hitTone(ac, {
      frequency,
      wave: 'triangle',
      volume: ARC.VOLUME * trim,
      length: ARC.LENGTH,
      pan: 0,
      cutoff: ARC.CUTOFF,
      from: -ARC.RISE * (0.4 + 0.6 * clamp(strength, 0, 1)),
      glide: ARC.GLIDE,
    });
    this.noiseBurst(ac, {
      volume: ARC.BREATH * trim,
      length: ARC.LENGTH,
      pan: 0,
      filter: 'bandpass',
      from: frequency * 2,
      q: 2,
    });
  }

  /** A shot read ahead (Analyzer, an implant's): a radar ping, the chord read out in blips. */
  public playScan(): void {
    const at = this.pointContext();
    if (!at) return;
    const { ac, trim, root, chord } = at;
    const { ANALYZER } = MOMENT;
    const base = root + ANALYZER.OFFSET;
    this.hitTone(ac, {
      frequency: midiToFrequency(base + 12),
      wave: 'sine',
      volume: ANALYZER.PING * trim,
      length: ANALYZER.PING_LENGTH,
      pan: 0,
    });
    [...chord, 12].forEach((step, i) =>
      this.hitTone(ac, {
        frequency: midiToFrequency(base + step),
        wave: 'square',
        volume: ANALYZER.BLIP * trim,
        length: ANALYZER.LENGTH,
        pan: 0,
        cutoff: 6000,
        delay: ANALYZER.READ_AFTER + i * ANALYZER.STEP,
      }),
    );
  }

  /** The world slows down (Reflex, an implant's): a click, then time sinking like a tape. */
  public playTimeWarp(): void {
    const at = this.pointContext();
    if (!at) return;
    const { ac, trim, root, chord } = at;
    const { REFLEX } = MOMENT;
    this.crack(ac, REFLEX.CLICK * trim, 0.02, 0);
    const base = root + REFLEX.OFFSET - 12;
    for (const note of [base, base + chord[chord.length - 1]]) {
      this.hitTone(ac, {
        frequency: midiToFrequency(note),
        wave: 'square',
        volume: (REFLEX.VOLUME * trim) / 2,
        length: REFLEX.LENGTH,
        pan: 0,
        cutoff: REFLEX.CUTOFF,
        from: 12,
        glide: REFLEX.LENGTH,
      });
    }
  }

  /** The wind has turned around (`direction` +1 blowing down the court): a gust its new way. */
  public playWindTurn(direction: number): void {
    const at = this.pointContext();
    if (!at) return;
    const { ac, trim } = at;
    const { WIND } = MOMENT;
    const [from, to] = direction > 0 ? [WIND.HIGH, WIND.LOW] : [WIND.LOW, WIND.HIGH];
    this.noiseBurst(ac, {
      volume: WIND.VOLUME * trim,
      length: WIND.LENGTH,
      pan: 0,
      filter: 'bandpass',
      from,
      to,
      q: 1.5,
    });
  }

  /** The middle post starts rising (Bumpers): a square climbing under a ratchet. */
  public playPostRise(): void {
    const at = this.pointContext();
    if (!at) return;
    const { ac, trim, root } = at;
    const { POST_RISE } = MOMENT;
    const frequency = midiToFrequency(root + POST_RISE.OFFSET + 12);
    this.hitTone(ac, {
      frequency,
      wave: 'square',
      volume: POST_RISE.VOLUME * trim,
      length: POST_RISE.LENGTH,
      pan: 0,
      cutoff: 1500,
      from: -12,
      glide: POST_RISE.LENGTH,
    });
    // The ratchet climbs with it, a minor third a click
    for (let i = 0; i < POST_RISE.CLICKS; i++) {
      this.hitTone(ac, {
        frequency: frequency * 2 ** ((i * 3 - 9) / 12),
        wave: 'triangle',
        volume: POST_RISE.CLICK * trim,
        length: 0.03,
        pan: 0,
        delay: i * POST_RISE.STEP,
      });
    }
  }

  /** The ball off a post (Bumpers), a pinball bumper's ding, where it bounced (`pan`). */
  public playPostBounce(pan = 0): void {
    const at = this.pointContext();
    if (!at) return;
    const { ac, trim, root, chord } = at;
    const { POST } = MOMENT;
    for (const step of [0, chord[chord.length - 1]]) {
      this.hitTone(ac, {
        frequency: midiToFrequency(root + POST.OFFSET + step),
        wave: 'sine',
        volume: POST.VOLUME * trim,
        length: POST.LENGTH,
        pan: clamp(pan, -1, 1) * COURT_PAN,
      });
    }
  }

  /** A brick broken (Bricks), where it broke (`pan`): a crack and glassy shards. */
  public playBrickBreak(pan = 0): void {
    const at = this.pointContext();
    if (!at) return;
    const { ac, trim, root, chord } = at;
    const { BRICK } = MOMENT;
    const side = clamp(pan, -1, 1) * COURT_PAN;
    this.crack(ac, BRICK.CRACK * trim, 0.04, side);
    for (let i = 0; i < BRICK.SHARDS; i++) {
      const note = root + 72 + chord[Math.floor(Math.random() * chord.length)];
      this.hitTone(ac, {
        frequency: midiToFrequency(note),
        wave: 'triangle',
        volume: BRICK.SHARD * trim,
        length: 0.06,
        pan: side,
        delay: 0.015 + i * BRICK.SHARD_STEP,
      });
    }
  }

  /** A paddle shrank (Shrinking paddle) to `share` of its height: a sigh, lower the smaller. */
  public playShrink(share: number, pan = 0): void {
    const at = this.pointContext();
    if (!at) return;
    const { ac, trim, root } = at;
    const { SHRINK } = MOMENT;
    // Down a semitone for each tenth it has lost
    const note = root + SHRINK.OFFSET - Math.round((1 - share) * 10);
    this.hitTone(ac, {
      frequency: midiToFrequency(note),
      wave: 'triangle',
      volume: SHRINK.VOLUME * trim,
      length: SHRINK.LENGTH,
      pan: clamp(pan, -1, 1) * COURT_PAN,
      from: SHRINK.SIGH,
      glide: SHRINK.LENGTH,
    });
  }

  /** A skate pushing off on ice, `strength` 0-1 (how hard the paddle sped up). */
  public playSkatePush(strength: number, pan = 0): void {
    const at = this.pointContext();
    if (!at) return;
    const { SKATE } = MOMENT;
    this.noiseBurst(at.ac, {
      volume: SKATE.PUSH * (0.4 + 0.6 * clamp(strength, 0, 1)) * at.trim,
      length: SKATE.PUSH_LENGTH,
      pan: clamp(pan, -1, 1) * COURT_PAN,
      filter: 'bandpass',
      from: SKATE.PUSH_FROM,
      to: SKATE.PUSH_TO,
      q: 4,
      smooth: true,
    });
  }

  /** A skate's hockey stop on ice, `strength` 0-1 (how fast the paddle was going). */
  public playSkateStop(strength: number, pan = 0): void {
    const at = this.pointContext();
    if (!at) return;
    const { SKATE } = MOMENT;
    const level = (0.4 + 0.6 * clamp(strength, 0, 1)) * at.trim;
    const where = clamp(pan, -1, 1) * COURT_PAN;
    this.noiseBurst(at.ac, {
      volume: SKATE.STOP * level,
      length: SKATE.STOP_LENGTH,
      pan: where,
      filter: 'bandpass',
      from: SKATE.STOP_FROM,
      to: SKATE.STOP_TO,
      q: 2,
      smooth: true,
    });
    // The ice crunching under the blade, in the console's stepped noise
    this.noiseBurst(at.ac, {
      volume: SKATE.CRUNCH * level,
      length: SKATE.STOP_LENGTH * 0.6,
      pan: where,
      filter: 'bandpass',
      from: SKATE.CRUNCH_HZ,
      q: 3,
    });
  }

  /** A skate's glide while the paddle slides, `speed` 0-1 of its top; null when it stands. */
  public setSkateGlide(speed: number | null, pan = 0): void {
    const { SKATE } = MOMENT;
    this.hold(this.skateGlide, (trim) =>
      speed === null || speed <= 0
        ? null
        : {
            volume: SKATE.GLIDE * clamp(speed, 0, 1) * trim,
            frequency: SKATE.GLIDE_HZ + SKATE.GLIDE_SPEED_HZ * clamp(speed, 0, 1),
            q: SKATE.GLIDE_Q,
            pan: clamp(pan, -1, 1) * COURT_PAN,
          },
    );
  }

  /** The ball's air in the dark while it flies (BALL_AIR); null when there is none to hear. */
  public setBallAir(air: BallInDark | null): void {
    const { BALL_AIR } = MOMENT;
    this.hold(this.ballAir, (trim) => {
      if (!air) return null;
      const near = clamp(air.nearness, 0, 1);
      const band = BALL_AIR.LOW + (BALL_AIR.HIGH - BALL_AIR.LOW) * clamp(air.height, 0, 1);
      return {
        volume: BALL_AIR.VOLUME * (BALL_AIR.FAR + (1 - BALL_AIR.FAR) * near * near) * trim,
        frequency: band * (1 + BALL_AIR.FAST * clamp(air.speed, 0, 1)),
        q: BALL_AIR.Q,
        pan: clamp(air.x, -1, 1) * COURT_PAN,
      };
    });
  }

  /**
   * Steers a held sound to what `target` makes of the heat's trim, or to silence wherever action
   * sounds are not heard (muted, behind the menus, paused).
   */
  private hold(voice: LoopVoice, target: (trim: number) => LoopTarget | null): void {
    const ac = this.audioContextGetter();
    if (!ac) return;
    const at = this.pointContext();
    voice.update(ac, this.output(ac), at ? target(at.trim) : null);
  }

  /** A source of smooth white noise, looping. */
  private hissSource(ac: AudioContext): AudioBufferSourceNode {
    const source = ac.createBufferSource();
    source.buffer = this.hissBuffer(ac);
    source.loop = true;
    return source;
  }

  /** Two seconds of smooth white noise, rendered once per context. */
  private hissBuffer(ac: AudioContext): AudioBuffer {
    if (this.hiss && this.hissContext === ac) return this.hiss;
    const buffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.hiss = buffer;
    this.hissContext = ac;
    return buffer;
  }

  /** A hit on ice: two glassy tones over it. */
  public playIceTink(pan = 0): void {
    const at = this.pointContext();
    if (!at) return;
    const { ac, trim, root, chord } = at;
    const { ICE } = MOMENT;
    for (const note of [root + 79, root + 79 + chord[1]]) {
      this.hitTone(ac, {
        frequency: midiToFrequency(note),
        wave: 'triangle',
        volume: ICE.TINK * trim,
        length: ICE.TINK_LENGTH,
        pan: clamp(pan, -1, 1) * COURT_PAN,
      });
    }
  }

  /** A tick of the clock's last seconds, a woodblock's; every other one a tock. */
  public playClockTick(isTock = false): void {
    const at = this.pointContext();
    if (!at) return;
    const { ac, trim } = at;
    const { CLOCK } = MOMENT;
    this.hitTone(ac, {
      frequency: isTock ? CLOCK.TOCK : CLOCK.TICK,
      wave: 'triangle',
      volume: CLOCK.VOLUME * trim,
      length: CLOCK.LENGTH,
      pan: 0,
      from: 5,
      glide: 0.01,
    });
  }

  /**
   * A menu sound: soft, on the menu's bus, heard behind the menus. One at a time: a press that
   * already answered (back, a setting switched) keeps the plain press's sound from following it.
   */
  private menuTone(notes: readonly number[]): void {
    const ac = this.audioContextGetter();
    if (!ac || this.isMutedGetter()) return;
    if (ac.currentTime - this.lastMenuSoundAt < MOMENT.MENU.ONE_AT_A_TIME) return;
    this.lastMenuSoundAt = ac.currentTime;
    const { root } = this.harmonyGetter() ?? { root: 33 };
    const { MENU } = MOMENT;
    notes.forEach((step, i) =>
      this.hitTone(ac, {
        frequency: midiToFrequency(root + MENU.OFFSET + step),
        wave: 'sine',
        volume: MENU.VOLUME,
        length: MENU.LENGTH,
        pan: 0,
        delay: i * MENU.STEP,
        bus: 'menu',
      }),
    );
  }

  /** The focus moves in a menu (keys or a pad). */
  public playMenuMove(): void {
    this.menuTone([12]);
  }

  /** A menu choice made: up the chord. */
  public playMenuSelect(): void {
    this.menuTone([0, 7, 12]);
  }

  /** Back out of a menu: down an octave. */
  public playMenuBack(): void {
    this.menuTone([12, 0]);
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
        const { HZ, LENGTH, SHARE } = HEARTBEAT_KNOCK;
        this.tone(ac, HZ, start, LENGTH, 'triangle', volume * SHARE, 0.003, null, 0.5);
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
   * The channel surf at the start of a match, an old set's (5.9): every channel flicked past
   * thuds its relay under a breath of soft static, with no notes to clash with the song coming
   * in (the climbing square blips grated); as the last one comes on the static clears and a soft
   * chime, the chord's root and fifth, says the picture is in (CHANNEL_SOUND).
   */
  /**
   * One channel tuned to straight off, as the quick match's setup flicks between backdrops: the
   * relay's thud and a breath of static clearing, no chime — the menu's own tick says the choice.
   */
  public playChannelTune(): void {
    const ac = this.getUnmutedContext();
    if (!ac) return;
    const { RELAY, STATIC } = CHANNEL_SOUND;
    this.hitTone(ac, {
      frequency: RELAY.HZ,
      wave: 'sine',
      volume: RELAY.VOLUME,
      length: RELAY.LENGTH,
      pan: 0,
      from: RELAY.FROM,
      glide: RELAY.LENGTH * 0.5,
    });
    this.noiseBurst(ac, {
      volume: STATIC.VOLUME,
      length: CHANNEL_SURF.TUNE,
      pan: 0,
      filter: 'lowpass',
      from: STATIC.CUTOFF,
      to: STATIC.CLEAR,
      smooth: true,
    });
  }

  public playChannelSurf(): void {
    const ac = this.getUnmutedContext();
    if (!ac) return;
    const { root, chord } = this.harmonyGetter() ?? { root: 33, chord: [0, 3, 7] };
    const { RELAY, STATIC, CHIME } = CHANNEL_SOUND;

    for (let i = 0; i < CHANNEL_SURF.CHANNELS; i++) {
      const delay = i * CHANNEL_SURF.STEP;
      this.hitTone(ac, {
        frequency: RELAY.HZ,
        wave: 'sine',
        volume: RELAY.VOLUME,
        length: RELAY.LENGTH,
        pan: 0,
        from: RELAY.FROM,
        glide: RELAY.LENGTH * 0.5,
        delay,
      });
      const isLast = i === CHANNEL_SURF.CHANNELS - 1;
      this.noiseBurst(ac, {
        volume: STATIC.VOLUME,
        length: isLast ? CHANNEL_SURF.SETTLE : CHANNEL_SURF.STEP * 0.9,
        pan: 0,
        filter: 'lowpass',
        from: STATIC.CUTOFF,
        to: isLast ? STATIC.CLEAR : undefined,
        smooth: true,
        delay,
      });
    }

    const tuned = (CHANNEL_SURF.CHANNELS - 1) * CHANNEL_SURF.STEP + CHIME.AFTER;
    const fifth = chord.find((interval) => interval === 7) ?? chord[chord.length - 1];
    for (const [interval, share] of [
      [0, 1],
      [fifth, CHIME.FIFTH],
    ] as const) {
      this.hitTone(ac, {
        frequency: midiToFrequency(root + CHIME.OFFSET + interval),
        wave: 'sine',
        volume: CHIME.VOLUME * share,
        length: CHIME.LENGTH,
        pan: 0,
        delay: tuned,
      });
    }
  }
}
