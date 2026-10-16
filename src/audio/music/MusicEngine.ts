import { Arrangement, BASS_LOW } from '@/audio/music/Arrangement';
import { Conductor } from '@/audio/music/Conductor';
import { Harmony, HarmonyTimeline } from '@/audio/music/HarmonyTimeline';
import { Instruments } from '@/audio/music/Instruments';
import {
  getTargetIntensity,
  getWantedTier,
  INITIAL_MUSIC_STATE,
  MusicState,
  followClimax,
  stepIntensity,
} from '@/audio/music/intensity';
import { MusicGraph } from '@/audio/music/MusicGraph';
import { chordAt, STEPS_PER_BAR } from '@/audio/music/score';
import { SONGS } from '@/audio/music/songs';
import { placeAbove } from '@/audio/music/theory';
import { GameState } from '@/match/GameState';
import { clamp } from '@/shared/math';

const HARMONY_HISTORY = 8; // scheduled chord changes kept to find what is audible now
const TAPE_STOP_DURATION = 1.1; // s for the music to grind to a halt on defeat

// Look-ahead scheduling: wake up often, schedule a little ahead on the precise audio clock
const SCHEDULER_INTERVAL_MS = 25;
const SCHEDULE_AHEAD = 0.15;
const START_DELAY = 0.1;
// If the scheduler fell this far behind (e.g. a hidden tab), restart the clock instead
const RESYNC_THRESHOLD = 0.1;
const RESYNC_DELAY = 0.05;

// The conductor decides the next bar halfway through the current one, in time for a fill
const PLAN_STEP = 8;
const ECHO_STEPS = 3; // lead echo time, in steps
const TONE_FILTER: Record<GameState, number> = { paused: 450, menu: 2800, play: 16000 };

/**
 * Procedural synthwave soundtrack. The game pushes its state in with `setState` every frame;
 * a look-ahead scheduler turns that into intensity, lets the conductor pick the section that
 * fits, and plays the arrangement step by step. Each song keeps its own tempo throughout.
 * Effect commands (drama, climax, duck, tape stop) are forwarded to the audio graph.
 */
export class MusicEngine {
  private graph: MusicGraph | null = null;
  private arrangement: Arrangement | null = null;
  private readonly harmony = new HarmonyTimeline(HARMONY_HISTORY);

  private state: MusicState = INITIAL_MUSIC_STATE;
  private intensity = 0.3;
  /** The game's climax build-up, as last pushed in. */
  private gameClimaxLevel = 0;
  /** The music's own climax level: follows the game's, but dies away more slowly. */
  private climaxLevel = 0;
  private isDropPending = false;
  private isTapeStopped = false;

  private nextStepTime = 0;
  private currentStep = 0;
  private readonly conductor = new Conductor(SONGS, Math.floor(Math.random() * SONGS.length));
  private schedulerIntervalId: number | null = null;

  /** Builds the audio graph and starts the scheduler; safe to call more than once. */
  public init(audioContext: AudioContext): void {
    if (this.graph) return;

    this.graph = new MusicGraph(audioContext);
    this.arrangement = new Arrangement(new Instruments(this.graph), this.graph);

    this.nextStepTime = audioContext.currentTime + START_DELAY;
    this.schedulerIntervalId = window.setInterval(
      () => this.scheduleSteps(),
      SCHEDULER_INTERVAL_MS,
    );
  }

  /** Latest game state; read by the scheduler on its next tick. */
  public setState(state: MusicState): void {
    this.state = state;
  }

  /** Muffle the music with a low-pass, level in [0, 1] (0 = fully open). */
  public setDramaLevel(level: number): void {
    this.graph?.setDramaLevel(level);
  }

  /**
   * Rally climax build-up in [0, 1], already eased by the game: extra layers fade in with it
   * and intensity rises toward full. The game moves it slowly, so this is the riser. When it
   * falls, the music lets the climax die away more slowly than the screen (followClimax).
   */
  public setClimaxLevel(level: number): void {
    this.gameClimaxLevel = clamp(level, 0, 1);
    if (this.gameClimaxLevel === 0) {
      this.isDropPending = false;
    }
  }

  /** Cuts the climax at once, with no fade (new match, back to the menu, end of a match). */
  public resetClimax(): void {
    this.gameClimaxLevel = 0;
    this.climaxLevel = 0;
    this.isDropPending = false;
  }

  /** The build-up has peaked: hit the drop on the next step. */
  public triggerDrop(): void {
    this.isDropPending = true;
  }

  /** Dip the music so the victory sting sits on top; stays down until `recover`. */
  public duck(): void {
    this.graph?.duck();
  }

  /** Tape stop for a defeat; the sequencer halts until `recover`. */
  public tapeStop(duration = TAPE_STOP_DURATION): void {
    if (this.graph?.tapeStop(duration)) {
      this.isTapeStopped = true;
    }
  }

  /** Undo `duck` / `tapeStop` and resume the sequencer. */
  public recover(): void {
    this.graph?.recover();
    this.isTapeStopped = false;
  }

  /** Move on to the next song at the next phrase boundary. */
  public newSong(): void {
    this.conductor.requestNewSong();
  }

  public getAnalyser(): AnalyserNode | null {
    return this.graph?.analyser ?? null;
  }

  /** The chord that is sounding right now; null before the music has started. */
  public getHarmony(): Harmony | null {
    return this.graph ? this.harmony.at(this.graph.context.currentTime) : null;
  }

  public dispose(): void {
    if (this.schedulerIntervalId !== null) {
      clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = null;
    }
  }

  private scheduleSteps(): void {
    const { graph, arrangement } = this;
    // During a tape stop no new notes are scheduled; the clock catches up on recover
    if (!graph || !arrangement || graph.context.state !== 'running' || this.isTapeStopped) {
      return;
    }

    const now = graph.context.currentTime;
    const { gameState, isMuted } = this.state;
    graph.setMuted(isMuted);

    if (this.nextStepTime < now - RESYNC_THRESHOLD) {
      this.nextStepTime = now + RESYNC_DELAY;
    }

    while (this.nextStepTime < now + SCHEDULE_AHEAD) {
      const target = getTargetIntensity(this.state, this.intensity);
      this.intensity = stepIntensity(this.intensity, target, this.climaxLevel, gameState);

      const { conductor } = this;
      const stepInBar = this.currentStep % STEPS_PER_BAR;
      if (stepInBar === 0 && this.currentStep > 0) conductor.advance();
      if (stepInBar === PLAN_STEP) {
        conductor.plan(
          getWantedTier(gameState, this.intensity, this.climaxLevel, conductor.section.tier),
        );
      }

      const { song, section, bar } = conductor;
      const time = this.nextStepTime;
      const stepDuration = 60 / song.bpm / 4;
      const chord = chordAt(section, bar * STEPS_PER_BAR + stepInBar);

      // Remember chord changes (even while muted) so hits can be tuned to the audible chord
      if (stepInBar % PLAN_STEP === 0 || this.harmony.isEmpty) {
        this.harmony.push(time, { root: placeAbove(chord.root, BASS_LOW), chord: chord.triad });
      }

      if (this.isDropPending) {
        this.isDropPending = false;
        if (!isMuted) {
          arrangement.playDrop(time, chord, stepDuration);
        }
      }

      graph.setToneFilter(TONE_FILTER[gameState], time);
      graph.setEchoTime(stepDuration * ECHO_STEPS, time);

      if (!isMuted) {
        arrangement.playStep({
          time,
          stepDuration,
          song,
          section,
          bar,
          stepInBar,
          isLastBar: conductor.isLastBar,
          nextBarChord: conductor.nextBarChord,
          intensity: this.intensity,
          climaxLevel: this.climaxLevel,
          difficulty: this.state.difficulty,
        });
      }

      this.climaxLevel = followClimax(this.climaxLevel, this.gameClimaxLevel, stepDuration);
      this.nextStepTime += stepDuration;
      this.currentStep++;
    }
  }
}
