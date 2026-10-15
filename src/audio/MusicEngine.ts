import {
  BASS_PATTERNS,
  CHORD_TYPES,
  DRAMA_FILTER_MAX_FREQ,
  DRAMA_FILTER_MIN_FREQ,
  MUSIC_TRACKS,
} from '@/constants/audio.constants';
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

  private intensity = 0.3;
  private dramaLevel = 0;
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
    // bus -> filter -> compressor -> dramaFilter -> masterGain -> destination
    // dramaFilter -> analyser
    // (dramaFilter is separate so match-point muffling never fights the scheduler's filter)
    this.dramaFilterNode = this.ac.createBiquadFilter();
    this.dramaFilterNode.frequency.value = DRAMA_FILTER_MAX_FREQ;

    this.auxNode.connect(this.busNode);
    this.auxNode.connect(this.delayNode);
    this.delayNode.connect(feedbackGain);
    feedbackGain.connect(this.delayNode);
    this.delayNode.connect(this.busNode);
    this.busNode.connect(this.filterNode);
    this.filterNode.connect(compressor);
    compressor.connect(this.dramaFilterNode);
    this.dramaFilterNode.connect(this.masterGainNode);

    this.analyserNode = this.ac.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.75;
    this.dramaFilterNode.connect(this.analyserNode);

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

  public newSong(): void {
    this.currentStep = (this.currentStep | 255) + 1;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  public getIntensity(): number {
    return this.intensity;
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
  }

  private scheduleSteps(): void {
    if (
      !this.ac ||
      this.ac.state !== 'running' ||
      !this.filterNode ||
      !this.masterGainNode ||
      !this.delayNode
    ) {
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
          const speedFactor = clamp((ballSpeed - 340) / (diffConfig.maxSpeed - 340), 0, 1) * 0.7;
          const rallyFactor = (Math.min(rally, 14) / 14) * 0.3;
          const matchPointBonus = Math.max(scores[0], scores[1]) >= 6 ? 0.1 : 0;
          targetIntensity = 0.25 + 0.65 * clamp(speedFactor + rallyFactor, 0, 1) + matchPointBonus;
        }
      }

      this.intensity += (targetIntensity - this.intensity) * 0.025;
      const track = this.getCurrentTrack(this.currentStep);
      const stepDuration = 60 / (track.bpm + 8 * this.intensity) / 4;

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
