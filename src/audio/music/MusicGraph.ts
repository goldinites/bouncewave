import { createReverbImpulse, createSoftClipper, dbToGain } from '@/audio/curves';
import { RoomName, ROOMS } from '@/audio/music/rooms';
import { clamp } from '@/shared/math';

// Overall music volume when not muted: the rendered instruments are fuller than the live
// synths were, so it sits lower to leave the action sounds on top (docs/AUDIO.md, "Микс")
const MUSIC_MASTER_LEVEL = 0.21;
// Time constants of a part's level change (setPartLevel, setPartMix): up on the downbeat, down gently
const PART_RISE = 0.01; // s
const PART_FALL = 0.25; // s
// On the deciding point the pads and the melody fade out with the tension, gone at this level
// (MatchPointDrama's is 0.6 for the whole rally), leaving the kick and the bass under the
// heartbeat; the pause, not the deciding point, is the music muffled behind a wall
const DRAMA_THIN_AT = 0.5;
const DRAMA_THIN_TIME = 0.08; // s, time constant of the fade

const ECHO_FEEDBACK = 0.4;
// The echo bounces left and right, each repeat a little darker
const ECHO_PAN = 0.6;
const ECHO_DAMPING = 3500; // Hz, low-pass inside the feedback loop
// Saturation on the stems: below the knee a part passes clean, above it it bends and grows
// harmonics, which is also what lets a bass be heard on a phone speaker
const SATURATION = {
  BASS_KNEE: 0.22,
  BASS_MAKEUP: 1.25, // what the bend takes off the bass's peaks, given back
  GRIT_TRIM: 0.5, // share of a song's bass drive taken back after the bend
  DRUMS_KNEE: 0.55,
} as const;
// Every kick pushes the bass and pads down for a moment and lets them swell back: the
// "breathing" of the genre, done by automation on the kick's own time, not by a detector
const SIDECHAIN = {
  BASS_DEPTH: 0.55, // share the bass drops by under a full kick
  PADS_DEPTH: 0.45,
  ATTACK: 0.004, // s, time constant down
  HOLD: 0.03, // s at the bottom
  RELEASE: 0.08, // s, time constant back up
  FULL_KICK: 0.75, // kick volume that ducks by the full depth
} as const;
// The picture beats with the kicks (6.5): the last KICKS_KEPT scheduled kicks are kept, and a beat
// fades over BEAT_DECAY s after its kick sounds
const KICKS_KEPT = 16;
const BEAT_DECAY = 0.14; // s
// Each song's own room (audio/music/rooms.ts): a new one fades in as the last one fades out
const ROOM_FADE = 0.4; // s, time constant of the crossfade between rooms
const ROOM_FADE_OUT = 5; // time constants after which a room fading out is silent
// Pad voices spread across the stereo field
export const PAD_SPREAD = 0.5;
// Echo time follows the tempo, which drifts a little every step; smaller changes are skipped
const ECHO_TIME_TOLERANCE = 0.002; // s
const ANALYSER_FFT_SIZE = 256;
const ANALYSER_SMOOTHING = 0.75;
// Faults of a song that breaks down (GLITCH_PATTERNS)
const GLITCH = {
  CUT_EDGE: 0.004, // s a break takes to stop dead and come back
  // A drop-out sinks the signal rather than cutting it: the music falls away to a faint, muffled
  // trace, as a radio losing its station does, never to dead silence with a click at each edge
  EDGE: 0.02, // s the signal takes to sink and come back: quick, but too slow to click
  DIP: 0.15, // share of the level left while the signal is down
  DIP_TONE: 500, // Hz the filter closes to while the signal is down
  OPEN_TONE: 20000, // Hz, the filter wide open: the music as written
  // The rewind sags the pitch, then catches up and lands at pitch, smoothly at both ends: a
  // bend of about 15% down and 25% up over a half-bar, never the shriek of the delay collapsing
  REWIND_DEPTH: 0.07, // s the rewind's delay swells to
  REWIND_SAG: 0.6, // share of the rewind spent sagging; the rest catches up
  // s the held tape's delay swells to: over a 0.6 s hold the pitch sags by up to ~15%, then
  // runs as far sharp as the tape catches up
  HOLD_DEPTH: 0.03,
} as const;

/**
 * The music's audio graph and the effects applied to the whole mix.
 *
 * ```
 * drums → saturation ───────────────────────┐
 * bass → saturation → pump ─────────────────┤
 * pads → thin → pump ───────────────────────┤
 * melody → thin ─┬──────────────────────────┤
 *                └─ echo L ⇄ echo R (ping-pong) ┤
 * drums, pads, melody ─ sends → the song's room ┤
 *                                           bus → songLevel → toneFilter → compressor
 *   → partLevel → glitchDelay → tapeDelay → glitchFilter → glitchGain → fadeGain ─┬─ master
 *                                                                                  └─ analyser
 * ```
 * - each stem is a part of the arrangement: its own saturation, sidechain and sends
 * - the pumps duck the bass and pads under every kick (`pump`), as deep as the song asks
 * - each song plays in its own room (`setSongSpace`), built ahead of it (`prepareRoom`)
 * - songLevel evens out the songs' loudness (`setSongLevel`)
 * - partLevel sets a part above or below the song's grooves (`setPartLevel`): after the
 *   compressor, which would flatten whatever the arrangement adds, so a peak really is louder
 * - the bass is driven into its saturation as hard as the song asks (`setBassGrit`)
 * - pads, melody and bass are raised or lowered against the drums as a part asks
 *   (`setPartMix`), before the compressor, so a fuller part pushes the beat back
 * - toneFilter follows the game state (muffled in menus and pause), set per step
 * - the thin gains fade the pads and the melody out on the deciding point (`setDramaLevel`)
 * - tapeDelay sits at 0 ms until a tape stop sweeps it to bend the pitch down
 * - glitchDelay, glitchFilter and glitchGain are the rewinds and drop-outs of a song that breaks
 *   down; their own nodes, so they never overlap the tape stop's automation
 * - fadeGain fades the music out under a tape stop, independent of the mute gain
 *
 * Parameters are only automated when their value changes: every automation call adds an event
 * to the parameter's timeline, and the scheduler would otherwise add dozens per second for as
 * long as the game runs.
 */
/** A built room: what feeds it, to free it, and its return, to fade it. */
interface RoomNodes {
  sends: { source: AudioNode; amount: GainNode }[];
  ret: GainNode;
  /** Audio-clock time the room has faded out and its tail died by; freeing it earlier cuts it. */
  silentAt: number;
}

export class MusicGraph {
  /** The kicks scheduled lately, in time order, with how hard each was played, in [0, 1]. */
  private readonly kicks: { time: number; strength: number }[] = [];
  public readonly context: AudioContext;
  /** Effects outside the stems (risers): straight into the mix. */
  public readonly bus: GainNode;
  public readonly drums: GainNode;
  public readonly bass: GainNode;
  /** Pads and stabs. */
  public readonly pads: GainNode;
  /** Leads and arpeggios, which also feed the echo. */
  public readonly melody: GainNode;
  public readonly noiseBuffer: AudioBuffer;
  public readonly analyser: AnalyserNode;

  private readonly echoes: DelayNode[];
  private readonly bassPump: GainNode;
  /** Drives the bass into its saturation as hard as the song asks, and trims it back after. */
  private readonly bassGrit: GainNode;
  private readonly bassGritTrim: GainNode;
  private gritDb: number | null = null;
  private readonly padsPump: GainNode;
  /** The pads and the melody, thinned out on the deciding point; the melody's echo and room too. */
  private readonly padsThin: GainNode;
  private readonly melodyThin: GainNode;
  private readonly songLevel: GainNode;
  private songLevelDb: number | null = null;
  private readonly partLevel: GainNode;
  private partLevelDb: number | null = null;
  private partMix = { pads: 0, melody: 0, bass: 0 };
  /** Share of the full sidechain the song playing asks for. */
  private pumpDepth = 1;
  /** The rooms built: the song playing's, and the next one's or the last one's fading out. */
  private readonly rooms = new Map<RoomName, RoomNodes>();
  private room: RoomName | null = null;
  /** Rooms waiting to be built off the scheduler's tick, by the timer that will build them. */
  private readonly roomTimers = new Map<RoomName, ReturnType<typeof setTimeout>>();
  private readonly toneFilter: BiquadFilterNode;
  private readonly tapeDelay: DelayNode;
  private readonly glitchDelay: DelayNode;
  private readonly glitchFilter: BiquadFilterNode;
  private readonly glitchGain: GainNode;
  private readonly fadeGain: GainNode;
  private readonly master: GainNode;
  private dramaLevel = 0;
  // Last values handed to the audio graph; null until first set
  private isMuted: boolean | null = null;
  private toneFrequency: number | null = null;
  private echoTime: number | null = null;
  /** Audio-clock time the running tape stop's curves end; nothing may overlap them until then. */
  private tapeStopEndsAt = 0;

  /** @param output where the music goes: the mixer's music bus */
  constructor(context: AudioContext, output: AudioNode = context.destination) {
    this.context = context;
    const ac = context;

    // One second of white noise for percussion (snare, hi-hat, crash)
    this.noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const channelData = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = Math.random() * 2 - 1;
    }

    this.bus = ac.createGain();
    this.drums = ac.createGain();
    this.bass = ac.createGain();
    this.pads = ac.createGain();
    this.melody = ac.createGain();
    this.bassPump = ac.createGain();
    this.padsPump = ac.createGain();
    this.songLevel = ac.createGain();
    this.partLevel = ac.createGain();
    this.toneFilter = ac.createBiquadFilter();
    this.padsThin = ac.createGain();
    this.melodyThin = ac.createGain();
    this.tapeDelay = ac.createDelay(1);
    this.glitchDelay = ac.createDelay(1);
    this.glitchFilter = ac.createBiquadFilter();
    this.glitchGain = ac.createGain();
    this.fadeGain = ac.createGain();
    this.master = ac.createGain();
    this.analyser = ac.createAnalyser();

    const compressor = ac.createDynamicsCompressor();

    this.toneFilter.frequency.value = 2800;
    this.tapeDelay.delayTime.value = 0;
    this.glitchDelay.delayTime.value = 0;
    this.glitchFilter.frequency.value = GLITCH.OPEN_TONE;
    // No resonance: the closing filter muffles, it doesn't whistle
    this.glitchFilter.Q.value = Math.SQRT1_2;
    this.master.gain.value = 0;
    this.analyser.fftSize = ANALYSER_FFT_SIZE;
    this.analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;

    const drumsSaturation = createSoftClipper(ac, SATURATION.DRUMS_KNEE);
    this.drums.connect(drumsSaturation.input);
    drumsSaturation.output.connect(this.bus);

    const bassSaturation = createSoftClipper(ac, SATURATION.BASS_KNEE);
    const bassMakeup = ac.createGain();
    bassMakeup.gain.value = SATURATION.BASS_MAKEUP;
    this.bassGrit = ac.createGain();
    this.bassGritTrim = ac.createGain();
    this.bass.connect(this.bassGrit);
    this.bassGrit.connect(bassSaturation.input);
    bassSaturation.output.connect(this.bassGritTrim);
    this.bassGritTrim.connect(bassMakeup);
    bassMakeup.connect(this.bassPump);
    this.bassPump.connect(this.bus);

    this.pads.connect(this.padsThin);
    this.padsThin.connect(this.padsPump);
    this.padsPump.connect(this.bus);
    this.melody.connect(this.melodyThin);
    this.melodyThin.connect(this.bus);
    this.echoes = this.buildEcho(ac);

    this.bus.connect(this.songLevel);
    this.songLevel.connect(this.toneFilter);
    this.toneFilter.connect(compressor);
    compressor.connect(this.partLevel);
    this.partLevel.connect(this.glitchDelay);
    this.glitchDelay.connect(this.tapeDelay);
    this.tapeDelay.connect(this.glitchFilter);
    this.glitchFilter.connect(this.glitchGain);
    this.glitchGain.connect(this.fadeGain);
    this.fadeGain.connect(this.master);
    this.fadeGain.connect(this.analyser);
    this.master.connect(output);
  }

  /** Ping-pong echo on the melody: repeats alternate left and right, darker each time. */
  private buildEcho(ac: AudioContext): DelayNode[] {
    const echoes = [-ECHO_PAN, ECHO_PAN].map((pan) => {
      const delay = ac.createDelay(1);
      const panner = ac.createStereoPanner();
      panner.pan.value = pan;
      delay.connect(panner);
      panner.connect(this.bus);
      return delay;
    });
    const [left, right] = echoes;
    const feedback = (from: DelayNode, to: DelayNode) => {
      const damping = ac.createBiquadFilter();
      const gain = ac.createGain();
      damping.frequency.value = ECHO_DAMPING;
      gain.gain.value = ECHO_FEEDBACK;
      from.connect(damping);
      damping.connect(gain);
      gain.connect(to);
    };
    this.melodyThin.connect(left);
    feedback(left, right);
    feedback(right, left);
    return echoes;
  }

  /**
   * A room's nodes: each stem's share sent in, the low end kept out, the impulse, the highs a
   * dark room swallows, and its return, silent until the room is chosen.
   */
  private buildRoom(name: RoomName): RoomNodes {
    const ac = this.context;
    const room = ROOMS[name];
    const lowCut = ac.createBiquadFilter();
    const convolver = ac.createConvolver();
    const highCut = ac.createBiquadFilter();
    const ret = ac.createGain();
    lowCut.type = 'highpass';
    lowCut.frequency.value = room.lowCut;
    highCut.frequency.value = room.highCut;
    convolver.buffer = createReverbImpulse(ac, room.decay, room.preDelay);
    ret.gain.value = 0;

    const sources: [AudioNode, number][] = [
      [this.padsPump, room.sends.pads],
      [this.melodyThin, room.sends.melody],
      [this.drums, room.sends.drums],
    ];
    const sends = sources.map(([source, level]) => {
      const amount = ac.createGain();
      amount.gain.value = level;
      source.connect(amount);
      amount.connect(lowCut);
      return { source, amount };
    });
    lowCut.connect(convolver);
    convolver.connect(highCut);
    highCut.connect(ret);
    ret.connect(this.bus);
    return { sends, ret, silentAt: 0 };
  }

  /**
   * Builds a song's room ahead of it, off the scheduler's tick: its impulse takes a few
   * milliseconds to generate, which the tick can't spare. Rooms neither playing nor asked for are
   * freed once their tails have died, so two impulses are held, three while a crossfade lasts.
   */
  public prepareRoom(name: RoomName): void {
    for (const [built, nodes] of this.rooms) {
      const isUnused = built !== name && built !== this.room;
      if (isUnused && this.now >= nodes.silentAt) this.releaseRoom(built, nodes);
    }
    if (this.rooms.has(name) || this.roomTimers.has(name)) return;
    const timer = setTimeout(() => {
      this.roomTimers.delete(name);
      if (!this.rooms.has(name)) this.rooms.set(name, this.buildRoom(name));
    }, 0);
    this.roomTimers.set(name, timer);
  }

  private releaseRoom(name: RoomName, { sends, ret }: RoomNodes): void {
    try {
      for (const { source, amount } of sends) source.disconnect(amount);
      ret.disconnect();
    } catch {
      // Already gone: nothing to free
    }
    this.rooms.delete(name);
  }

  /**
   * The song playing's space from `time`: its room fades in as the last one fades out, and the
   * sidechain takes its depth. Only acts when either changes.
   */
  public setSongSpace(room: RoomName, pumpDepth: number, time: number): void {
    this.pumpDepth = pumpDepth;
    if (room === this.room) return;
    const previous = this.room === null ? undefined : this.rooms.get(this.room);
    if (previous && this.room) {
      previous.ret.gain.setTargetAtTime(0, time, ROOM_FADE);
      previous.silentAt = time + ROOM_FADE * ROOM_FADE_OUT + ROOMS[this.room].decay;
    }
    // A room not built ahead (the first song, or one picked on the stand) is built now
    let next = this.rooms.get(room);
    if (!next) {
      clearTimeout(this.roomTimers.get(room));
      this.roomTimers.delete(room);
      next = this.buildRoom(room);
      this.rooms.set(room, next);
    }
    next.ret.gain.setTargetAtTime(ROOMS[room].return, time, ROOM_FADE);
    this.room = room;
  }

  /** Stops building rooms ahead. */
  public dispose(): void {
    for (const timer of this.roomTimers.values()) clearTimeout(timer);
    this.roomTimers.clear();
  }

  /**
   * A kick at `time`: the bass and pads dip under it and swell back, deeper the harder the kick
   * and the more the song pumps.
   * Kicks come in time order, so each one's automation lands after the last one's.
   */
  public pump(time: number, kickVolume: number): void {
    // Kept for the picture, which beats with the kicks as they sound (`beatAt`)
    this.kicks.push({ time, strength: clamp(kickVolume / SIDECHAIN.FULL_KICK, 0, 1) });
    if (this.kicks.length > KICKS_KEPT) this.kicks.shift();
    const strength = clamp(kickVolume / SIDECHAIN.FULL_KICK, 0, 1) * this.pumpDepth;
    if (strength === 0) return;
    const duck = (gain: AudioParam, depth: number) => {
      gain.setTargetAtTime(1 - depth * strength, time, SIDECHAIN.ATTACK);
      gain.setTargetAtTime(1, time + SIDECHAIN.HOLD, SIDECHAIN.RELEASE);
    };
    try {
      duck(this.bassPump.gain, SIDECHAIN.BASS_DEPTH);
      duck(this.padsPump.gain, SIDECHAIN.PADS_DEPTH);
    } catch {
      // Play on without the breathing rather than break audio
    }
  }

  /**
   * How hard the beat is landing at audio time `now`, in [0, 1]: the last kick to have sounded, as
   * hard as it was played, fading over BEAT_DECAY s. Kicks are scheduled ahead, so only those
   * already sounding count.
   */
  public beatAt(now: number): number {
    for (let i = this.kicks.length - 1; i >= 0; i--) {
      const kick = this.kicks[i];
      if (kick.time <= now) return kick.strength * Math.exp(-(now - kick.time) / BEAT_DECAY);
    }
    return 0;
  }

  /**
   * dB the song drives its bass by into the saturation, from `time`: the harder, the more it
   * tears, as an industrial bass does. Half of it is trimmed back after, since the bend already
   * holds the peaks down. Only acts when it changes.
   */
  public setBassGrit(db: number, time: number): void {
    if (db === this.gritDb) return;
    this.gritDb = db;
    this.bassGrit.gain.setTargetAtTime(dbToGain(db), time, 0.05);
    this.bassGritTrim.gain.setTargetAtTime(dbToGain(-db * SATURATION.GRIT_TRIM), time, 0.05);
  }

  /** The song's own level in dB, from `time`: songs are evened out so none jumps out. */
  public setSongLevel(db: number, time: number): void {
    if (db === this.songLevelDb) return;
    this.songLevelDb = db;
    this.songLevel.gain.setTargetAtTime(dbToGain(db), time, 0.05);
  }

  /**
   * The part playing's level in dB against the song's grooves, from `time`: a peak lifts at
   * once, on its downbeat; a calm part settles down over a beat or so.
   */
  public setPartLevel(db: number, time: number): void {
    if (db === this.partLevelDb) return;
    const isRising = this.partLevelDb === null || db > this.partLevelDb;
    this.partLevelDb = db;
    this.partLevel.gain.setTargetAtTime(dbToGain(db), time, isRising ? PART_RISE : PART_FALL);
  }

  /**
   * The pads' and the melody's levels in dB against the drums and bass, from `time`, as the
   * part playing asks; following the part level's rise and fall. Only acts when they change.
   */
  public setPartMix(mix: { pads?: number; melody?: number; bass?: number }, time: number): void {
    for (const bus of ['pads', 'melody', 'bass'] as const) {
      const db = mix[bus] ?? 0;
      if (db === this.partMix[bus]) continue;
      const isRising = db > this.partMix[bus];
      this.partMix[bus] = db;
      this[bus].gain.setTargetAtTime(dbToGain(db), time, isRising ? PART_RISE : PART_FALL);
    }
  }

  private get now(): number {
    return this.context.currentTime;
  }

  public setMuted(isMuted: boolean): void {
    if (isMuted === this.isMuted) return;
    this.isMuted = isMuted;
    this.master.gain.setTargetAtTime(isMuted ? 0 : MUSIC_MASTER_LEVEL, this.now, 0.05);
  }

  /** Overall brightness of the mix, scheduled to change at `time`. */
  public setToneFilter(frequency: number, time: number): void {
    if (frequency === this.toneFrequency) return;
    this.toneFrequency = frequency;
    this.toneFilter.frequency.setTargetAtTime(frequency, time, 0.2);
  }

  /** Echo time for leads, kept in sync with the tempo. */
  public setEchoTime(seconds: number, time: number): void {
    if (this.echoTime !== null && Math.abs(seconds - this.echoTime) < ECHO_TIME_TOLERANCE) return;
    this.echoTime = seconds;
    this.echoes.forEach((echo) => echo.delayTime.setTargetAtTime(seconds, time, 0.1));
  }

  /**
   * The deciding point's tension, level in [0, 1]: the pads and the melody fade out as it
   * rises, gone from DRAMA_THIN_AT (0 = the full mix).
   */
  public setDramaLevel(level: number): void {
    const clamped = clamp(level, 0, 1);
    const change = Math.abs(clamped - this.dramaLevel);
    // Small changes are skipped, but the way back to the full mix always lands
    if (change === 0 || (change < 0.01 && clamped > 0)) return;

    this.dramaLevel = clamped;
    const gain = 1 - clamp(clamped / DRAMA_THIN_AT, 0, 1);
    this.padsThin.gain.setTargetAtTime(gain, this.now, DRAMA_THIN_TIME);
    this.melodyThin.gain.setTargetAtTime(gain, this.now, DRAMA_THIN_TIME);
  }

  /** The music cuts out from `time` for `duration` seconds: a break, stopping dead. */
  public cutOut(time: number, duration: number): void {
    try {
      const gain = this.glitchGain.gain;
      gain.setValueAtTime(1, time);
      gain.linearRampToValueAtTime(0, time + GLITCH.CUT_EDGE);
      gain.setValueAtTime(0, time + duration - GLITCH.CUT_EDGE);
      gain.linearRampToValueAtTime(1, time + duration);
    } catch {
      // Play on uncut rather than break audio
    }
  }

  /**
   * The signal drops from `time` for `duration` seconds, as a lost connection does: it sinks,
   * quieter and muffled, a trace of the music left, then comes back as it was.
   */
  public dropSignal(time: number, duration: number): void {
    const edge = Math.min(GLITCH.EDGE, duration / 2);
    try {
      const tone = this.glitchFilter.frequency;
      tone.setValueAtTime(GLITCH.OPEN_TONE, time);
      tone.exponentialRampToValueAtTime(GLITCH.DIP_TONE, time + edge);
      tone.setValueAtTime(GLITCH.DIP_TONE, time + duration - edge);
      tone.exponentialRampToValueAtTime(GLITCH.OPEN_TONE, time + duration);
      const gain = this.glitchGain.gain;
      gain.setValueAtTime(1, time);
      gain.linearRampToValueAtTime(GLITCH.DIP, time + edge);
      gain.setValueAtTime(GLITCH.DIP, time + duration - edge);
      gain.linearRampToValueAtTime(1, time + duration);
    } catch {
      // Play on undropped rather than break audio
    }
  }

  /**
   * A tape rewind from `time` over `duration` seconds: the delay swells, which sags the pitch,
   * then falls back quicker, which runs it sharp, and is back at 0, at pitch, when the next bar
   * comes. Both halves are a smooth bump, so the pitch bends without a jump at either end.
   */
  public rewind(time: number, duration: number): void {
    const steps = 32;
    const curve = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const phase =
        t < GLITCH.REWIND_SAG
          ? t / GLITCH.REWIND_SAG / 2
          : 0.5 + (t - GLITCH.REWIND_SAG) / (1 - GLITCH.REWIND_SAG) / 2;
      curve[i] = GLITCH.REWIND_DEPTH * Math.sin(Math.PI * phase) ** 2;
    }
    try {
      this.glitchDelay.delayTime.setValueCurveAtTime(curve, time, duration);
    } catch {
      // Play on unbent rather than break audio
    }
  }

  /**
   * A tape held back by a finger for `duration` seconds from now, then let go: the delay swells
   * and falls back smoothly, so the pitch sags, then catches up.
   */
  public holdTape(duration: number): void {
    const steps = 32;
    const curve = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      curve[i] = GLITCH.HOLD_DEPTH * Math.sin((Math.PI * i) / (steps - 1)) ** 2;
    }
    try {
      this.glitchDelay.delayTime.setValueCurveAtTime(curve, this.now, duration);
    } catch {
      // A song's own rewind is running: it bends the music already
    }
  }

  /**
   * Tape stop: the delay time sweeps up quadratically, which bends the pitch from normal
   * down to zero (Doppler), while the level fades out; from `at`, now if left out.
   * @returns false if the browser rejected the automation (the effect is then skipped)
   */
  public tapeStop(duration: number, at = this.now): boolean {
    // d(t) = (T/2)·(t/T)² → pitch factor 1 − d'(t) falls linearly from 1 to 0
    const steps = 32;
    const delayCurve = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      delayCurve[i] = (duration / 2) * t * t;
    }

    try {
      const delay = this.tapeDelay.delayTime;
      delay.cancelScheduledValues(at);
      delay.setValueCurveAtTime(delayCurve, at, duration);

      const gain = this.fadeGain.gain;
      gain.cancelScheduledValues(at);
      gain.setValueCurveAtTime(
        new Float32Array([gain.value, gain.value, 0.7, 0.3, 0]),
        at,
        duration,
      );
      this.tapeStopEndsAt = at + duration;
      return true;
    } catch {
      // Overlapping automation is rejected by some browsers; skip the effect rather than break audio
      return false;
    }
  }

  /** Undo `tapeStop`. */
  public recover(): void {
    // Safari rejects automation that overlaps a running curve, which would leave the music
    // silent, so a tape stop that is still running (finale skipped) plays out first
    const at = this.afterTapeStop();
    try {
      const delay = this.tapeDelay.delayTime;
      delay.cancelScheduledValues(at);
      delay.setValueAtTime(0, at);
    } catch {
      // Leave the pitch bend as is rather than break audio
    }
    // After a tape stop the level is at 0, so the delay jump above is inaudible
    this.rampFadeGain(1, 0.6);
  }

  /** Earliest time new automation may start: now, or when a running tape stop ends. */
  private afterTapeStop(): number {
    return Math.max(this.now, this.tapeStopEndsAt);
  }

  /** Ramps the fade gain to `level` over `seconds`, after any running tape stop. */
  private rampFadeGain(level: number, seconds: number): void {
    const at = this.afterTapeStop();
    try {
      const gain = this.fadeGain.gain;
      gain.cancelScheduledValues(at);
      // Without a running curve, start from the current level; otherwise from where it ends
      if (at === this.now) gain.setValueAtTime(gain.value, at);
      gain.linearRampToValueAtTime(level, at + seconds);
    } catch {
      // Keep the current level rather than break audio
    }
  }
}
