import {
  BASS_PATTERNS,
  CHORD_TYPES,
  CLIMAX_INTENSITY_FOLLOW,
  DRAMA_FILTER_MAX_FREQ,
  DRAMA_FILTER_MIN_FREQ,
  HARMONY_HISTORY,
  MUSIC_DUCK_LEVEL,
  MUSIC_TRACKS,
  TAPE_STOP_DURATION,
} from '@/constants/audio.constants';
import { getRallyHeat, getSpeedHeat } from '@/entities/heat';
import { Harmony } from '@/types/audio.types';
import { DifficultyConfig } from '@/types/difficulty.types';
import { GameState } from '@/types/game.types';
import { clamp, midiToFrequency } from '@/utils/math';

export interface MusicEngineStateProvider {
  getGameState: () => GameState;
  getServeTime: () => number;
  getBallSpeed: () => number;
  getRally: () => number;
  getScores: () => [number, number];
  getDifficultyConfig: () => DifficultyConfig;
  getIsMusicMuted: () => boolean;
}

export class MusicEngine {
  private ac: AudioContext | null = null;
  private stateProvider: MusicEngineStateProvider;

  private noiseBuffer: AudioBuffer | null = null;
  private busNode: GainNode | null = null;
  private auxNode: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private masterGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private dramaFilterNode: BiquadFilterNode | null = null;
  private tapeDelayNode: DelayNode | null = null;
  private duckGainNode: GainNode | null = null;

  private intensity = 0.3;
  private isTapeStopped = false;
  private harmonyTimeline: (Harmony & { time: number })[] = [];
  private dramaLevel = 0;
  private climaxLevel = 0;
  private isDropPending = false;
  private nextStepTime = 0;
  private currentStep = 0;
  private songTrackOffset = 0;
  private schedulerIntervalId: number | null = null;

  constructor(stateProvider: MusicEngineStateProvider) {
    this.stateProvider = stateProvider;
    this.songTrackOffset = Math.floor(Math.random() * MUSIC_TRACKS.length);
  }

  public init(audioContext: AudioContext): void {
    if (this.filterNode) return; // Already initialized

    this.ac = audioContext;

    // Create noise buffer for percussion (snare, hi-hat, crash)
    this.noiseBuffer = this.ac.createBuffer(1, this.ac.sampleRate, this.ac.sampleRate);
    const channelData = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = Math.random() * 2 - 1;
    }

    this.busNode = this.ac.createGain();
    this.auxNode = this.ac.createGain();
    this.delayNode = this.ac.createDelay(1);
    this.filterNode = this.ac.createBiquadFilter();
    this.masterGainNode = this.ac.createGain();

    const feedbackGain = this.ac.createGain();
    const compressor = this.ac.createDynamicsCompressor();

    feedbackGain.gain.value = 0.4;
    this.filterNode.frequency.value = 2800;
    this.masterGainNode.gain.value = 0;

    // Audio graph wiring:
    // aux -> bus & delay
    // delay -> feedback -> delay -> bus
    // bus -> filter -> compressor -> dramaFilter -> tapeDelay -> duckGain -> masterGain -> destination
    // duckGain -> analyser
    // (dramaFilter is separate so match-point muffling never fights the scheduler's filter;
    //  tapeDelay sits at 0 ms until a tape stop sweeps it to bend the pitch down;
    //  duckGain dips the music under end-of-match stings, independent of the mute gain)
    this.dramaFilterNode = this.ac.createBiquadFilter();
    this.dramaFilterNode.frequency.value = DRAMA_FILTER_MAX_FREQ;
    this.tapeDelayNode = this.ac.createDelay(1);
    this.tapeDelayNode.delayTime.value = 0;
    this.duckGainNode = this.ac.createGain();

    this.auxNode.connect(this.busNode);
    this.auxNode.connect(this.delayNode);
    this.delayNode.connect(feedbackGain);
    feedbackGain.connect(this.delayNode);
    this.delayNode.connect(this.busNode);
    this.busNode.connect(this.filterNode);
    this.filterNode.connect(compressor);
    compressor.connect(this.dramaFilterNode);
    this.dramaFilterNode.connect(this.tapeDelayNode);
    this.tapeDelayNode.connect(this.duckGainNode);
    this.duckGainNode.connect(this.masterGainNode);

    this.analyserNode = this.ac.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.75;
    this.duckGainNode.connect(this.analyserNode);

    this.masterGainNode.connect(this.ac.destination);

    this.nextStepTime = this.ac.currentTime + 0.1;
    this.schedulerIntervalId = window.setInterval(() => this.scheduleSteps(), 25);
  }

  /** Muffle the music with a low-pass, level in [0, 1] (0 = fully open). */
  public setDramaLevel(level: number): void {
    const clamped = clamp(level, 0, 1);
    if (!this.ac || !this.dramaFilterNode || Math.abs(clamped - this.dramaLevel) < 0.01) return;

    this.dramaLevel = clamped;
    // Interpolate in log space so the sweep sounds even
    const frequency =
      DRAMA_FILTER_MAX_FREQ * Math.pow(DRAMA_FILTER_MIN_FREQ / DRAMA_FILTER_MAX_FREQ, clamped);
    this.dramaFilterNode.frequency.setTargetAtTime(frequency, this.ac.currentTime, 0.03);
  }

  /**
   * Rally climax build-up in [0, 1], already eased by the game: extra layers fade in with it
   * and intensity rises toward full. The game moves it slowly, so this is the riser.
   */
  public setClimaxLevel(level: number): void {
    this.climaxLevel = clamp(level, 0, 1);
    if (this.climaxLevel === 0) {
      this.isDropPending = false;
    }
  }

  /** The build-up has peaked: hit the drop on the next step. */
  public triggerDrop(): void {
    this.isDropPending = true;
  }

  /** Dip the music so the victory sting sits on top; stays down until `recover`. */
  public duck(): void {
    if (!this.ac || !this.duckGainNode) return;
    const gain = this.duckGainNode.gain;
    const now = this.ac.currentTime;

    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(MUSIC_DUCK_LEVEL, now + 0.08);
  }

  /**
   * Tape stop for a defeat: the delay time sweeps up quadratically, which bends the pitch
   * from normal down to zero (Doppler), while the level fades out. The sequencer halts
   * until `recover`.
   */
  public tapeStop(duration = TAPE_STOP_DURATION): void {
    if (!this.ac || !this.tapeDelayNode || !this.duckGainNode) return;
    const now = this.ac.currentTime;

    // d(t) = (T/2)·(t/T)² → pitch factor 1 − d'(t) falls linearly from 1 to 0
    const steps = 32;
    const delayCurve = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      delayCurve[i] = (duration / 2) * t * t;
    }

    try {
      const delay = this.tapeDelayNode.delayTime;
      delay.cancelScheduledValues(now);
      delay.setValueCurveAtTime(delayCurve, now, duration);

      const gain = this.duckGainNode.gain;
      gain.cancelScheduledValues(now);
      gain.setValueCurveAtTime(
        new Float32Array([gain.value, gain.value, 0.7, 0.3, 0]),
        now,
        duration,
      );

      this.isTapeStopped = true;
    } catch {
      // Overlapping automation is rejected by some browsers; skip the effect rather than break audio
    }
  }

  /** Undo `duck` / `tapeStop` and resume the sequencer. */
  public recover(): void {
    if (!this.ac || !this.tapeDelayNode || !this.duckGainNode) return;
    const now = this.ac.currentTime;

    const delay = this.tapeDelayNode.delayTime;
    delay.cancelScheduledValues(now);
    delay.setValueAtTime(0, now);

    // After a tape stop the level is at 0, so the delay jump above is inaudible
    const gain = this.duckGainNode.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(1, now + 0.6);

    this.isTapeStopped = false;
  }

  public newSong(): void {
    this.currentStep = (this.currentStep | 255) + 1;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  /**
   * The chord that is sounding right now. Steps are scheduled ~150 ms ahead, so this
   * picks the latest bar change whose start time has actually been reached.
   * Null before the music has started.
   */
  public getHarmony(): Harmony | null {
    if (!this.ac || this.harmonyTimeline.length === 0) return null;

    const now = this.ac.currentTime;
    let current = this.harmonyTimeline[0];
    for (const entry of this.harmonyTimeline) {
      if (entry.time <= now) current = entry;
    }
    return { root: current.root, chord: current.chord };
  }

  private getCurrentTrack(step: number) {
    const index = (this.songTrackOffset + (step >> 8)) % MUSIC_TRACKS.length;
    return MUSIC_TRACKS[index];
  }

  private playNote(
    type: OscillatorType,
    midiNote: number,
    time: number,
    duration: number,
    volume: number,
    destination: AudioNode,
    filterCutoff: number,
  ): void {
    if (!this.ac) return;
    const osc = this.ac.createOscillator();
    const gain = this.ac.createGain();
    const filter = this.ac.createBiquadFilter();

    osc.type = type;
    osc.frequency.value = midiToFrequency(midiNote);

    filter.frequency.setValueAtTime(filterCutoff, time);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(150, filterCutoff * 0.2),
      time + duration,
    );

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  private playPad(chordNotes: number[], time: number, duration: number, volume: number): void {
    if (!this.ac || !this.busNode) return;
    for (const note of chordNotes) {
      for (const detune of [-9, 9]) {
        const osc = this.ac.createOscillator();
        const gain = this.ac.createGain();
        const filter = this.ac.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.value = midiToFrequency(note);
        osc.detune.value = detune;

        filter.frequency.value = 700 + this.intensity * 1800;

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume, time + duration * 0.25);
        gain.gain.linearRampToValueAtTime(0, time + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.busNode);

        osc.start(time);
        osc.stop(time + duration + 0.05);
      }
    }
  }

  private playKick(time: number, volume: number): void {
    if (!this.ac || !this.busNode) return;
    const osc = this.ac.createOscillator();
    const gain = this.ac.createGain();

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

    osc.connect(gain);
    gain.connect(this.busNode);

    osc.start(time);
    osc.stop(time + 0.3);
  }

  private playNoise(
    time: number,
    duration: number,
    volume: number,
    highpassFrequency: number,
  ): void {
    if (!this.ac || !this.noiseBuffer || !this.busNode) return;
    const source = this.ac.createBufferSource();
    const gain = this.ac.createGain();
    const filter = this.ac.createBiquadFilter();

    source.buffer = this.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.value = highpassFrequency;

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.busNode);

    source.start(time);
    source.stop(time + duration + 0.02);
  }

  private playStep(time: number, step: number, stepDuration: number): void {
    if (!this.busNode || !this.auxNode) return;

    const track = this.getCurrentTrack(step);
    const bar = (step >> 4) & 3;
    const stepInBar = step & 15;
    const root = track.rootNotes[bar];
    const triad = CHORD_TYPES[track.chordTypes[bar]];
    const I = this.intensity;

    if (step % 256 === 0) {
      this.playNoise(time, 1.2, 0.14, 3000);
    }

    if (stepInBar === 0) {
      this.playPad(
        triad.map((x) => root + 12 + x),
        time,
        stepDuration * 16,
        0.03 + 0.03 * I,
      );
    }

    if (BASS_PATTERNS[track.bassPatternIndex][stepInBar] === '1') {
      const bassNote = root + (stepInBar % 8 === 6 ? 12 : 0);
      this.playNote(
        'sawtooth',
        bassNote,
        time,
        stepDuration * 1.8,
        0.16 + 0.1 * I,
        this.busNode,
        500 + I * 1800,
      );
    }

    if (stepInBar % 4 === 0) {
      this.playKick(time, 0.3 + 0.4 * I);
    }

    if ((stepInBar === 4 || stepInBar === 12) && I > 0.2) {
      this.playNoise(time, 0.25, 0.2 + 0.15 * I, 1200);
    }

    if (stepInBar % 2) {
      this.playNoise(time, 0.05, 0.04 + 0.05 * I, 7000);
    } else if (I > 0.45 && stepInBar % 4) {
      this.playNoise(time, 0.03, clamp((I - 0.4) * 0.08, 0, 0.035), 8000);
    }

    if (I > 0.25) {
      const arpeggioIndex = track.arpeggioPattern[stepInBar];
      const leadNote = root + 24 + triad[arpeggioIndex % 3] + (arpeggioIndex > 2 ? 12 : 0);
      this.playNote(
        track.arpeggioWave,
        leadNote,
        time,
        stepDuration * 1.6,
        clamp((I - 0.22) * 0.14, 0, 0.07),
        this.auxNode,
        1500 + I * 2500,
      );
    }

    if (I > 0.6 && stepInBar % 4 === 0) {
      const chordIndex = (stepInBar >> 2) % 3;
      const melodyNote = root + 36 + triad[chordIndex];
      this.playNote(
        'sawtooth',
        melodyNote,
        time,
        stepDuration * 3.5,
        clamp((I - 0.55) * 0.14, 0, 0.055),
        this.auxNode,
        2500,
      );
    }

    if (this.climaxLevel > 0.01) {
      this.playClimaxLayers(
        time,
        stepInBar,
        stepDuration,
        root,
        triad,
        track.arpeggioPattern,
        this.climaxLevel,
      );
    }
  }

  /** One-shot impact when the build-up peaks: crash, heavy kick and a long held bass note. */
  private playDrop(time: number, root: number, stepDuration: number): void {
    if (!this.busNode) return;
    this.playNoise(time, 1.6, 0.22, 2500);
    this.playKick(time, 1.0);
    // Bass root register (not an octave lower) so it stays audible on phone speakers
    this.playNote('sawtooth', root, time, stepDuration * 8, 0.22, this.busNode, 900);
  }

  /** Extra layers that only play during the climax, on top of the full-intensity mix. */
  private playClimaxLayers(
    time: number,
    stepInBar: number,
    stepDuration: number,
    root: number,
    triad: number[],
    arpeggioPattern: number[],
    mix: number,
  ): void {
    if (!this.auxNode) return;

    // Crash on every bar
    if (stepInBar === 0) {
      this.playNoise(time, 0.9, 0.12 * mix, 4000);
    }

    // Open hats on the off-beats
    if (stepInBar % 4 === 2) {
      this.playNoise(time, 0.12, 0.07 * mix, 9000);
    }

    // Sparkle arpeggio an octave above the lead
    const arpeggioIndex = arpeggioPattern[(stepInBar + 2) & 15];
    const sparkleNote = root + 36 + triad[arpeggioIndex % 3] + (arpeggioIndex > 2 ? 12 : 0);
    this.playNote('square', sparkleNote, time, stepDuration * 0.9, 0.025 * mix, this.auxNode, 6000);
  }

  private scheduleSteps(): void {
    if (
      !this.ac ||
      this.ac.state !== 'running' ||
      !this.filterNode ||
      !this.masterGainNode ||
      !this.delayNode ||
      this.isTapeStopped
    ) {
      // During a tape stop no new notes are scheduled; the clock catches up on recover
      return;
    }

    const now = this.ac.currentTime;
    const isMuted = this.stateProvider.getIsMusicMuted();
    this.masterGainNode.gain.setTargetAtTime(isMuted ? 0 : 0.3, now, 0.05);

    if (this.nextStepTime < now - 0.1) {
      this.nextStepTime = now + 0.05;
    }

    const gameState = this.stateProvider.getGameState();
    const serveTime = this.stateProvider.getServeTime();
    const ballSpeed = this.stateProvider.getBallSpeed();
    const rally = this.stateProvider.getRally();
    const scores = this.stateProvider.getScores();
    const diffConfig = this.stateProvider.getDifficultyConfig();

    while (this.nextStepTime < now + 0.15) {
      let targetIntensity = 0.35;
      if (gameState === 'paused') {
        targetIntensity = this.intensity;
      } else if (gameState === 'play') {
        if (serveTime > 0) {
          targetIntensity = 0.25;
        } else {
          const speedFactor = getSpeedHeat(ballSpeed, diffConfig.maxSpeed) * 0.7;
          const rallyFactor = getRallyHeat(rally) * 0.3;
          const matchPointBonus = Math.max(scores[0], scores[1]) >= 6 ? 0.1 : 0;
          targetIntensity = 0.25 + 0.65 * clamp(speedFactor + rallyFactor, 0, 1) + matchPointBonus;
        }
      }

      if (this.climaxLevel > 0 && gameState === 'play') {
        // The build-up pulls intensity toward full in step with the (slow) climax level
        const climaxTarget = targetIntensity + (1 - targetIntensity) * this.climaxLevel;
        this.intensity += (climaxTarget - this.intensity) * CLIMAX_INTENSITY_FOLLOW;
      } else {
        this.intensity += (targetIntensity - this.intensity) * 0.025;
      }

      const track = this.getCurrentTrack(this.currentStep);
      const stepDuration = 60 / (track.bpm + 8 * this.intensity) / 4;

      // Remember chord changes (even while muted) so hits can be tuned to the audible bar
      if ((this.currentStep & 15) === 0 || this.harmonyTimeline.length === 0) {
        const bar = (this.currentStep >> 4) & 3;
        this.harmonyTimeline.push({
          time: this.nextStepTime,
          root: track.rootNotes[bar],
          chord: CHORD_TYPES[track.chordTypes[bar]],
        });
        if (this.harmonyTimeline.length > HARMONY_HISTORY) {
          this.harmonyTimeline.shift();
        }
      }

      if (this.isDropPending) {
        this.isDropPending = false;
        if (!isMuted) {
          const bar = (this.currentStep >> 4) & 3;
          this.playDrop(this.nextStepTime, track.rootNotes[bar], stepDuration);
        }
      }

      const filterFreq = gameState === 'paused' ? 450 : gameState === 'menu' ? 2800 : 16000;
      this.filterNode.frequency.setTargetAtTime(filterFreq, this.nextStepTime, 0.2);
      this.delayNode.delayTime.setTargetAtTime(stepDuration * 3, this.nextStepTime, 0.1);

      if (!isMuted) {
        this.playStep(this.nextStepTime, this.currentStep, stepDuration);
      }

      this.nextStepTime += stepDuration;
      this.currentStep++;
    }
  }

  public dispose(): void {
    if (this.schedulerIntervalId !== null) {
      clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = null;
    }
  }
}
